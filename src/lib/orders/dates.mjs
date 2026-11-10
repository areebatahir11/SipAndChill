// Dashboard date ranges. The business day is Pakistan time (UTC+5, no DST).
// A range is [start, end) in UTC instants, so "Today" = local midnight to next local midnight.

export const BUSINESS_TZ = { name: 'Asia/Karachi', offsetMin: 300 };
export const PRESETS = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'prevMonth', 'custom'];
export const PRESET_LABELS = { today: 'Today', yesterday: 'Yesterday', last7: 'Last 7 days', last30: 'Last 30 days', thisMonth: 'This month', prevMonth: 'Last month', custom: 'Custom range' };
const DAY = 864e5;
const MAX_DAYS = 366;

// local calendar date -> UTC instant of that local midnight
const localMidnight = (y, m, d, off) => new Date(Date.UTC(y, m, d) - off * 60000);
const parts = (date, off) => { const l = new Date(date.getTime() + off * 60000); return { y: l.getUTCFullYear(), m: l.getUTCMonth(), d: l.getUTCDate() }; };

/** Local date string YYYY-MM-DD for an instant. */
export const localDateString = (date, off = BUSINESS_TZ.offsetMin) => new Date(date.getTime() + off * 60000).toISOString().slice(0, 10);

/** The shop's business day for an instant, as the UTC-midnight Date Prisma stores in a DATE column. */
export const businessDay = (date = new Date(), off = BUSINESS_TZ.offsetMin) => new Date(`${localDateString(date, off)}T00:00:00.000Z`);

/** Parses a YYYY-MM-DD string into the same DATE value, or null if it is not a real calendar day (e.g. 2026-02-31). */
export function parseBusinessDay(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === s ? d : null;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short label for a business day (YYYY-MM-DD): "Today", "Yesterday", "9 Nov" (year added when it is not this year). */
export function dayLabel(day, now = new Date()) {
  if (!day) return '';
  const today = localDateString(now);
  if (day === today) return 'Today';
  if (day === localDateString(new Date(now.getTime() - 864e5))) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return `${d} ${MON[m - 1]}${String(y) === today.slice(0, 4) ? '' : ` ${y}`}`;
}

/** Long label for list headings: "Monday, 9 Nov 2026". */
export function longDayLabel(day) {
  if (!day) return '';
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function parseDay(s, off) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const probe = new Date(Date.UTC(y, mo, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo || probe.getUTCDate() !== d) return null; // e.g. 2026-02-31
  return localMidnight(y, mo, d, off);
}

/**
 * resolveRange('last7', {}, now) -> { preset, label, start, end, days, prevStart, prevEnd }
 * Unknown presets fall back to today. Custom: from/to are inclusive YYYY-MM-DD; invalid input throws RangeError.
 * The comparison period is the same-length window immediately before `start`.
 */
export function resolveRange(preset = 'today', { from, to } = {}, now = new Date(), off = BUSINESS_TZ.offsetMin) {
  const t = parts(now, off);
  const today = localMidnight(t.y, t.m, t.d, off);
  const tomorrow = new Date(today.getTime() + DAY);
  let start, end;

  switch (preset) {
    case 'yesterday': start = new Date(today.getTime() - DAY); end = today; break;
    case 'last7': start = new Date(today.getTime() - 6 * DAY); end = tomorrow; break;
    case 'last30': start = new Date(today.getTime() - 29 * DAY); end = tomorrow; break;
    case 'thisMonth': start = localMidnight(t.y, t.m, 1, off); end = tomorrow; break;
    case 'prevMonth': start = localMidnight(t.y, t.m - 1, 1, off); end = localMidnight(t.y, t.m, 1, off); break;
    case 'custom': {
      const a = parseDay(from, off), b = parseDay(to, off);
      if (!a || !b) throw new RangeError('Choose a valid start and end date.');
      if (b < a) throw new RangeError('The end date is before the start date.');
      end = new Date(b.getTime() + DAY);
      if ((end - a) / DAY > MAX_DAYS) throw new RangeError(`Choose a range of at most ${MAX_DAYS} days.`);
      start = a; break;
    }
    default: preset = 'today'; start = today; end = tomorrow;
  }
  const ms = end.getTime() - start.getTime();
  return { preset, label: PRESET_LABELS[preset], start, end, days: Math.round(ms / DAY), prevStart: new Date(start.getTime() - ms), prevEnd: start };
}

/** Chart granularity so long ranges stay readable. A single day is shown hour by hour. */
export const bucketFor = (days) => (days <= 1 ? 'hour' : days <= 35 ? 'day' : days <= 140 ? 'week' : 'month');
