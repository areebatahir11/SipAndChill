import { Button, ButtonLink, Input } from '@/components/ui';
import { PRESETS, PRESET_LABELS } from '@/lib/orders/dates.mjs';

/** Server-rendered, reused by the Sales Summary and Expenses (`basePath`); `keep` carries other filters (e.g. category) across. Presets are links, "pick dates" is a plain GET form. One date = that single day. */
export default function RangeFilter({ range, basePath = '/', keep = {} }) {
  return (
    <div className="mb-6 grid gap-3">
      <nav aria-label="Choose a period" className="flex flex-wrap gap-2">
        {PRESETS.filter((p) => p !== 'custom').map((p) => (
          <ButtonLink key={p} href={`${basePath}?${new URLSearchParams({ ...keep, range: p })}`} size="sm" variant={range.preset === p ? 'primary' : 'secondary'} aria-current={range.preset === p ? 'page' : undefined}>{PRESET_LABELS[p]}</ButtonLink>
        ))}
      </nav>
      <form action={basePath} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="range" value="custom" />
        {Object.entries(keep).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="grid gap-1 text-sm font-medium text-slate">Pick any date<Input type="date" name="from" required defaultValue={range.from} className="w-44" /></label>
        <label className="grid gap-1 text-sm font-medium text-slate">Until (optional)<Input type="date" name="to" defaultValue={range.from === range.to ? '' : range.to} className="w-44" /></label>
        <Button type="submit" variant={range.preset === 'custom' ? 'primary' : 'secondary'}>Show</Button>
      </form>
    </div>
  );
}
