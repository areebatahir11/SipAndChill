'use client';
import { Pill } from '@/components/ui';
import ProductThumb from '@/features/products/ProductThumb';
import { money } from '@/lib/format';
import { fromMinor, toMinor } from '@/lib/money.mjs';

/**
 * Columns are sized by the room the grid actually has (not by the browser width), and never narrower than 10.5rem:
 * so a tile always fits its words, on a small laptop, a 150%-scaled Windows PC or a big counter screen alike.
 */
export const MENU_GRID = 'grid gap-3 grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))]';

/** One tappable menu item. `pics` = this menu has at least one picture: every tile then shows a picture slot, so the grid stays even. */
export default function MenuTile({ p, promo, pics, onAdd }) {
  const soldOut = p.maxServings === 0;
  return (
    <button type="button" disabled={soldOut} onClick={() => onAdd(p)}
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-peach bg-white text-left transition-colors hover:border-rose hover:bg-blush active:bg-peach disabled:cursor-not-allowed disabled:opacity-50">
      {pics && <ProductThumb id={p.id} name={p.name} version={p.imageVersion} className="aspect-[4/3] w-full" />}
      <span className="flex min-h-[96px] flex-1 flex-col justify-between gap-2 p-3">
        <span className="break-words font-semibold leading-snug">{p.name}</span>
        <span className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
          {promo.percent ? (
            <span className="grid leading-tight">
              <s className="text-[13px] text-graphite" aria-label="regular price">{money(p.price)}</s>
              <span className="text-[17px] font-semibold">{money(fromMinor(promo.salePrice(toMinor(p.price))))}</span>
            </span>
          ) : <span className="text-[17px] font-semibold">{money(p.price)}</span>}
          {soldOut ? <Pill tone="alert">Out of stock</Pill> : p.maxServings !== null && p.maxServings <= 5 ? <span className="text-xs text-graphite">{p.maxServings} left</span> : null}
        </span>
      </span>
    </button>
  );
}
