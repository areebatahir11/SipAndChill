import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';
import { businessDay } from '@/lib/orders/dates.mjs';
import { fromMinor, purchaseTotals } from '@/lib/expenses.mjs';
import { stockPurchaseCategory } from '@/modules/expenses/service';

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
 *
 * A PURCHASE that carries `amountPaid` (integer paisa) also records the money spent as an Expense, in the SAME
 * transaction and linked to the stock movement: stock and money can never disagree, and nothing is typed twice.
 * A PURCHASE without `amountPaid` only adds stock (no money is recorded), exactly as before.
 */
export async function recordMovement(auth, id, { type, quantity, unitCost, note, amountPaid, method = 'CASH' }) {
  const paid = type === 'PURCHASE' && amountPaid ? amountPaid : null;
  const categoryId = paid ? await stockPurchaseCategory(auth.tenantId) : null;

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

    const expense = paid
      ? await tx.expense.create({
          data: {
            tenantId: auth.tenantId, categoryId, source: 'STOCK_PURCHASE', amount: fromMinor(paid), method, businessDate: businessDay(),
            supplierId: item.supplierId, createdById: auth.user.id, note: `Stock purchase: ${item.name} ${quantity} ${item.unit}`,
          },
        })
      : null;

    await tx.stockMovement.create({
      data: { tenantId: auth.tenantId, ingredientId: id, type, quantity: delta, unitCost: type === 'PURCHASE' ? unitCost : undefined, note, userId: auth.user.id, expenseId: expense?.id },
    });
    return findItem(auth.tenantId, id, tx);
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: `inventory.${type.toLowerCase()}`, entity: 'Ingredient', entityId: id, metadata: { quantity, unitCost, note, ...(paid ? { amountPaid: fromMinor(paid), method } : {}) } });
  return toItem(result);
}

/**
 * One shopping trip: several items bought together and paid in one go (milk + chocolate + sugar...).
 * One transaction: every item's stock goes up with its own stock movement, and ONE Expense records the money paid.
 * If anything fails (an archived item, stock changed under us), nothing is saved.
 * `amountPaid` is integer paisa; blank means exactly the total of the lines.
 */
export async function recordPurchase(auth, { supplierId, invoiceNo, businessDate, method = 'CASH', amountPaid, items }) {
  const ids = items.map((i) => i.ingredientId);
  if (new Set(ids).size !== ids.length) throw new HttpError(400, 'Each item can be added only once. Combine the quantities.', 'DUPLICATE_ITEM');
  await assertSupplier(auth.tenantId, supplierId);

  let totals;
  try { totals = purchaseTotals(items); } catch (e) {
    if (e instanceof RangeError) throw new HttpError(400, e.message, 'BAD_AMOUNT');
    throw e;
  }
  const paidMinor = amountPaid ?? totals.totalMinor;
  if (paidMinor <= 0) throw new HttpError(400, 'Enter the cost of the items, or the total amount paid, so the money spent is recorded.', 'NO_AMOUNT');

  const categoryId = await stockPurchaseCategory(auth.tenantId);
  const day = new Date(`${businessDate}T00:00:00.000Z`);
  const ordered = [...items].sort((a, b) => (a.ingredientId < b.ingredientId ? -1 : 1)); // same lock order for everyone: no deadlocks

  const { expense, names } = await prisma.$transaction(async (tx) => {
    const found = [];
    for (const line of ordered) found.push([line, await findItem(auth.tenantId, line.ingredientId, tx)]);
    const archived = found.find(([, item]) => !item.isActive);
    if (archived) throw new HttpError(400, `${archived[1].name} is archived. Remove it from the purchase.`, 'ARCHIVED');

    const created = await tx.expense.create({
      data: {
        tenantId: auth.tenantId, categoryId, source: 'STOCK_PURCHASE', amount: fromMinor(paidMinor), method, businessDate: day,
        supplierId: supplierId || null, createdById: auth.user.id,
        note: `Stock purchase: ${items.length} item${items.length > 1 ? 's' : ''}${invoiceNo ? `, invoice ${invoiceNo}` : ''}`,
      },
    });
    for (const [line, item] of found) {
      const after = Math.round((Number(item.stock) + line.quantity) * 1000) / 1000;
      const applied = await tx.ingredient.updateMany({
        where: { id: item.id, tenantId: auth.tenantId, stock: item.stock },
        data: { stock: after, ...(line.unitCost > 0 ? { costPerUnit: line.unitCost } : {}) },
      });
      if (applied.count === 0) throw new HttpError(409, `Stock of ${item.name} changed while you were editing. Please try again.`, 'CONFLICT');
      await tx.stockMovement.create({
        data: {
          tenantId: auth.tenantId, ingredientId: item.id, type: 'PURCHASE', quantity: line.quantity, unitCost: line.unitCost > 0 ? line.unitCost : undefined,
          note: invoiceNo ? `Invoice ${invoiceNo}` : undefined, userId: auth.user.id, expenseId: created.id,
        },
      });
    }
    return { expense: created, names: found.map(([, item]) => item.name) };
  });

  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'inventory.purchase_recorded', entity: 'Expense', entityId: expense.id, metadata: { items: names, amountPaid: fromMinor(paidMinor), method, invoiceNo } });
  return { expenseId: expense.id, items: items.length, amountPaid: Number(fromMinor(paidMinor)) };
}
