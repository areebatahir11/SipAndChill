'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Modal, Pill } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { calcOrder, fromMinor, toMinor } from '@/lib/money.mjs';
import { emptyPayForm, payloadOf, readPayForm } from '@/lib/payment-form.mjs';
import { methodLabel } from '@/lib/payments.mjs';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { money } from '@/lib/format';
import usePrinter from '@/features/printing/usePrinter';
import PrintAttentionBanner from '@/features/printing/PrintAttentionBanner';
import PrintReceiptButton from '@/features/printing/PrintReceiptButton';
import PrinterStatusButton from '@/features/printing/PrinterStatusButton';
import MenuTile, { MENU_GRID } from './MenuTile';
import PaymentPicker from './PaymentPicker';
import ProductArt, { categoryEmoji } from './ProductArt';
import ProductThumb from '@/features/products/ProductThumb';
import PromoBanner from '@/features/promotions/PromoBanner';
import usePromotion from '@/features/promotions/usePromotion';
import { orderDiscountMinor } from '@/lib/promotions/promotions.mjs';

/** crypto.randomUUID needs HTTPS; a tablet on the shop's local network may use plain http. */
function newRequestId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  (globalThis.crypto || { getRandomValues: (a) => a.map(() => Math.floor(Math.random() * 256)) }).getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const STATUS_PILL = { PAID: ['ok', 'Paid'], PARTIAL: ['neutral', 'Partially paid'], UNPAID: ['alert', 'Unpaid'] };
const sum = (rows, key) => fromMinor(rows.reduce((t, r) => t + toMinor(r[key]), 0));

