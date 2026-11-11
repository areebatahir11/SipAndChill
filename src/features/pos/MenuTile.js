'use client';
import ProductThumb from '@/features/products/ProductThumb';
import { money } from '@/lib/format';
import { fromMinor, toMinor } from '@/lib/money.mjs';

/**
 * Columns are sized by the room the grid actually has (not by the browser width), and never narrower than 9.5rem (10.5rem from tablet size up; two tiles per row on a phone):
 * so a tile always fits its words, on a small laptop, a 150%-scaled Windows PC or a big counter screen alike.
 */
export const MENU_GRID = 'grid gap-3 sm:gap-4 grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]';

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
      className={`group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-3xl bg-white text-left shadow-[0_2px_0_var(--color-peach)] ring-2 transition duration-150 enabled:hover:-translate-y-0.5 enabled:hover:shadow-[0_8px_20px_-6px_rgba(34,40,49,.28)] enabled:active:translate-y-0 enabled:active:scale-[.97] disabled:cursor-not-allowed ${qty ? 'ring-night' : 'ring-transparent'}`}>
      <span className="relative block overflow-hidden">
        <ProductThumb id={p.id} name={p.name} version={p.imageVersion} category={category}
          className={`aspect-[4/3] w-full transition-transform duration-300 group-hover:scale-105 ${soldOut ? 'grayscale' : ''}`} />
        {promo.percent > 0 && !soldOut && <span className="absolute left-2.5 top-2.5 rounded-full bg-night px-2.5 py-0.5 text-xs font-bold text-sand">{promo.promotion?.short ?? 'Offer'}</span>}
        {low && <span className="absolute bottom-2.5 left-2.5 rounded-full bg-white/95 px-2.5 py-0.5 text-xs font-semibold text-night">Only {p.maxServings} left</span>}
        {soldOut && <span className="absolute inset-0 grid place-items-center bg-night/55 text-base font-bold text-white">Out of stock</span>}
        {qty > 0 && <span key={qty} className="pop absolute right-2.5 top-2.5 grid h-8 min-w-8 place-items-center rounded-full bg-night px-2 text-sm font-bold text-white shadow-lg" aria-hidden>{qty}</span>}
      </span>
      <span className="flex items-end justify-between gap-2 p-3.5 pt-3">
        <span className="grid min-w-0 gap-0.5">
          <span className="break-words text-[15px] font-semibold leading-snug">{p.name}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold tracking-tight">{price}</span>
            {promo.percent > 0 && <s className="text-[13px] text-graphite/70" aria-label="regular price">{money(p.price)}</s>}
          </span>
        </span>
        {!soldOut && <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-night text-2xl font-light leading-none text-white transition-colors group-hover:bg-rose group-hover:text-night">+</span>}
      </span>
    </button>
  );
}
