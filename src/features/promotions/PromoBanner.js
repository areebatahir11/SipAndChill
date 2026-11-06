import { PROMO_TZ_LABEL } from './labels';

/** "20% OFF on the whole menu · 6 Nov – 8 Nov". Status is stated in words, not colour alone. */
export default function PromoBanner({ promotion, upcoming, className = '' }) {
  const p = promotion || upcoming;
  if (!p) return null;
  const fmt = (iso) => new Date(iso).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', timeZone: PROMO_TZ_LABEL });
  const last = new Date(new Date(p.endsAt).getTime() - 1).toISOString(); // last day, inclusive
  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-night px-4 py-3 text-sand ${className}`}>
      <span className="rounded-full bg-sand px-3 py-0.5 text-sm font-bold text-night">{p.short}</span>
      <b className="text-[15px]">{p.label}</b>
      <span className="text-[13.5px] opacity-90">
        {promotion ? 'Valid' : 'Starts'} {fmt(p.startsAt)} – {fmt(last)}{promotion ? ' · applied automatically to every order' : ''}
      </span>
    </div>
  );
}
