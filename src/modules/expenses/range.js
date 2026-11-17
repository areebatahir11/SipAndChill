import { resolveRange } from '@/lib/orders/dates.mjs';

/** Same presets and rules as the Sales Summary. A bad custom range falls back to today and says why. */
export function rangeFromParams(get) {
  try {
    return { range: resolveRange(get('range') ?? 'today', { from: get('from') ?? undefined, to: get('to') || get('from') || undefined }), error: '' };
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    return { range: resolveRange('today'), error: e.message };
  }
}
