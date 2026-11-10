import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { calcOrder, calcPayment, fromMinor, toMinor, MAX_MINOR } from '@/lib/money.mjs';
import { activePromotion, currentOrUpcoming, discountLabel, orderDiscountMinor } from '@/lib/promotions/promotions.mjs';
import { consumption, fromMilli, maxServings, mergeLines, toMilli } from '@/lib/orders/recipe.mjs';
import { businessDay, parseBusinessDay } from '@/lib/orders/dates.mjs';
import { ATTENTION_GRACE_MS, ATTENTION_WINDOW_MS, nextPrintState, PRINT_STATUS } from '@/lib/orders/print-status.mjs';

const TX = { maxWait: 5000, timeout: 15000 };
const PAGE_SIZE = 20;
const MAX_ORDER_NO = 2_147_483_647; // Order.dailyNo is a 32-bit INT; a larger search number would make the database query fail
const dec = (d) => d.toFixed(2);

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------
const orderInclude = {
  items: { orderBy: { name: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
};

const toOrder = (o) => ({
  id: o.id,
  orderNo: o.dailyNo, // the number people see: restarts at 1 every business day
  businessDate: o.businessDate ? o.businessDate.toISOString().slice(0, 10) : null,
  seqNo: o.orderNo, // lifetime sequence (internal, never reused)
  status: o.status,
  paymentStatus: o.paymentStatus,
  subtotal: dec(o.subtotal),
  discount: dec(o.discount),
  discountLabel: o.discountLabel ?? null,
  total: dec(o.total),
  amountPaid: dec(o.amountPaid),
  outstanding: fromMinor(Math.max(toMinor(dec(o.total)) - toMinor(dec(o.amountPaid)), 0)),
  cashierName: o.cashierName,
  cancelledAt: o.cancelledAt,
  cancelReason: o.cancelReason,
  createdAt: o.createdAt,
  printStatus: o.printStatus,
  printAttempts: o.printAttempts,
  lastPrintAt: o.lastPrintAt,
  printConfirmedAt: o.printConfirmedAt,
  items: o.items?.map((i) => ({ id: i.id, productId: i.productId, name: i.name, unitPrice: dec(i.unitPrice), quantity: i.quantity, lineTotal: dec(i.lineTotal) })),
  payments: o.payments?.map((p) => ({ id: p.id, method: p.method, amountReceived: dec(p.amountReceived), amountApplied: dec(p.amountApplied), changeReturned: dec(p.changeReturned), createdAt: p.createdAt })),
});

/** Cashiers (no reports permission) only ever see the orders they took themselves. */
const scope = (auth) => ({ tenantId: auth.tenantId, ...(hasPermission(auth.permissions, P.REPORTS_VIEW) ? {} : { cashierId: auth.user.id }) });

async function findOrder(auth, id, db = prisma) {
  const o = await db.order.findFirst({ where: { id, ...scope(auth) }, include: orderInclude });
  if (!o) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
  return o;
}

// ---------------------------------------------------------------------------
// POS menu
// ---------------------------------------------------------------------------
/** Active menu for the counter, with how many units current stock allows (no ingredient detail leaked). */
export async function listPosProducts(tenantId) {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { tenantId, isActive: true },
      include: { recipeItems: { include: { ingredient: { select: { stock: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return {
    categories,
    // Announced promotion (running, or starting later). The browser re-checks the dates every minute; the server re-checks when the order is saved.
    promotion: currentOrUpcoming(),
    products: products.map((p) => {
      const recipe = p.recipeItems.map((r) => ({ ingredientId: r.ingredientId, quantityMilli: toMilli(r.quantity) }));
      const stock = new Map(p.recipeItems.map((r) => [r.ingredientId, toMilli(r.ingredient.stock)]));
      const servings = maxServings(recipe, stock);
      return { id: p.id, name: p.name, price: dec(p.price), categoryId: p.categoryId, maxServings: servings === null ? null : Math.max(servings, 0) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Create order
// ---------------------------------------------------------------------------
/**
 * Confirms a sale. ONE transaction: validates the menu, prices every line from the database
 * (client prices are never read), takes the next order number, saves order + item snapshots + payment,
 * deducts ingredients atomically and writes one stock movement per ingredient.
 *
 * Idempotent: the same clientRequestId returns the order already saved, so a retried request
 * can never create a second order or deduct stock twice.
 *
 * Stock safety: each ingredient is decremented with `UPDATE ... WHERE stock >= need`, so two
 * simultaneous orders cannot drive stock below zero (the DB also has CHECK stock >= 0).
 */
export async function createOrder(auth, { clientRequestId, items, amountReceived }) {
  if (amountReceived > 0 && !hasPermission(auth.permissions, P.PAYMENTS_RECORD)) {
    throw new HttpError(403, 'You are not allowed to record payments.', 'FORBIDDEN');
  }
  const existing = await prisma.order.findUnique({ where: { tenantId_clientRequestId: { tenantId: auth.tenantId, clientRequestId } }, include: orderInclude });
  if (existing) return { order: toOrder(existing), duplicate: true };

  const lines = mergeLines(items);
  try {
    const order = await prisma.$transaction(async (tx) => {
      // 1. Menu: every product must be this tenant's, and active.
      const products = await tx.product.findMany({
        where: { tenantId: auth.tenantId, id: { in: lines.map((l) => l.productId) } },
        include: { recipeItems: true },
      });
      const byId = new Map(products.map((p) => [p.id, p]));
      for (const l of lines) {
        const p = byId.get(l.productId);
        if (!p) throw new HttpError(400, 'One of the items is not on the menu any more.', 'BAD_PRODUCT');
        if (!p.isActive) throw new HttpError(400, `${p.name} is not available.`, 'INACTIVE_PRODUCT');
      }

      // 2. Totals from DATABASE prices, in integer paisa.
      const priced = lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitPriceMinor: toMinor(dec(byId.get(l.productId).price)) }));
      // Promotion: decided HERE from the server clock and the dates in lib/promotions (the browser's idea of the discount is never trusted).
      const promo = activePromotion(new Date());
      const calc = calcOrder(priced, promo ? orderDiscountMinor(priced, promo.percent) : 0);
      // The total columns are DECIMAL(12,2): refuse an absurd order with a clear message instead of a database error.
      if (calc.totalMinor > MAX_MINOR) throw new HttpError(400, 'This order total is too large. Please reduce the quantities.', 'TOTAL_TOO_LARGE');
      const pay = calcPayment(calc.totalMinor, 0, amountReceived);

      // 3. Order numbers. The upsert row-locks this tenant's settings until commit, so concurrent orders are serialised.
      //    orderNo = lifetime sequence (never reused). dailyNo = 1,2,3... within today's business day (Asia/Karachi), restarting at 1 each new day.
      const now = new Date();
      const businessDate = businessDay(now);
      const settings = await tx.tenantSettings.upsert({ where: { tenantId: auth.tenantId }, update: { nextOrderNo: { increment: 1 } }, create: { tenantId: auth.tenantId, nextOrderNo: 2 } });
      const orderNo = settings.nextOrderNo - 1;
      const last = await tx.order.aggregate({ where: { tenantId: auth.tenantId, businessDate }, _max: { dailyNo: true } }); // cancelled orders keep their number too
      const dailyNo = (last._max.dailyNo ?? 0) + 1;

      // 4. Order + item snapshots + payment.
      const created = await tx.order.create({
        data: {
          tenantId: auth.tenantId, orderNo, businessDate, dailyNo, createdAt: now, clientRequestId,
          status: 'COMPLETED', paymentStatus: pay.status,
          subtotal: fromMinor(calc.subtotalMinor), discount: fromMinor(calc.discountMinor), discountLabel: calc.discountMinor > 0 ? discountLabel(promo) : null, total: fromMinor(calc.totalMinor),
          amountPaid: fromMinor(pay.paidMinor),
          cashierId: auth.user.id, cashierName: auth.user.name,
          items: { create: calc.items.map((i) => ({ tenantId: auth.tenantId, productId: i.productId, name: byId.get(i.productId).name, unitPrice: fromMinor(i.unitPriceMinor), quantity: i.quantity, lineTotal: fromMinor(i.lineTotalMinor) })) },
          ...(amountReceived > 0 ? { payments: { create: [{ tenantId: auth.tenantId, method: 'CASH', amountReceived: fromMinor(amountReceived), amountApplied: fromMinor(pay.appliedMinor), changeReturned: fromMinor(pay.changeMinor), userId: auth.user.id }] } } : {}),
        },
        include: orderInclude,
      });

      // 5. Ingredient deduction (sorted ids = same lock order everywhere, no deadlocks).
      const recipes = new Map(products.map((p) => [p.id, p.recipeItems.map((r) => ({ ingredientId: r.ingredientId, quantityMilli: toMilli(r.quantity) }))]));
      const need = [...consumption(lines, recipes)].sort(([a], [b]) => (a < b ? -1 : 1));
      for (const [ingredientId, milli] of need) {
        const qty = fromMilli(milli);
        const done = await tx.ingredient.updateMany({ where: { id: ingredientId, tenantId: auth.tenantId, stock: { gte: qty } }, data: { stock: { decrement: qty } } });
        if (done.count === 0) {
          const ing = await tx.ingredient.findFirst({ where: { id: ingredientId, tenantId: auth.tenantId }, select: { name: true, stock: true, unit: true } });
          throw new HttpError(409, `Not enough ${ing?.name ?? 'stock'}: need ${qty} ${ing?.unit ?? ''}, only ${ing ? Number(ing.stock) : 0} left.`.replace(/ +/g, ' '), 'INSUFFICIENT_STOCK');
        }
        await tx.stockMovement.create({ data: { tenantId: auth.tenantId, ingredientId, type: 'USAGE', quantity: `-${qty}`, note: `Order #${dailyNo} (${businessDate.toISOString().slice(0, 10)})`, userId: auth.user.id, orderId: created.id } });
      }
      return created;
    }, TX);

    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'order.created', entity: 'Order', entityId: order.id, metadata: { orderNo: order.orderNo, dailyNo: order.dailyNo, businessDate: order.businessDate.toISOString().slice(0, 10), total: dec(order.total), discount: dec(order.discount), paymentStatus: order.paymentStatus } });
    return { order: toOrder(order), duplicate: false };
  } catch (e) {
    // Two identical requests raced: the loser hits the unique key, rolls back, and returns the winner's order.
    if (isUniqueViolation(e)) {
      const winner = await prisma.order.findUnique({ where: { tenantId_clientRequestId: { tenantId: auth.tenantId, clientRequestId } }, include: orderInclude });
      if (winner) return { order: toOrder(winner), duplicate: true };
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// History, detail
// ---------------------------------------------------------------------------
export async function listOrders(auth, { page = 1, filter = 'all', q = '', date = '' } = {}) {
  const where = {
    ...scope(auth),
    ...(date ? { businessDate: parseBusinessDay(date) } : {}), // one business day (the number below restarts every day)
    ...(filter === 'cancelled' ? { status: 'CANCELLED' }
      : filter === 'print' ? { status: 'COMPLETED', printStatus: { in: [PRINT_STATUS.PROBLEM, PRINT_STATUS.DIALOG_OPENED] } } // receipts that failed or nobody confirmed
      : filter === 'all' ? {}
      : { status: 'COMPLETED', paymentStatus: filter.toUpperCase() }),
    ...(q ? { dailyNo: Number(q) > MAX_ORDER_NO ? -1 : Number(q) } : {}), // -1 = matches nothing (no such order number)
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({ where, orderBy: [{ businessDate: 'desc' }, { dailyNo: 'desc' }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.order.count({ where }),
  ]);
  return { orders: rows.map(toOrder), total, page, pageSize: PAGE_SIZE, pages: Math.max(Math.ceil(total / PAGE_SIZE), 1) };
}

export async function getOrder(auth, id) {
  return toOrder(await findOrder(auth, id));
}

// ---------------------------------------------------------------------------
// Receipt print tracking (browser printing). Touches ONLY the four print columns of one order:
// a print or reprint never creates an order, never changes payments, totals or stock.
// ---------------------------------------------------------------------------
const printView = (o) => ({ id: o.id, orderNo: o.dailyNo, businessDate: o.businessDate ? o.businessDate.toISOString().slice(0, 10) : null, printStatus: o.printStatus, printAttempts: o.printAttempts, lastPrintAt: o.lastPrintAt, printConfirmedAt: o.printConfirmedAt });
const PRINT_SELECT = { id: true, dailyNo: true, businessDate: true, printStatus: true, printAttempts: true, lastPrintAt: true, printConfirmedAt: true };

/** event: 'sent' (printer accepted the data) | 'opened' (browser print window) | 'confirmed' (a person says it printed) | 'failed'. */
export async function recordPrintEvent(auth, id, event) {
  const where = { id, ...scope(auth) }; // same tenant + cashier scope as viewing the order: one business can never touch another's orders
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await prisma.order.findFirst({ where, select: PRINT_SELECT });
    if (!current) throw new HttpError(404, 'Order not found.', 'NOT_FOUND');
    const { printAttempts, ...change } = nextPrintState(current, event);
    // Optimistic guard on the status we just read: two tabs reporting at once cannot overwrite each other's decision.
    const done = await prisma.order.updateMany({
      where: { ...where, printStatus: current.printStatus },
      data: { ...change, ...(printAttempts !== undefined ? { printAttempts: { increment: 1 } } : {}) },
    });
    if (done.count === 1) {
      if (event === 'confirmed' || event === 'failed') await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: `order.receipt_${event}`, entity: 'Order', entityId: id, metadata: { dailyNo: current.dailyNo, businessDate: current.businessDate.toISOString().slice(0, 10) } });
      return printView(await prisma.order.findFirst({ where, select: PRINT_SELECT }));
    }
  }
  throw new HttpError(409, 'This order was just updated. Please try again.', 'CONFLICT');
}

/**
 * Recent completed orders whose receipt was never confirmed: print failed / "did not print", or the dialog was opened
 * and nobody confirmed it for more than a couple of minutes. Cashiers only see their own orders (scope()).
 */
export async function listPrintAttention(auth) {
  const now = Date.now();
  const where = {
    ...scope(auth), status: 'COMPLETED', lastPrintAt: { gte: new Date(now - ATTENTION_WINDOW_MS) },
    OR: [{ printStatus: PRINT_STATUS.PROBLEM }, { printStatus: PRINT_STATUS.DIALOG_OPENED, lastPrintAt: { lt: new Date(now - ATTENTION_GRACE_MS) } }],
  };
  const [count, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { lastPrintAt: 'desc' }, take: 5, select: PRINT_SELECT }),
  ]);
  return { count, orders: rows.map(printView) };
}

// ---------------------------------------------------------------------------
// Later payment on an unpaid / partially paid order
// ---------------------------------------------------------------------------
export async function addPayment(auth, id, receivedMinor) {
  const order = await prisma.$transaction(async (tx) => {
    const o = await findOrder(auth, id, tx);
    if (o.status !== 'COMPLETED') throw new HttpError(409, 'A cancelled order cannot take payments.', 'CANCELLED');
    const total = toMinor(dec(o.total));
    const before = toMinor(dec(o.amountPaid));
    if (before >= total) throw new HttpError(409, 'This order is already fully paid.', 'ALREADY_PAID');
    const pay = calcPayment(total, before, receivedMinor);

    // Optimistic guard: only applies if nobody else paid in the meantime.
    const applied = await tx.order.updateMany({
      where: { id, tenantId: auth.tenantId, status: 'COMPLETED', amountPaid: dec(o.amountPaid) },
      data: { amountPaid: fromMinor(pay.paidMinor), paymentStatus: pay.status },
    });
    if (applied.count === 0) throw new HttpError(409, 'This order was just updated. Please reload and try again.', 'CONFLICT');
    await tx.payment.create({ data: { tenantId: auth.tenantId, orderId: id, method: 'CASH', amountReceived: fromMinor(receivedMinor), amountApplied: fromMinor(pay.appliedMinor), changeReturned: fromMinor(pay.changeMinor), userId: auth.user.id } });
    return { order: await findOrder(auth, id, tx), pay };
  }, TX);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'order.payment_recorded', entity: 'Order', entityId: id, metadata: { received: fromMinor(receivedMinor), change: fromMinor(order.pay.changeMinor) } });
  return { order: toOrder(order.order), changeReturned: fromMinor(order.pay.changeMinor) };
}

// ---------------------------------------------------------------------------
// Cancel
// ---------------------------------------------------------------------------
/** Cancelled orders drop out of sales. Stock goes back only if `restock` (a juice already made may be wasted). */
export async function cancelOrder(auth, id, { reason, restock }) {
  await prisma.$transaction(async (tx) => {
    const o = await findOrder(auth, id, tx);
    const flipped = await tx.order.updateMany({ where: { id, tenantId: auth.tenantId, status: 'COMPLETED' }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason } });
    if (flipped.count === 0) throw new HttpError(409, 'This order is already cancelled.', 'ALREADY_CANCELLED');
    if (restock) {
      // Restore exactly what THIS order deducted (not today's recipe, which may have changed).
      const used = await tx.stockMovement.findMany({ where: { tenantId: auth.tenantId, orderId: id, type: 'USAGE' }, orderBy: { ingredientId: 'asc' } });
      for (const m of used) {
        const qty = m.quantity.negated().toString();
        await tx.ingredient.update({ where: { id: m.ingredientId }, data: { stock: { increment: qty } } });
        await tx.stockMovement.create({ data: { tenantId: auth.tenantId, ingredientId: m.ingredientId, type: 'ORDER_CANCEL', quantity: qty, note: `Order #${o.dailyNo} (${o.businessDate.toISOString().slice(0, 10)}) cancelled`, userId: auth.user.id, orderId: id } });
      }
    }
  }, TX);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'order.cancelled', entity: 'Order', entityId: id, metadata: { reason, restock } });
  return getOrder(auth, id);
}
