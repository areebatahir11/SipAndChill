'use client';
import { Button, Card } from '@/components/ui';
import { USAGE_RANGES } from '@/lib/platform/usage.mjs';

/** 7 / 30 / 90 days switch shared by the overview and the client page. */
export function RangeTabs({ days, onChange }) {
  return (
    <nav aria-label="Choose a period" className="flex flex-wrap gap-2">
      {USAGE_RANGES.map((d) => (
        <Button key={d} size="sm" variant={days === d ? 'primary' : 'secondary'} aria-current={days === d ? 'page' : undefined} onClick={() => onChange(d)}>
          Last {d} days
        </Button>
      ))}
    </nav>
  );
}

const W = 640, H = 180, PAD = { l: 8, r: 8, t: 20, b: 26 };
const niceMax = (v) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); return Math.ceil(v / p) * p; };
const dayLabel = (key) => new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** One series per chart, same look as the Sales Summary bars. Every bar has a hover title and the busiest day is spelled out below. */
export function DailyBars({ title, points, field, noun }) {
  const top = Math.max(...points.map((p) => p[field]), 0);
  const max = niceMax(top);
  const best = top > 0 ? points.find((p) => p[field] === top) : null;
  const total = points.reduce((s, p) => s + p[field], 0);
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const slot = iw / Math.max(points.length, 1);
  const bw = Math.max(Math.min(slot * 0.62, 24), 2);
  const y = (v) => PAD.t + ih - (v / max) * ih;
  const every = Math.ceil(points.length / 7);
  const summary = `${title}: ${total} in total over ${points.length} days`;

  return (
    <Card>
      <h3 className="mb-2 text-[17px] font-semibold">{title}</h3>
      <figure className="m-0">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} className="h-auto w-full">
          {[0, 0.5, 1].map((f) => <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke="var(--color-peach)" strokeDasharray={f ? '3 4' : undefined} />)}
          {points.map((p, i) => {
            const x = PAD.l + slot * i + (slot - bw) / 2;
            const isBest = best && p.day === best.day;
            return (
              <g key={p.day}>
                <title>{`${dayLabel(p.day)}: ${p[field]} ${noun}`}</title>
                <rect x={x} y={y(p[field])} width={bw} height={Math.max(H - PAD.b - y(p[field]), p[field] > 0 ? 2 : 0)} fill={isBest ? 'var(--color-slate)' : 'var(--color-rose)'} rx="3" />
                {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-graphite)">{dayLabel(p.day)}</text>}
              </g>
            );
          })}
        </svg>
        <figcaption className="mt-1 text-[13px] text-graphite">
          {best ? <>Busiest day: <b className="text-night">{dayLabel(best.day)}</b> ({best[field]} {noun}). Hover a bar for details.</> : `No ${noun} in this period.`}
        </figcaption>
      </figure>
    </Card>
  );
}

/** A number with a bar behind it, so the biggest feature is obvious at a glance (the number is always printed too). */
export function UseBar({ value, max }) {
  const pct = max > 0 ? Math.max(Math.round((value / max) * 100), value > 0 ? 3 : 0) : 0;
  return (
    <div className="flex min-w-[140px] items-center gap-2.5">
      <div className="h-2.5 flex-1 rounded-full bg-blush" aria-hidden="true"><div className="h-full rounded-full bg-slate" style={{ width: `${pct}%` }} /></div>
      <b className="w-12 text-right tabular-nums">{value.toLocaleString('en-PK')}</b>
    </div>
  );
}