export default function PosCounter({ shopPaper = 80 }) {
  const { can } = useAuth();
  const canPay = can(P.PAYMENTS_RECORD);
  const canPrint = can(P.RECEIPTS_PRINT);

  const [menu, setMenu] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // [{ productId, name, priceMinor, qty, max }]
  const [payForm, setPayForm] = useState(emptyPayForm); // how the customer pays: cash and/or JazzCash / Easypaisa / bank (see PaymentPicker)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // confirmed order, shown in the success dialog
  const [sheet, setSheet] = useState(false); // phones/tablets: the order slides up from the bottom bar
  const promo = usePromotion(menu?.promotion ?? null);
  const printerState = usePrinter();
  const requestId = useRef(newRequestId());

  const loadMenu = useCallback(async () => {
    try { setMenu(await api('/api/pos/products')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  // Same request id = the same order. Any change to the cart or the payment makes it a different order.
  useEffect(() => { requestId.current = newRequestId(); }, [cart, payForm]);

  const add = (p) => {
    setError('');
    setCart((c) => {
      const line = c.find((l) => l.productId === p.id);
      if (line) {
        if (p.maxServings !== null && line.qty >= p.maxServings) { setError(`Only ${p.maxServings} ${p.name} can be made with current stock.`); return c; }
        return c.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...c, { productId: p.id, name: p.name, priceMinor: toMinor(p.price), qty: 1, max: p.maxServings }];
    });
  };
  const setQty = (id, qty) => setCart((c) => c.flatMap((l) => {
    if (l.productId !== id) return [l];
    if (qty < 1) return [];
    if (l.max !== null && qty > l.max) { setError(`Only ${l.max} ${l.name} can be made with current stock.`); return [l]; }
    return [{ ...l, qty: Math.min(qty, 999) }];
  }));

  // Preview only: the server recalculates the discount from its own clock when the order is saved.
  const totals = useMemo(() => {
    const lines = cart.map((l) => ({ unitPriceMinor: l.priceMinor, quantity: l.qty }));
    return calcOrder(lines, orderDiscountMinor(lines, promo.percent));
  }, [cart, promo.percent]);
  // Preview of the payment (change, outstanding, status) and the rows to send. The server re-checks every rule when the order is saved.
  const payRes = useMemo(() => (canPay ? readPayForm(payForm, totals.totalMinor) : { payments: [], pay: null, error: '' }), [canPay, payForm, totals.totalMinor]);

  const catName = useMemo(() => new Map((menu?.categories ?? []).map((c) => [c.id, c.name])), [menu]);
  const inCart = useMemo(() => new Map(cart.map((l) => [l.productId, l.qty])), [cart]);
  const itemCount = cart.reduce((n, l) => n + l.qty, 0);
  const thumbOf = useMemo(() => new Map((menu?.products ?? []).map((p) => [p.id, p])), [menu]);
  const products = useMemo(() => (menu?.products ?? []).filter((p) => (category === 'all' || p.categoryId === category) && p.name.toLowerCase().includes(search.trim().toLowerCase())), [menu, category, search]);

  async function confirm() {
    if (busy || cart.length === 0 || payRes.error) return; // busy guard stops double taps
    setBusy(true); setError('');
    try {
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: { clientRequestId: requestId.current, items: cart.map((l) => ({ productId: l.productId, quantity: l.qty })), payments: canPay ? payloadOf(payRes.payments) : [] },
      });
      setDone({ order }); // figures shown come from the saved order, so a retried (duplicate) request still shows the truth
      // Receipt printer connected on this counter: print straight away (silent, no dialog). A failure never blocks the sale.
      const live = printerState.api.getSnapshot().config;
      if (canPrint && printerState.api.isDirect(live) && live.autoPrint && printerState.api.getSnapshot().link !== 'blocked') printerState.api.printOrder(order.id).catch(() => {});
      setCart([]); setPayForm(emptyPayForm()); setSheet(false); loadMenu();
    } catch (e) {
      setError(e.message); loadMenu(); // stock may have changed: refresh availability
    }
    setBusy(false);
  }


  const cartPanel = (
    <aside aria-label="Current order" className={`${sheet ? 'fixed inset-x-0 bottom-0 z-40 flex max-h-[90vh] rounded-t-[28px]' : 'hidden'} flex-col overflow-hidden bg-night text-blush shadow-2xl lg:sticky lg:top-6 lg:flex lg:max-h-[calc(100vh-3rem)] lg:rounded-[28px]`}>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Current order {itemCount > 0 && <span className="ml-1.5 rounded-full bg-rose px-2.5 py-0.5 align-middle text-sm font-bold text-night">{itemCount}</span>}</h2>
        <button type="button" onClick={() => setSheet(false)} className="grid h-9 w-9 cursor-pointer place-items-center rounded-full bg-slate text-lg lg:hidden" aria-label="Close order">✕</button>
      </div>

      {cart.length === 0 ? (
        <div className="grid justify-items-center gap-2 py-8 text-center">
          <ProductArt name="Fresh juice" className="h-28 w-40 rounded-2xl" />
          <p className="font-semibold text-white">Nothing here yet</p>
          <p className="text-sm text-sand/80">Tap any item on the menu to add it.</p>
        </div>
      ) : (
        <ul className="grid gap-2.5">
          {cart.map((l) => {
            const p = thumbOf.get(l.productId);
            return (
              <li key={l.productId} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-2xl bg-slate/70 p-2">
                <span className="block h-14 w-14 overflow-hidden rounded-xl">
                  <ProductThumb id={l.productId} name={l.name} version={p?.imageVersion} category={catName.get(p?.categoryId) ?? ''} className="h-full w-full" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{l.name}</span>
                  <span className="text-[13px] text-sand/80">{promo.percent ? <><s>{money(fromMinor(l.priceMinor))}</s> {money(fromMinor(promo.salePrice(l.priceMinor)))}</> : money(fromMinor(l.priceMinor))} each</span>
                </span>
                <span className="grid justify-items-end gap-1">
                  <b className="text-white">{money(fromMinor(promo.salePrice(l.priceMinor) * l.qty))}</b>
                  <span className="flex items-center rounded-full bg-night">
                    <button type="button" aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease ${l.name}`} onClick={() => setQty(l.productId, l.qty - 1)} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-lg hover:bg-rose hover:text-night">{l.qty === 1 ? '🗑' : '−'}</button>
                    <span className="min-w-6 text-center font-bold text-white" aria-live="polite">{l.qty}</span>
                    <button type="button" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.productId, l.qty + 1)} className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-lg hover:bg-rose hover:text-night">+</button>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <dl className="mt-4 grid gap-2 border-t border-slate pt-4">
        <Row label="Subtotal" value={money(fromMinor(totals.subtotalMinor))} />
        {totals.discountMinor > 0 && <Row label={`Discount (${promo.promotion.short})`} value={`− ${money(fromMinor(totals.discountMinor))}`} />}
        <div className="flex items-end justify-between gap-3 rounded-2xl bg-rose px-4 py-3 text-night">
          <dt className="font-semibold">Order Total</dt>
          <dd className="text-3xl font-extrabold tracking-tight">{money(fromMinor(totals.totalMinor))}</dd>
        </div>
      </dl>

      {canPay && cart.length > 0 && <div className="mt-4"><PaymentPicker form={payForm} setForm={setPayForm} dueMinor={totals.totalMinor} result={payRes} tone="dark" /></div>}
      {!canPay && cart.length > 0 && <p className="mt-3 text-[13px] text-sand/80">Your role cannot record payments; the order will be saved as unpaid.</p>}

      {error && <Alert className="mt-3">{error}</Alert>}
      </div>
      <div className="grid gap-2 border-t border-slate bg-night px-5 pb-5 pt-3">
        <button type="button" disabled={busy || cart.length === 0 || Boolean(payRes.error)} onClick={confirm}
          className="cursor-pointer rounded-2xl bg-white px-4 py-4 text-lg font-extrabold text-night transition enabled:hover:bg-sand enabled:active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? 'Confirming…' : 'Confirm order'}
        </button>
        {cart.length > 0 && !busy && <button type="button" onClick={() => { setCart([]); setPayForm(emptyPayForm()); setError(''); }} className="cursor-pointer rounded-full py-1.5 text-sm text-sand/80 hover:text-white">Clear order</button>}
      </div>
    </aside>
  );

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">Take Orders</h1>
          <p className="text-graphite">Tap an item to add it. Enter the cash. Confirm.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {canPrint && <PrinterStatusButton shopPaper={shopPaper} />}
        </div>
      </header>
      {canPrint && <PrintAttentionBanner />}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}
      <PromoBanner promotion={promo.promotion} upcoming={promo.upcoming} className="mb-4" />

      <div className="grid items-start gap-6 pb-24 lg:grid-cols-[1fr_390px] lg:pb-0">
        <section aria-label="Menu">
          <div className="sticky top-0 z-10 -mx-1 mb-4 grid gap-3 bg-blush px-1 pb-2 pt-1">
            <div className="relative max-w-md">
              <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              <input type="search" placeholder="Search the menu…" aria-label="Search items" value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-full border-2 border-peach bg-white py-3 pl-12 pr-4 font-medium placeholder:text-graphite/60 focus:border-night focus:outline-none" />
            </div>
            <div className="-mx-2 flex gap-2 overflow-x-auto px-2 py-1" role="group" aria-label="Categories">
              {[{ id: 'all', name: 'All' }, ...(menu?.categories ?? [])].map((c) => (
                <button type="button" key={c.id} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 font-semibold transition-colors ${category === c.id ? 'bg-night text-white' : 'bg-white text-night ring-2 ring-peach hover:ring-rose'}`}>
                  <span aria-hidden className="text-lg leading-none">{c.id === 'all' ? '✨' : categoryEmoji(c.name)}</span>{c.name}
                </button>
              ))}
            </div>
          </div>

          {!menu && !loadError && <p className="text-graphite">Loading menu…</p>}
          {menu && products.length === 0 && (
            <div className="grid justify-items-center gap-2 rounded-3xl bg-white p-10 text-center">
              <ProductArt name="Fresh juice" className="h-32 w-44 rounded-2xl" />
              <p className="font-semibold">{menu.products.length === 0 ? 'No active menu items yet' : 'No items match'}</p>
              <p className="text-graphite">{menu.products.length === 0 ? 'Add items under Menu & Prices.' : 'Try another word or category.'}</p>
            </div>
          )}

          <div className={MENU_GRID}>
            {products.map((p) => <MenuTile key={p.id} p={p} category={catName.get(p.categoryId) ?? ''} promo={promo} qty={inCart.get(p.id) ?? 0} onAdd={add} />)}
          </div>
        </section>

        {sheet && <button type="button" aria-label="Close order" onClick={() => setSheet(false)} className="fixed inset-0 z-30 bg-night/60 lg:hidden" />}
        {cartPanel}
      </div>

      {/* Phones and small tablets: the order lives in a bar at the bottom, tap to open it. */}
      {itemCount > 0 && !sheet && (
        <button type="button" onClick={() => setSheet(true)} className="fixed inset-x-4 bottom-4 z-20 flex cursor-pointer items-center justify-between rounded-full bg-night px-5 py-4 text-white shadow-2xl lg:hidden">
          <span className="flex items-center gap-2.5 font-semibold"><span className="grid h-8 min-w-8 place-items-center rounded-full bg-rose px-2 text-night">{itemCount}</span>View order</span>
          <b className="text-lg">{money(fromMinor(totals.totalMinor))}</b>
        </button>
      )}

      {done && (
        <Modal title={`Order #${done.order.orderNo} confirmed`} onClose={() => setDone(null)}>
          <dl className="grid gap-2">
            {Number(done.order.discount) > 0 && <Row label={done.order.discountLabel ? `Discount (${done.order.discountLabel})` : 'Discount'} value={`− ${money(done.order.discount)}`} />}
            <Row label="Order Total" value={money(done.order.total)} big />
            {done.order.payments.map((p) => <Row key={p.id} label={`${methodLabel(p.method)}${p.reference ? ` (ID ${p.reference})` : ''}`} value={money(p.amountReceived)} />)}
            {done.order.payments.some((p) => p.method === 'CASH') && <Row label="Change Returned" value={money(sum(done.order.payments, 'changeReturned'))} big />}
            {done.order.paymentStatus !== 'PAID' && <Row label="Outstanding Amount" value={money(done.order.outstanding)} />}
            <div className="flex items-center justify-between"><dt className="text-graphite">Payment Status</dt><dd><Pill tone={STATUS_PILL[done.order.paymentStatus][0]}>{STATUS_PILL[done.order.paymentStatus][1]}</Pill></dd></div>
          </dl>
          {canPrint && printerState.direct && printerState.status.message && <p role={printerState.status.state === 'error' ? 'alert' : 'status'} className="mt-4 text-[13.5px] font-medium">{printerState.status.message}</p>}
          <div className="mt-5 flex flex-wrap justify-end gap-2.5">
            <Link href={`/orders/${done.order.id}`} className="inline-flex items-center rounded-[10px] border border-peach px-4 py-2 font-medium hover:bg-blush">View order</Link>
            {canPrint && <PrintReceiptButton orderId={done.order.id} autoprint label={printerState.direct ? 'Print again' : 'Print receipt'} />}
            <Button variant="accent" onClick={() => setDone(null)}>New order</Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Label/value line. Inherits its colours, so it reads on the dark order panel and in the light dialog. */
function Row({ label, value, big }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="opacity-75">{label}</dt>
      <dd className={big ? 'text-xl font-bold' : 'font-semibold'}>{value}</dd>
    </div>
  );
}
