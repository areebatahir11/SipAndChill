// Pure rules for the PearlSolutions "Usage Analytics" screens. No database or framework code, so it is unit-tested.
//
// Everything here is a COUNT of what a business did (sign-ins, orders, expenses...). Never amounts, item names, customer
// or staff details: a client's shop data stays private to that client (see modules/platform/clients.js).
// The numbers come from rows the app already writes (AuditLog, Order, Payment), so nothing new is stored or tracked.
import { BUSINESS_TZ, localDateString } from '../orders/dates.mjs';

const DAY = 864e5;

export const USAGE_RANGES = Object.freeze([7, 30, 90]);
export const DEFAULT_USAGE_DAYS = 30;

export const LOGIN_ACTION = 'auth.login';
export const ORDER_ACTION = 'order.created';

// A client counts as "active" if anything happened within this many days; "quiet" up to QUIET_DAYS; after that "inactive".
export const ACTIVE_DAYS = 7;
export const QUIET_DAYS = 30;

/**
 * The features PearlSolutions can compare. `actions` are AuditLog action codes the app already records for that feature;
 * `metric` is a count taken from the order / payment tables for things the audit log does not record.
 * Only actions listed here are ever read, so PearlSolutions' own actions ("platform.*", "menu.imported") can never
 * be mistaken for something the client did.
 */
export const USAGE_FEATURES = Object.freeze([
  { key: 'orders', label: 'Take Orders', hint: 'Sales rung up at the counter', actions: ['order.created'] },
  { key: 'orderCare', label: 'Orders & Receipts', hint: 'Payments added later, orders cancelled', actions: ['order.payment_recorded', 'order.cancelled'] },
  { key: 'printing', label: 'Receipt printing', hint: 'Orders sent to the receipt printer', metric: 'printed' },
  { key: 'onlinePay', label: 'Online payments', hint: 'JazzCash, Easypaisa and bank transfers', metric: 'online' },
  { key: 'discounts', label: 'Discounts', hint: 'Orders sold with a discount', metric: 'discounted' },
  { key: 'expenses', label: 'Expenses', hint: 'Spending written down, mistakes voided', actions: ['expense.created', 'expense.voided', 'expense.category_created', 'expense.category_updated'] },
  { key: 'stock', label: 'Stock', hint: 'Ingredients and supplies added or edited', actions: ['inventory.item_created', 'inventory.item_updated'] },
  { key: 'purchases', label: 'Stock purchases', hint: 'Stock bought and recorded', actions: ['inventory.purchase_recorded'] },
  { key: 'suppliers', label: 'Suppliers', hint: 'Suppliers added, edited, removed', actions: ['supplier.created', 'supplier.updated', 'supplier.deleted'] },
  { key: 'team', label: 'My Team', hint: 'Staff added, changed, passwords reset', actions: ['staff.created', 'staff.updated', 'staff.password_reset'] },
  { key: 'settings', label: 'Shop Settings & pictures', hint: 'Shop details, menu pictures', actions: ['settings.updated', 'product.image_changed', 'product.image_removed'] },
]);

/** Every AuditLog action the usage screens read: sign-ins plus the actions of the features above. */
export const USAGE_AUDIT_ACTIONS = Object.freeze([
  LOGIN_ACTION,
  ...USAGE_FEATURES.flatMap((f) => f.actions ?? []),
]);

/** ?days= from the URL: only the offered ranges are accepted, anything else becomes the default. */
export function parseUsageDays(raw) {
  const n = Number(raw);
  return USAGE_RANGES.includes(n) ? n : DEFAULT_USAGE_DAYS;
}

/**
 * The period shown: the last `days` calendar days of the shop day (Pakistan time), ending with today.
 * start is inclusive, end is exclusive, both UTC instants (same convention as lib/orders/dates.mjs).
 */
export function usageWindow(days, now = new Date()) {
  const today = localDateString(now);
  const todayStart = new Date(Date.parse(`${today}T00:00:00Z`) - BUSINESS_TZ.offsetMin * 60_000);
  const start = new Date(todayStart.getTime() - (days - 1) * DAY);
  const end = new Date(todayStart.getTime() + DAY);
  return { days, start, end, from: localDateString(start), to: today };
}

/** One entry per day of the window (YYYY-MM-DD), zeros where nothing happened, so quiet days show in the chart. */
export function fillDays(from, days, rows) {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10);
    const r = byDay.get(day);
    return { day, logins: Number(r?.logins ?? 0), orders: Number(r?.orders ?? 0) };
  });
}

/** Active / Quiet / Inactive / Never used, from the last time anyone of the business did anything. */
export function activityStatus(lastActiveAt, now = new Date()) {
  if (!lastActiveAt) return { code: 'NEVER', label: 'Never used', tone: 'alert' };
  const days = Math.floor((now.getTime() - new Date(lastActiveAt).getTime()) / DAY);
  if (days <= ACTIVE_DAYS) return { code: 'ACTIVE', label: 'Active', tone: 'ok' };
  if (days <= QUIET_DAYS) return { code: 'QUIET', label: 'Quiet', tone: 'off' };
  return { code: 'INACTIVE', label: 'Inactive', tone: 'alert' };
}

