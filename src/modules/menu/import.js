import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';
import { parseCsv } from '@/lib/menu/import/csv.mjs';
import { readXlsx } from '@/lib/menu/import/xlsx.mjs';
import { nameKey, parseMenuRows } from '@/lib/menu/import/parse-menu.mjs';
import { planMenuImport } from '@/lib/menu/import/plan.mjs';

export const MENU_FILE_MAX_BYTES = 1024 * 1024;
const TX = { maxWait: 5000, timeout: 60000 };
const bad = (message) => new HttpError(400, message, 'VALIDATION');

/** bytes -> rows. The type comes from the file's first bytes, not its name. */
function readRows(bytes) {
  const head = Buffer.from(bytes.subarray(0, 4));
  if (head[0] === 0x50 && head[1] === 0x4b) { // "PK": an .xlsx workbook
    try { return readXlsx(bytes); } catch { throw bad('This Excel file could not be read. Open it in Excel and save it again as .xlsx (or as .csv).'); }
  }
  if (head[0] === 0xd0 && head[1] === 0xcf) throw bad('This is an old Excel (.xls) file. Open it in Excel and use Save As → Excel Workbook (.xlsx) or CSV.');
  return parseCsv(Buffer.from(bytes).toString('utf8'));
}

function parseFile(bytes) {
  try { return parseMenuRows(readRows(bytes)); } catch (e) { throw e instanceof HttpError ? e : bad(e.message); }
}

async function loadExisting(db, tenantId) {
  const [categories, products] = await Promise.all([
    db.category.findMany({ where: { tenantId }, select: { id: true, name: true } }),
    db.product.findMany({ where: { tenantId }, select: { id: true, name: true, price: true, categoryId: true, category: { select: { name: true } } } }),
  ]);
  return { categories, products: products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price), categoryId: p.categoryId, categoryName: p.category?.name ?? null })) };
}

/**
 * The client being imported into comes from the page's URL; the page also sends that client's slug, and the two must agree.
 * So a stale or mixed-up page can never write one client's menu into another client: it is refused instead.
 */
async function assertClient(tenantId, expectedSlug) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { slug: true } });
  if (!t) throw new HttpError(404, 'Client not found.', 'NOT_FOUND');
  if (!expectedSlug || t.slug !== expectedSlug) throw new HttpError(409, 'This page and the client do not match, so nothing was imported. Close this window, open the client again and retry.', 'CLIENT_MISMATCH');
}

/** Dry run: what would change. Writes nothing. */
export async function previewMenuImport(tenantId, bytes, expectedSlug) {
  await assertClient(tenantId, expectedSlug);
  const { items, errors } = parseFile(bytes);
  const plan = planMenuImport(items, await loadExisting(prisma, tenantId));
  return { ...plan, errors, counts: { ...plan.counts, problems: errors.length } };
}

/**
 * Applies the file in ONE transaction: all of it or none of it. Refuses a file that has problem rows
 * (fix the sheet and upload again). Adds categories and items, updates price/category of items it matches by name;
 * never deletes or hides anything. The plan is rebuilt inside the transaction from fresh data.
 */
export async function applyMenuImport(admin, tenantId, bytes, expectedSlug) {
  await assertClient(tenantId, expectedSlug);
  const { items, errors } = parseFile(bytes);
  if (errors.length) throw bad(`The file still has ${errors.length} problem row${errors.length === 1 ? '' : 's'}. Fix them and upload it again.`);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const plan = planMenuImport(items, await loadExisting(tx, tenantId));
      if (plan.categoriesNew.length) await tx.category.createMany({ data: plan.categoriesNew.map((name) => ({ tenantId, name })) });
      const catId = new Map((await tx.category.findMany({ where: { tenantId }, select: { id: true, name: true } })).map((c) => [nameKey(c.name), c.id]));
      const categoryOf = (r) => (r.category ? catId.get(nameKey(r.category)) ?? null : null);

      const created = plan.rows.filter((r) => r.status === 'new');
      if (created.length) await tx.product.createMany({ data: created.map((r) => ({ tenantId, name: r.name, price: r.price, description: r.description, categoryId: categoryOf(r) })) });
      const updated = plan.rows.filter((r) => r.status === 'update');
      for (const r of updated) await tx.product.update({ where: { id: r.productId }, data: { price: r.price, ...(r.category ? { categoryId: categoryOf(r) } : {}), ...(r.description ? { description: r.description } : {}) } });
      // Kept in the audit log so a wrong import can be traced and undone by hand (capped so the log row stays small).
      const changes = { added: created.slice(0, 200).map((r) => r.name), updated: updated.slice(0, 200).map((r) => ({ name: r.name, price: [r.oldPrice, r.price], section: [r.oldCategory, r.category] })) };
      return { created: created.length, updated: updated.length, unchanged: plan.counts.unchanged, categoriesCreated: plan.categoriesNew.length, changes };
    }, TX);
    const { changes, ...summary } = result;
    await audit({ tenantId, userId: admin.user.id, action: 'menu.imported', entity: 'Tenant', entityId: tenantId, metadata: { clientSlug: expectedSlug, ...summary, ...changes } });
    return summary;
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'The menu changed while importing. Please try again.', 'CONFLICT');
    throw e;
  }
}
