// Menu-wide promotions. Pure ESM (server, client and tests share one implementation).
//
// A promotion is a percentage off every menu item between two BUSINESS-DAY dates (Pakistan time, UTC+5), both days
// inclusive. The SERVER decides whether it is running (createOrder calls activePromotion(new Date())); the browser
// only uses the same functions to show prices, so a customer can never get a discount the server did not grant.
//
// To run a new offer later, add one entry to PROMOTIONS. No database change is needed.

import { BUSINESS_TZ } from '../orders/dates.mjs';

export const PROMOTIONS = [
  {
    id: 'MENU20_NOV2026',
    label: '20% OFF on the whole menu',
    short: '20% OFF',
    percent: 20,
    startDate: '2026-11-06', // first day, inclusive
    endDate: '2026-11-08',   // last day, inclusive (3 days in total)
  },
];

const DAY = 864e5;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' (business-day calendar date) -> UTC instant of that day's local midnight. */
function dayStart(s, off = BUSINESS_TZ.offsetMin) {
  const m = DATE_RE.exec(s);
  if (!m) throw new RangeError(`Invalid promotion date: ${s}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - off * 60000);
}

/** Adds the exact [startsAt, endsAt) instants (endsAt = midnight AFTER the last day) to a promotion. */
export function withWindow(promo) {
  const startsAt = dayStart(promo.startDate);
  const endsAt = new Date(dayStart(promo.endDate).getTime() + DAY);
  return { ...promo, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

/** Is this promotion (with startsAt/endsAt) running at `now`? */
export function isRunning(promo, now = new Date()) {
  if (!promo) return false;
  const t = new Date(now).getTime();
  return t >= new Date(promo.startsAt).getTime() && t < new Date(promo.endsAt).getTime();
}

/** The promotion running right now, or null. If several overlap, the biggest percentage wins (never stacked). */
export function activePromotion(now = new Date(), list = PROMOTIONS) {
  const running = list.map(withWindow).filter((p) => isRunning(p, now));
  if (running.length === 0) return null;
  return running.reduce((best, p) => (p.percent > best.percent ? p : best));
}

/** The promotion the screen should announce: the running one, else the next one that has not ended yet, else null. */
export function currentOrUpcoming(now = new Date(), list = PROMOTIONS) {
  const live = activePromotion(now, list);
  if (live) return live;
  const t = new Date(now).getTime();
  const upcoming = list.map(withWindow).filter((p) => new Date(p.startsAt).getTime() > t).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return upcoming[0] ?? null;
}

/** Discount on ONE unit, in paisa, rounded half-up to the nearest paisa. Integer maths only. */
export function unitDiscountMinor(priceMinor, percent) {
  return Math.floor((priceMinor * percent + 50) / 100);
}

/** Price of one unit after the discount, in paisa. */
export function salePriceMinor(priceMinor, percent) {
  return priceMinor - unitDiscountMinor(priceMinor, percent);
}

/**
 * Discount for a whole order. lines: [{ unitPriceMinor, quantity }].
 * Computed per UNIT, so the sale price shown on the menu x quantity always equals what is charged (no paisa drift).
 */
export function orderDiscountMinor(lines, percent) {
  if (!percent) return 0;
  return lines.reduce((s, l) => s + unitDiscountMinor(l.unitPriceMinor, percent) * l.quantity, 0);
}

/** Receipt / order label, e.g. "20% OFF". */
export const discountLabel = (promo) => (promo ? promo.short : null);
