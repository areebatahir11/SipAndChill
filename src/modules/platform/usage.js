import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { BUSINESS_TZ } from '@/lib/orders/dates.mjs';
import { TENANT_STATUS } from '@/lib/platform/constants.mjs';
import { LOGIN_ACTION, ORDER_ACTION, USAGE_AUDIT_ACTIONS, buildUsageReport, usageWindow } from '@/lib/platform/usage.mjs';

// Usage analytics for PearlSolutions: how often each client signs in and which features they use.
// Read-only and built from rows the app already writes (AuditLog, Order, Payment, Membership), so there is no new
// table, no tracking code in the shop screens and past usage shows up straight away.
// COUNTS ONLY: this file never selects an amount, a product or customer name, a note, or audit `metadata`.
// Five small grouped queries run in parallel, so the page costs the shared database very little.

/** `tenantId` set = one business (client detail page); null = every business (overview). */
async function collect(tenantId, window) {
  const { start, end } = window;
  const only = tenantId ? Prisma.sql`AND "tenantId" = ${tenantId}` : Prisma.sql`AND "tenantId" IS NOT NULL`;
  const actions = Prisma.join(USAGE_AUDIT_ACTIONS);

  const [actionRows, orderRows, paymentRows, members, daily] = await Promise.all([
    // Sign-ins and feature actions, per business.
    prisma.$queryRaw`
      SELECT "tenantId", "action", COUNT(*)::int AS count, MAX("createdAt") AS "lastAt"
      FROM "AuditLog"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "action" IN (${actions}) ${only}
      GROUP BY "tenantId", "action"`,
    // Receipt printing and discounts are not in the audit log: they are read from the orders themselves.
    prisma.$queryRaw`
      SELECT "tenantId",
             COUNT(*) FILTER (WHERE "printAttempts" > 0)::int AS printed,
             COUNT(*) FILTER (WHERE "discount" > 0)::int AS discounted
      FROM "Order"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "status" = 'COMPLETED' ${only}
      GROUP BY "tenantId"`,
    prisma.$queryRaw`
      SELECT "tenantId", COUNT(*)::int AS online
      FROM "Payment"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "method" <> 'CASH' ${only}
      GROUP BY "tenantId"`,
    // One row per login account (a few per business). lastLoginAt is stamped on every sign-in, so it answers
    // "who signed in during this period" exactly, and "when did they last sign in" even beyond it.
    prisma.membership.findMany({
      where: tenantId ? { tenantId } : { tenant: { status: TENANT_STATUS.ACTIVE } },
      select: { tenantId: true, isActive: true, user: { select: { isActive: true, lastLoginAt: true } } },
    }),
    // Sign-ins and orders per shop day (Pakistan time), same day-bucketing as the Sales Summary.
    prisma.$queryRaw`
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${BUSINESS_TZ.name}, 'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE "action" = ${LOGIN_ACTION})::int AS logins,
             COUNT(*) FILTER (WHERE "action" = ${ORDER_ACTION})::int AS orders
      FROM "AuditLog"
      WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "action" IN (${LOGIN_ACTION}, ${ORDER_ACTION}) ${only}
      GROUP BY 1 ORDER BY 1`,
  ]);

  return {
    actionRows,
    orderRows,
    paymentRows,
    daily,
    members: members.map((m) => ({ tenantId: m.tenantId, active: m.isActive && m.user.isActive, lastLoginAt: m.user.lastLoginAt })),
  };
}

/** Every running client (approved and not suspended; suspended ones cannot sign in, so they are left out). */
export async function getUsageOverview(days) {
  const window = usageWindow(days);
  const [tenants, suspended, rows] = await Promise.all([
    prisma.tenant.findMany({
      where: { status: TENANT_STATUS.ACTIVE, isActive: true },
      select: { id: true, name: true, slug: true, businessType: true, createdAt: true },
    }),
    prisma.tenant.count({ where: { status: TENANT_STATUS.ACTIVE, isActive: false } }),
    collect(null, window),
  ]);
  return { ...buildUsageReport({ tenants, window, ...rows }), suspended };
}

/** The same report for one client: its numbers, its feature list and its daily sign-ins / orders. */
export async function getClientUsage(tenantId, days) {
  const window = usageWindow(days);
  const [tenant, rows] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true, businessType: true, createdAt: true } }),
    collect(tenantId, window),
  ]);
  if (!tenant) throw new HttpError(404, 'Client not found.', 'NOT_FOUND');
  const report = buildUsageReport({ tenants: [tenant], window, ...rows });
  const [client] = report.clients;
  return { range: report.range, generatedAt: report.generatedAt, client, features: report.features, daily: report.daily };
}
