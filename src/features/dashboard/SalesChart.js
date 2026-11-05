import { money } from '@/lib/format';

const W = 640, H = 240, PAD = { l: 8, r: 8, t: 22, b: 30 };
const MAX_LABELLED_BARS = 10; // print the amount above each bar only while there is room

const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
const compact = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}k` : String(v));

const date = (key) => new Date(`${key.slice(0, 10)}T00:00:00Z`);
const fmt = (d, o) => d.toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' });

/** Full label (tooltip, "best" line) and short label (under the bar). */
function labels(key, bucket, count) {
  if (bucket === 'hour') {
    const h = Number(key.slice(11, 13));
    const text = `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;
    return { full: text, short: h % 3 === 0 ? text : '' };
  }
  const d = date(key);
  if (bucket === 'month') { const t = fmt(d, { month: 'short', year: '2-digit' }); return { full: t, short: t }; }
  if (bucket === 'week') { const t = `Week of ${fmt(d, { day: 'numeric', month: 'short' })}`; return { full: t, short: fmt(d, { day: 'numeric', month: 'short' }) }; }
  const full = fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
  return { full, short: count <= MAX_LABELLED_BARS ? fmt(d, { weekday: 'short', day: 'numeric' }) : fmt(d, { day: 'numeric', month: 'short' }) };
}

/**
 * One series, on purpose: sales. Rose bars, the best one in dark. Dependency-free SVG; every bar has a
 * hover/readable <title>, and the best bar is also spelled out in words under the chart.
 */
export default function SalesChart({ points, bucket }) {
  const count = points.length;
  const top = Math.max(...points.map((p) => p.sales), 0);
  const max = niceMax(top);
  const best = top > 0 ? points.find((p) => p.sales === top) : null;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const slot = iw / Math.max(count, 1);
  const bw = Math.max(Math.min(slot * 0.62, 44), 3);
  const y = (v) => PAD.t + ih - (v / max) * ih;
  const every = bucket === 'hour' ? 1 : Math.ceil(count / 8);
  const withAmounts = count <= MAX_LABELLED_BARS;
  const text = `Sales by ${bucket}: ` + points.map((p) => `${labels(p.key, bucket, count).full} ${money(p.sales)}`).join('; ');

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={text} className="h-auto w-full">
        {[0, 0.5, 1].map((f) => <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-peach)" strokeDasharray={f ? '3 4' : undefined} />)}
        {points.map((p, i) => {
          const x = PAD.l + slot * i + (slot - bw) / 2;
          const l = labels(p.key, bucket, count);
          const isBest = best && p.key === best.key;
          return (
            <g key={p.key}>
              <title>{`${l.full}: ${money(p.sales)} from ${p.orders} order${p.orders === 1 ? '' : 's'}`}</title>
              <rect x={x} y={y(p.sales)} width={bw} height={Math.max(H - PAD.b - y(p.sales), p.sales > 0 ? 2 : 0)} fill={isBest ? 'var(--color-slate)' : 'var(--color-rose)'} rx="4" />
              {withAmounts && p.sales > 0 && <text x={x + bw / 2} y={y(p.sales) - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--color-graphite)">{compact(p.sales)}</text>}
              {i % every === 0 && l.short && <text x={x + bw / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--color-graphite)">{l.short}</text>}
            </g>
          );
        })}
      </svg>
      {best && (
        <figcaption className="mt-1 text-[13px] text-graphite">
          <i className="mr-1.5 inline-block size-2.5 rounded-sm bg-slate" />
          Best {bucket === 'hour' ? 'hour' : bucket === 'day' ? 'day' : bucket}: <b className="text-night">{labels(best.key, bucket, count).full}</b> ({money(best.sales)}). Hover a bar to see its details.
        </figcaption>
      )}
    </figure>
  );
}
