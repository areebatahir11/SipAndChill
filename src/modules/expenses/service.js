import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';
import { parseBusinessDay } from '@/lib/orders/dates.mjs';
import { DEFAULT_CATEGORIES, STOCK_PURCHASE_CATEGORY, businessDateBounds, decimalToMinor, fromMinor, minorToNumber, purgeProblem, voidProblem } from '@/lib/expenses.mjs';

const PAGE_SIZE = 25;
const num = (d) => (d == null ? 0 : Number(d));

/**
 * Makes sure the shop has its standard categories. Safe to call any time and from simultaneous requests:
 * the unique (tenantId, name) index plus skipDuplicates means a second caller simply inserts nothing.
 * Existing shops get their categories the first time they use Expenses, so no data migration is needed.
 */
export async function ensureCategories(tenantId, db = prisma) {
  await db.expenseCategory.createMany({
    data: DEFAULT_CATEGORIES.map((name) => ({ tenantId, name, isSystem: name === STOCK_PURCHASE_CATEGORY })),
    skipDuplicates: true,
  });
}

/** The app-owned category that stock purchases are filed under. */
export async function stockPurchaseCategory(tenantId, db = prisma) {
  const found = await db.expenseCategory.findFirst({ where: { tenantId, name: STOCK_PURCHASE_CATEGORY }, select: { id: true } });
  if (found) return found.id;
  await ensureCategories(tenantId, db);
  return (await db.expenseCategory.findFirst({ where: { tenantId, name: STOCK_PURCHASE_CATEGORY }, select: { id: true } })).id;
}

const toCategory = (c) => ({ id: c.id, name: c.name, isSystem: c.isSystem, isActive: c.isActive });

export async function listCategories(tenantId) {
  await ensureCategories(tenantId);
  const rows = await prisma.expenseCategory.findMany({ where: { tenantId }, orderBy: [{ isSystem: 'desc' }, { name: 'asc' }] });
  return rows.map(toCategory);
}

export async function createCategory(auth, { name }) {
  try {
    const row = await prisma.expenseCategory.create({ data: { tenantId: auth.tenantId, name } });
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'expense.category_created', entity: 'ExpenseCategory', entityId: row.id, metadata: { name } });
    return toCategory(row);
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'A category with this name already exists.', 'DUPLICATE');
    throw e;
  }
}

export async function updateCategory(auth, id, data) {
  const row = await prisma.expenseCategory.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!row) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
  if (row.isSystem) throw new HttpError(400, 'This category is used by the app and cannot be changed.', 'SYSTEM_CATEGORY');
  try {
    const updated = await prisma.expenseCategory.update({ where: { id }, data });
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'expense.category_updated', entity: 'ExpenseCategory', entityId: id, metadata: data });
    return toCategory(updated);
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'A category with this name already exists.', 'DUPLICATE');
    throw e;
  }
}

/** A foreign category or supplier id (another shop's) is rejected exactly like an unknown one. */
async function assertOwnRefs(tenantId, { categoryId, supplierId }, db = prisma) {
  if (categoryId) {
    const c = await db.expenseCategory.findFirst({ where: { id: categoryId, tenantId }, select: { isActive: true, isSystem: true } });
    if (!c) throw new HttpError(400, 'Unknown category.', 'BAD_CATEGORY');
    if (!c.isActive) throw new HttpError(400, 'This category is hidden. Choose another one.', 'BAD_CATEGORY');
  }
  if (supplierId) {
    const s = await db.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } });
    if (!s) throw new HttpError(400, 'Unknown supplier.', 'BAD_SUPPLIER');
  }
}

const toExpense = (e) => ({
  id: e.id,
  businessDate: e.businessDate.toISOString().slice(0, 10),
  amount: num(e.amount),
  method: e.method,
  source: e.source,
  note: e.note,
  categoryId: e.categoryId,
  categoryName: e.category?.name ?? '',
  supplierName: e.supplier?.name ?? null,
  createdByName: e.createdBy?.name ?? null,
  createdAt: e.createdAt,
  voided: !!e.voidedAt,
  voidReason: e.voidReason,
});

/** Typed-in expense (rent, bills...). `amount` is integer paisa from the validation layer. */
export async function createExpense(auth, { categoryId, amount, method, businessDate, supplierId, note }) {
  await ensureCategories(auth.tenantId);
  await assertOwnRefs(auth.tenantId, { categoryId, supplierId });
  const cat = await prisma.expenseCategory.findFirst({ where: { id: categoryId, tenantId: auth.tenantId }, select: { isSystem: true } });
  if (cat.isSystem) throw new HttpError(400, 'Stock purchases are recorded from the Stock page.', 'BAD_CATEGORY');
  const row = await prisma.expense.create({
    data: { tenantId: auth.tenantId, categoryId, amount: fromMinor(amount), method, businessDate: parseBusinessDay(businessDate), supplierId: supplierId || null, note: note ?? null, createdById: auth.user.id },
    include: { category: { select: { name: true } }, supplier: { select: { name: true } }, createdBy: { select: { name: true } } },
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'expense.created', entity: 'Expense', entityId: row.id, metadata: { amount: fromMinor(amount), method, category: row.category.name } });
  return toExpense(row);
}

