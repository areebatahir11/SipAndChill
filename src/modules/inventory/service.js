import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';

const DUPLICATE = new HttpError(409, 'An item with this name already exists.', 'DUPLICATE');
const num = (d) => (d == null ? null : Number(d));
const include = { supplier: { select: { id: true, name: true } } };

const toItem = (i) => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  unit: i.unit,
  stock: num(i.stock),
  minStock: num(i.minStock),
  costPerUnit: num(i.costPerUnit),
  expiryDate: i.expiryDate ? i.expiryDate.toISOString().slice(0, 10) : null,
  supplierId: i.supplierId,
  supplierName: i.supplier?.name ?? null,
  isActive: i.isActive,
  lowStock: num(i.stock) <= num(i.minStock),
});

const toMovement = (m) => ({
  id: m.id, type: m.type, quantity: num(m.quantity), unitCost: num(m.unitCost), note: m.note,
  createdAt: m.createdAt, userName: m.user?.name ?? null,
});

/** The only way to reach an item: scoped by tenantId (a foreign id yields 404). */
async function findItem(tenantId, id, db = prisma) {
  const item = await db.ingredient.findFirst({ where: { id, tenantId }, include });
  if (!item) throw new HttpError(404, 'Item not found.', 'NOT_FOUND');
  return item;
}

/** A supplier link must point at this tenant's own supplier. */
async function assertSupplier(tenantId, supplierId) {
  if (!supplierId) return;
  const s = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId }, select: { id: true } });
  if (!s) throw new HttpError(400, 'Unknown supplier.', 'BAD_SUPPLIER');
}

const toDate = (v) => (v ? new Date(`${v}T00:00:00.000Z`) : null);

export async function listItems(tenantId, { kind } = {}) {
  const rows = await prisma.ingredient.findMany({
    where: { tenantId, ...(kind ? { kind } : {}) },
    include,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
  return rows.map(toItem);
}

export async function createItem(auth, { openingStock = 0, expiryDate, ...data }) {
  await assertSupplier(auth.tenantId, data.supplierId);
  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.ingredient.create({
        data: { ...data, tenantId: auth.tenantId, expiryDate: toDate(expiryDate), stock: openingStock },
        include,
      });
      if (openingStock > 0) {
        await tx.stockMovement.create({
          data: { tenantId: auth.tenantId, ingredientId: created.id, type: 'OPENING', quantity: openingStock, unitCost: data.costPerUnit, userId: auth.user.id },
        });
      }
      return created;
    });
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'inventory.item_created', entity: 'Ingredient', entityId: item.id, metadata: { name: item.name } });
    return toItem(item);
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

/** Stock is NOT editable here; it only changes through recordMovement so the ledger stays complete. */
export async function updateItem(auth, id, { expiryDate, ...data }) {
  await findItem(auth.tenantId, id);
  if (data.supplierId !== undefined) await assertSupplier(auth.tenantId, data.supplierId);
  try {
    const item = await prisma.ingredient.update({
      where: { id },
      data: { ...data, ...(expiryDate !== undefined ? { expiryDate: toDate(expiryDate) } : {}) },
      include,
    });
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'inventory.item_updated', entity: 'Ingredient', entityId: id, metadata: { ...data, expiryDate } });
    return toItem(item);
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

/** Items with history are archived (kept for reports); untouched items are really deleted. */
export async function deleteItem(auth, id) {
  const item = await findItem(auth.tenantId, id);
  const history = await prisma.stockMovement.count({ where: { ingredientId: id, tenantId: auth.tenantId, NOT: { type: 'OPENING' } } });
  const inRecipes = await prisma.recipeItem.count({ where: { ingredientId: id, tenantId: auth.tenantId } });
  const archived = history > 0 || inRecipes > 0; // recipes reference the item, so it must be kept
  if (archived) await prisma.ingredient.update({ where: { id }, data: { isActive: false } });
  else await prisma.ingredient.delete({ where: { id } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: archived ? 'inventory.item_archived' : 'inventory.item_deleted', entity: 'Ingredient', entityId: id, metadata: { name: item.name } });
  return { archived };
}

export async function listMovements(tenantId, id, limit = 50) {
  await findItem(tenantId, id);
  const rows = await prisma.stockMovement.findMany({
    where: { tenantId, ingredientId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { name: true } } },
  });
  return rows.map(toMovement);
}

/**
 * Records a purchase, wastage or stock count. Runs in one transaction and only applies the
 * change if the stock is still what we read (optimistic check), so two cashiers cannot corrupt it.
 */
export async function recordMovement(auth, id, { type, quantity, unitCost, note }) {
  const result = await prisma.$transaction(async (tx) => {
    const item = await findItem(auth.tenantId, id, tx);
    if (!item.isActive) throw new HttpError(400, 'This item is archived.', 'ARCHIVED');
    const before = Number(item.stock);

    let delta;
    if (type === 'PURCHASE') delta = quantity;
    else if (type === 'WASTAGE') delta = -quantity;
    else delta = quantity - before; // ADJUSTMENT: quantity = counted stock

    const after = Math.round((before + delta) * 1000) / 1000;
    if (after < 0) throw new HttpError(400, `Not enough stock. Only ${before} ${item.unit} available.`, 'INSUFFICIENT_STOCK');
    if (delta === 0) throw new HttpError(400, 'Counted stock matches the system. Nothing to adjust.', 'NO_CHANGE');

    const applied = await tx.ingredient.updateMany({
      where: { id, tenantId: auth.tenantId, stock: item.stock },
      data: { stock: after, ...(type === 'PURCHASE' && unitCost !== undefined ? { costPerUnit: unitCost } : {}) },
    });
    if (applied.count === 0) throw new HttpError(409, 'Stock changed while you were editing. Please try again.', 'CONFLICT');

    await tx.stockMovement.create({
      data: { tenantId: auth.tenantId, ingredientId: id, type, quantity: delta, unitCost: type === 'PURCHASE' ? unitCost : undefined, note, userId: auth.user.id },
    });
    return findItem(auth.tenantId, id, tx);
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: `inventory.${type.toLowerCase()}`, entity: 'Ingredient', entityId: id, metadata: { quantity, unitCost, note } });
  return toItem(result);
}
