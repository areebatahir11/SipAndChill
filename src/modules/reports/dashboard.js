import { prisma } from '@/lib/db/prisma';
import { BUSINESS_TZ, bucketFor, localDateString, resolveRange } from '@/lib/orders/dates.mjs';

const n = (v) => Number(v ?? 0); // BigInt / Decimal / null -> number (display only; sums were computed in the database)
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null);
const pad = (i) => String(i).padStart(2, '0');

/** Sales figures for one window. Cancelled orders are excluded everywhere here. */
async function salesWindow(tenantId, start, end) {
  const a = await prisma.order.aggregate({
    where: { tenantId, status: 'COMPLETED', createdAt: { gte: start, lt: end } },
    _count: { _all: true },
    _sum: { total: true, amountPaid: true },
  });
  const orders = a._count._all, sales = n(a._sum.total), received = n(a._sum.amountPaid);
  return { orders, sales, received, unpaid: Math.round((sales - received) * 100) / 100, average: orders ? Math.round((sales / orders) * 100) / 100 : 0 };
}

/**
 * Everything the owner's Sales Summary shows for `range`. All sums/groups run in PostgreSQL; only small result
 * sets (a few counts, <= ~60 chart points, top 5, latest 10) come back. Every query is filtered by tenantId.
 *
 *   sales    = sum of totals of non-cancelled orders (by order date)
 *   received = cash actually applied to those orders (never includes change)
 *   unpaid   = sales - received
 */
export async function getDashboard(tenantId, range) {
  const bucket = bucketFor(range.days);
  const where = { tenantId, createdAt: { gte: range.start, lt: range.end } };

  const [current, previous, cancelled, series, best, recent, ingredients] = await Promise.all([
    salesWindow(tenantId, range.start, range.end),
    salesWindow(tenantId, range.prevStart, range.prevEnd),
    prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
    prisma.$queryRaw`
      SELECT date_trunc(${bucket}, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TZ.name}) AS bucket,
             COUNT(*)::int AS orders, COALESCE(SUM("total"), 0) AS sales
      FROM "Order"
      WHERE "tenantId" = ${tenantId} AND "status" = 'COMPLETED' AND "createdAt" >= ${range.start} AND "createdAt" < ${range.end}
      GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw`
      SELECT oi."name" AS name, SUM(oi."quantity")::int AS qty, COALESCE(SUM(oi."lineTotal"), 0) AS revenue
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."tenantId" = ${tenantId} AND o."status" = 'COMPLETED' AND o."createdAt" >= ${range.start} AND o."createdAt" < ${range.end}
      GROUP BY oi."name" ORDER BY qty DESC, revenue DESC LIMIT 5`,
    prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10 }),
    prisma.ingredient.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true, unit: true, stock: true, minStock: true }, orderBy: { name: 'asc' } }),
  ]);

  // Chart: fill empty hours/days with zeros so quiet times are visible. Keys: "YYYY-MM-DDTHH" (hour) or "YYYY-MM-DD".
  const keyOf = (d) => d.toISOString().slice(0, bucket === 'hour' ? 13 : 10);
  const byKey = new Map(series.map((s) => [keyOf(s.bucket), s]));
  const point = (key, s) => ({ key, orders: s?.orders ?? 0, sales: n(s?.sales) });
  let points;
  if (bucket === 'hour') {
    const day = localDateString(range.start);
    points = Array.from({ length: 24 }, (_, h) => point(`${day}T${pad(h)}`, byKey.get(`${day}T${pad(h)}`)));
  } else if (bucket === 'day') {
    points = Array.from({ length: range.days }, (_, i) => {
      const key = localDateString(new Date(range.start.getTime() + i * 864e5));
      return point(key, byKey.get(key));
    });
  } else {
    points = series.map((s) => point(keyOf(s.bucket), s));
  }

  const stock = ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: n(i.stock), minStock: n(i.minStock) }));
  const out = stock.filter((i) => i.stock <= 0);
  const low = stock.filter((i) => i.stock > 0 && i.stock <= i.minStock);

  return {
    range: { preset: range.preset, label: range.label, from: localDateString(range.start), to: localDateString(new Date(range.end.getTime() - 1)), days: range.days },
    current, previous, cancelled,
    change: { sales: pct(current.sales, previous.sales), orders: pct(current.orders, previous.orders) },
    chart: { bucket, points },
    bestSellers: best.map((b) => ({ name: b.name, qty: n(b.qty), revenue: n(b.revenue) })),
    recent: recent.map((o) => ({ id: o.id, orderNo: o.dailyNo, businessDate: o.businessDate.toISOString().slice(0, 10), createdAt: o.createdAt, total: n(o.total), status: o.status, paymentStatus: o.paymentStatus })),
    inventory: { low: low.slice(0, 8), lowCount: low.length, out: out.slice(0, 8), outCount: out.length },
  };
}