const latest = (...dates) => dates.filter(Boolean).map((d) => new Date(d)).reduce((a, b) => (!a || b > a ? b : a), null);
const num = (v) => Number(v ?? 0);

/**
 * Turns the raw rows read from the database into the report both screens show. Pure: the same rows always give
 * the same report.
 *
 *   tenants     [{ id, name, slug, businessType, createdAt }]  the businesses to report on
 *   actionRows  [{ tenantId, action, count, lastAt }]          AuditLog rows grouped by business and action, inside the window
 *   orderRows   [{ tenantId, printed, discounted }]            counts of orders inside the window
 *   paymentRows [{ tenantId, online }]                         non-cash payments inside the window
 *   members     [{ tenantId, active, lastLoginAt }]            every login of each business (active = membership and user both on)
 *   daily       [{ day, logins, orders }]                      per shop day, only days that had something
 */
export function buildUsageReport({ tenants, window, actionRows, orderRows = [], paymentRows = [], members, daily }, now = new Date()) {
  const actionsOf = new Map(); // tenantId -> Map(action -> { count, lastAt })
  for (const r of actionRows) {
    if (!actionsOf.has(r.tenantId)) actionsOf.set(r.tenantId, new Map());
    actionsOf.get(r.tenantId).set(r.action, { count: num(r.count), lastAt: r.lastAt });
  }
  const orderOf = new Map(orderRows.map((r) => [r.tenantId, r]));
  const payOf = new Map(paymentRows.map((r) => [r.tenantId, r]));
  const membersOf = new Map();
  for (const m of members) {
    if (!membersOf.has(m.tenantId)) membersOf.set(m.tenantId, []);
    membersOf.get(m.tenantId).push(m);
  }

  const clients = tenants.map((t) => {
    const acts = actionsOf.get(t.id) ?? new Map();
    const people = membersOf.get(t.id) ?? [];
    const logins = num(acts.get(LOGIN_ACTION)?.count);
    const lastLoginAt = latest(...people.map((p) => p.lastLoginAt));
    const startMs = window.start.getTime();

    const features = {};
    let lastActionAt = null;
    for (const f of USAGE_FEATURES) {
      let count = 0;
      if (f.actions) {
        for (const a of f.actions) {
          const hit = acts.get(a);
          if (!hit) continue;
          count += hit.count;
          lastActionAt = latest(lastActionAt, hit.lastAt);
        }
      } else if (f.metric === 'online') count = num(payOf.get(t.id)?.online);
      else count = num(orderOf.get(t.id)?.[f.metric]);
      features[f.key] = count;
    }
    const actions = Object.values(features).reduce((a, b) => a + b, 0);
    const top = USAGE_FEATURES.map((f) => ({ f, count: features[f.key] })).filter((x) => x.count > 0).sort((a, b) => b.count - a.count)[0];
    const lastActiveAt = latest(lastLoginAt, lastActionAt);

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      businessType: t.businessType,
      createdAt: t.createdAt,
      logins,
      users: people.filter((p) => p.active).length,
      activeUsers: people.filter((p) => p.lastLoginAt && new Date(p.lastLoginAt).getTime() >= startMs).length, // signed in at least once in the window
      lastLoginAt,
      lastActiveAt,
      orders: features.orders,
      actions,
      features,
      topFeature: top ? { key: top.f.key, label: top.f.label, count: top.count } : null,
      activity: activityStatus(lastActiveAt, now),
    };
  }).sort((a, b) => b.actions - a.actions || b.logins - a.logins || a.name.localeCompare(b.name));

  const features = USAGE_FEATURES.map((f) => {
    const using = clients.filter((c) => c.features[f.key] > 0).length;
    return {
      key: f.key,
      label: f.label,
      hint: f.hint,
      count: clients.reduce((sum, c) => sum + c.features[f.key], 0),
      clients: using,
      adoption: clients.length ? Math.round((using / clients.length) * 100) : 0,
    };
  }).sort((a, b) => b.count - a.count || b.clients - a.clients);

  const loggedIn = clients.filter((c) => c.logins > 0).length;
  return {
    range: { days: window.days, from: window.from, to: window.to },
    generatedAt: now.toISOString(),
    totals: {
      clients: clients.length,
      loggedIn,
      silent: clients.length - loggedIn,
      logins: clients.reduce((s, c) => s + c.logins, 0),
      activeUsers: clients.reduce((s, c) => s + c.activeUsers, 0),
      orders: clients.reduce((s, c) => s + c.orders, 0),
      actions: clients.reduce((s, c) => s + c.actions, 0),
    },
    features,
    clients,
    daily: fillDays(window.from, window.days, daily),
  };
}
