'use client';
import ProductThumb from '@/features/products/ProductThumb';
import { money } from '@/lib/format';
import { fromMinor, toMinor } from '@/lib/money.mjs';

/**
 * Columns are sized by the room the grid actually has (not by the browser width), and never narrower than 8.5rem (9.25rem from tablet size up; two tiles per row on a phone):
 * so a tile always fits its words, on a small laptop, a 150%-scaled Windows PC or a big counter screen alike.
 */
export const MENU_GRID = 'grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(9.25rem,1fr))]';

/**
 * One tappable menu item: a big picture (the shop's photo, or a drawn illustration), the name, the price, and a count badge
 * that shows how many are already in the order, so the cashier never has to look away from the menu.
 */
export default function MenuTile({ p, category, promo, qty, onAdd }) {
  const soldOut = p.maxServings === 0;
  const low = !soldOut && p.maxServings !== null && p.maxServings <= 5;
  const price = promo.percent ? money(fromMinor(promo.salePrice(toMinor(p.price)))) : money(p.price);
  return (
    <button type="button" disabled={soldOut} onClick={() => onAdd(p)}
      aria-label={`Add ${p.name}, ${price}${qty ? `, ${qty} in order` : ''}`}
      className={`group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-2xl bg-white text-left shadow-[0_2px_0_var(--color-peach)] ring-2 transition duration-150 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_8px_20px_-6px_rgba(34,40,49,.28)] enabled:active:translate-y-0 enabled:active:scale-[.97] disabled:cursor-not-allowed ${qty ? 'ring-night' : 'ring-transparent'}`}>
      <span className="relative block overflow-hidden">
        <ProductThumb id={p.id} name={p.name} version={p.imageVersion} category={category}
          className={`aspect-[16/11] w-full transition-transform duration-300 group-hover:scale-105 ${soldOut ? 'grayscale' : ''}`} />
        {promo.percent > 0 && !soldOut && <span className="absolute left-2 top-2 rounded-full bg-night px-2 py-0.5 text-[11px] font-bold text-sand">{promo.promotion?.short ?? 'Offer'}</span>}
        {low && <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold text-night">Only {p.maxServings} left</span>}
        {soldOut && <span className="absolute inset-0 grid place-items-center bg-night/55 text-base font-bold text-white">Out of stock</span>}
        {qty > 0 && <span key={qty} className="pop absolute right-2 top-2 grid h-7 min-w-7 place-items-center rounded-full bg-night px-1.5 text-xs font-bold text-white shadow-lg" aria-hidden>{qty}</span>}
      </span>
      <span className="grid min-w-0 gap-1.5 p-2.5">
        <span className="line-clamp-2 min-w-0 break-words text-[13.5px] font-semibold leading-tight">{p.name}</span>
        <span className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <span className="whitespace-nowrap text-[15px] font-extrabold tracking-tight">{price}</span>
            {promo.percent > 0 && <s className="whitespace-nowrap text-[12px] text-graphite/70" aria-label="regular price">{money(p.price)}</s>}
          </span>
          {!soldOut && <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-night text-xl font-light leading-none text-white transition-colors group-hover:bg-rose group-hover:text-night">+</span>}
        </span>
      </span>
    </button>
  );
}