/** Voiding keeps the row (greyed out, excluded from totals) so the history is never rewritten. */
export async function voidExpense(auth, id, { reason }) {
  const row = await prisma.expense.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!row) throw new HttpError(404, 'Expense not found.', 'NOT_FOUND');
  const problem = voidProblem(row);
  if (problem) throw new HttpError(400, problem, 'CANNOT_VOID');
  // Conditional update: two people voiding at once cannot both "win".
  const res = await prisma.expense.updateMany({ where: { id, tenantId: auth.tenantId, voidedAt: null }, data: { voidedAt: new Date(), voidedById: auth.user.id, voidReason: reason } });
  if (res.count === 0) throw new HttpError(409, 'This expense was already voided.', 'CONFLICT');
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'expense.voided', entity: 'Expense', entityId: id, metadata: { amount: num(row.amount), reason } });
  return { voided: true };
}

/**
 * Permanently deletes ONE already-voided, hand-typed expense. Business Owner only (EXPENSES_PURGE), reason mandatory.
 * The audit entry is written in the SAME transaction as the delete (unlike normal best-effort audits): if the record
 * of the deletion cannot be saved, the deletion does not happen. It keeps a snapshot, because the row will be gone.
 */
export async function purgeExpense(auth, id, { reason }) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.expense.findFirst({ where: { id, tenantId: auth.tenantId }, include: { category: { select: { name: true } } } });
    if (!row) throw new HttpError(404, 'Expense not found.', 'NOT_FOUND');
    const problem = purgeProblem(row);
    if (problem) throw new HttpError(400, problem, 'CANNOT_PURGE');
    // The rules are re-checked inside the delete itself, so a concurrent change cannot slip a live expense through.
    const res = await tx.expense.deleteMany({ where: { id, tenantId: auth.tenantId, source: 'MANUAL', voidedAt: { not: null } } });
    if (res.count === 0) throw new HttpError(409, 'This expense changed or was already deleted.', 'CONFLICT');
    await tx.auditLog.create({
      data: {
        tenantId: auth.tenantId, userId: auth.user.id, action: 'expense.purged', entity: 'Expense', entityId: id,
        metadata: {
          reason,
          snapshot: {
            businessDate: row.businessDate.toISOString().slice(0, 10), category: row.category.name, amount: num(row.amount), method: row.method,
            note: row.note, createdById: row.createdById, createdAt: row.createdAt.toISOString(),
            voidedById: row.voidedById, voidedAt: row.voidedAt.toISOString(), voidReason: row.voidReason,
          },
        },
      },
    });
    return { purged: true };
  });
}

/**
 * Totals for a range of business days. Voided rows are excluded. All sums run in PostgreSQL.
 *   stock = money spent buying stock, other = everything typed in by hand, cash = the part paid in cash (out of the drawer).
 */
export async function expenseSummary(tenantId, range) {
  const { from, to } = businessDateBounds(range);
  const where = { tenantId, voidedAt: null, businessDate: { gte: parseBusinessDay(from), lte: parseBusinessDay(to) } };
  const [bySource, cash, byCategory] = await Promise.all([
    prisma.expense.groupBy({ by: ['source'], where, _sum: { amount: true }, _count: { _all: true } }),
    prisma.expense.aggregate({ where: { ...where, method: 'CASH' }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ['categoryId'], where, _sum: { amount: true } }),
  ]);
  const sum = (source) => decimalToMinor(bySource.find((r) => r.source === source)?._sum.amount);
  const stockMinor = sum('STOCK_PURCHASE'), otherMinor = sum('MANUAL');
  const names = byCategory.length
    ? await prisma.expenseCategory.findMany({ where: { tenantId, id: { in: byCategory.map((c) => c.categoryId) } }, select: { id: true, name: true } })
    : [];
  return {
    total: minorToNumber(stockMinor + otherMinor),
    stock: minorToNumber(stockMinor),
    other: minorToNumber(otherMinor),
    cash: minorToNumber(decimalToMinor(cash._sum.amount)),
    count: bySource.reduce((n, r) => n + r._count._all, 0),
    byCategory: byCategory
      .map((c) => ({ id: c.categoryId, name: names.find((n) => n.id === c.categoryId)?.name ?? 'Unknown', amount: minorToNumber(decimalToMinor(c._sum.amount)) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** One page of expenses (newest first) for a range, plus the summary for the same range. */
export async function listExpenses(tenantId, range, { categoryId, page = 1 } = {}) {
  const { from, to } = businessDateBounds(range);
  const where = { tenantId, businessDate: { gte: parseBusinessDay(from), lte: parseBusinessDay(to) }, ...(categoryId ? { categoryId } : {}) };
  const p = Math.max(1, Math.floor(Number(page)) || 1);
  const [rows, total, summary] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      skip: (p - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { category: { select: { name: true } }, supplier: { select: { name: true } }, createdBy: { select: { name: true } } },
    }),
    prisma.expense.count({ where }),
    expenseSummary(tenantId, range),
  ]);
  return { rows: rows.map(toExpense), total, page: p, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), summary };
}

