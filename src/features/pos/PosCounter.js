'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Input, Modal, PageHeader, Pill } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { calcOrder, calcPayment, fromMinor, toMinor } from '@/lib/money.mjs';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { money } from '@/lib/format';
import usePrinter from '@/features/printing/usePrinter';
import PrintAttentionBanner from '@/features/printing/PrintAttentionBanner';
import PrintReceiptButton from '@/features/printing/PrintReceiptButton';
import PrinterStatusButton from '@/features/printing/PrinterStatusButton';
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
const safeMinor = (s) => { try { return toMinor(s === '' ? 0 : s); } catch { return null; } };

export default function PosCounter({ shopPaper = 80 }) {
  const { can } = useAuth();
  const canPay = can(P.PAYMENTS_RECORD);
  const canPrint = can(P.RECEIPTS_PRINT);

  const [menu, setMenu] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]); // [{ productId, name, priceMinor, qty, max }]
  const [received, setReceived] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // confirmed order, shown in the success dialog
  const promo = usePromotion(menu?.promotion ?? null);
  const printerState = usePrinter();
  const requestId = useRef(newRequestId());

  const loadMenu = useCallback(async () => {
    try { setMenu(await api('/api/pos/products')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  // Same request id = the same order. Any change to the cart or the cash makes it a different order.
  useEffect(() => { requestId.current = newRequestId(); }, [cart, received]);

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
  const receivedMinor = canPay ? safeMinor(received) : 0;
  const pay = receivedMinor === null ? null : calcPayment(totals.totalMinor, 0, receivedMinor);

  const products = useMemo(() => (menu?.products ?? []).filter((p) => (category === 'all' || p.categoryId === category) && p.name.toLowerCase().includes(search.trim().toLowerCase())), [menu, category, search]);

  async function confirm() {
    if (busy || cart.length === 0 || receivedMinor === null) return; // busy guard stops double taps
    setBusy(true); setError('');
    try {
      const { order } = await api('/api/orders', {
        method: 'POST',
        body: { clientRequestId: requestId.current, items: cart.map((l) => ({ productId: l.productId, quantity: l.qty })), amountReceived: canPay ? (received || '0') : '0' },
      });
      setDone({ order }); // figures shown come from the saved order, so a retried (duplicate) request still shows the truth
      // Receipt printer connected on this counter: print straight away (silent, no dialog). A failure never blocks the sale.
      const live = printerState.api.getSnapshot().config;
      if (canPrint && printerState.api.isDirect(live) && live.autoPrint && printerState.api.getSnapshot().link !== 'blocked') printerState.api.printOrder(order.id).catch(() => {});
      setCart([]); setReceived(''); loadMenu();
    } catch (e) {
      setError(e.message); loadMenu(); // stock may have changed: refresh availability
    }
    setBusy(false);
  }

  const quick = canPay && cart.length > 0 ? [['Exact', totals.totalMinor], ...[500, 1000, 5000].map((v) => [String(v), v * 100])] : [];

  return (
    <>
      <PageHeader title="Take Orders" sub="Tap items to build the order, enter the cash, confirm.">
        {canPrint && <PrinterStatusButton shopPaper={shopPaper} />}
      </PageHeader>
      {canPrint && <PrintAttentionBanner />}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}
      <PromoBanner promotion={promo.promotion} upcoming={promo.upcoming} className="mb-4" />

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_390px]">
        <section aria-label="Menu">
          <div className="mb-3 flex flex-wrap gap-2">
            <Input className="max-w-[240px]" type="search" placeholder="Search items…" aria-label="Search items" value={search} onChange={(e) => setSearch(e.target.value)} />
            {[{ id: 'all', name: 'All' }, ...(menu?.categories ?? [])].map((c) => (
              <Button key={c.id} size="sm" variant={category === c.id ? 'primary' : 'secondary'} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>{c.name}</Button>
            ))}
          </div>

          {!menu && !loadError && <p className="text-graphite">Loading menu…</p>}
          {menu && products.length === 0 && <Card className="text-center text-graphite">{menu.products.length === 0 ? 'No active menu items yet. Add items under Menu & Prices.' : 'No items match.'}</Card>}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => {
              const soldOut = p.maxServings === 0;
              return (
                <button key={p.id} type="button" disabled={soldOut} onClick={() => add(p)}
                  className="flex min-h-[96px] flex-col justify-between rounded-2xl border border-peach bg-white p-3 text-left transition-colors hover:border-rose hover:bg-blush active:bg-peach disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="font-semibold leading-snug">{p.name}</span>
                  <span className="mt-2 flex items-end justify-between gap-2">
                    {promo.percent ? (
                      <span className="grid leading-tight">
                        <s className="text-[13px] text-graphite" aria-label="regular price">{money(p.price)}</s>
                        <span className="text-[17px] font-semibold">{money(fromMinor(promo.salePrice(toMinor(p.price))))}</span>
                      </span>
                    ) : <span className="text-[17px] font-semibold">{money(p.price)}</span>}
                    {soldOut ? <Pill tone="alert">Out of stock</Pill> : p.maxServings !== null && p.maxServings <= 5 ? <span className="text-xs text-graphite">{p.maxServings} left</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <Card className="lg:sticky lg:top-6" aria-label="Current order">
          <h2 className="mb-3 text-lg font-semibold">Current order</h2>
          {cart.length === 0 ? <p className="py-8 text-center text-graphite">No items yet. Tap an item to add it.</p> : (
            <ul className="divide-y divide-blush">
              {cart.map((l) => (
                <li key={l.productId} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 py-2.5">
                  <span className="font-medium">{l.name}</span>
                  <b className="text-right">{money(fromMinor(promo.salePrice(l.priceMinor) * l.qty))}</b>
                  <span className="text-[13px] text-graphite">
                    {promo.percent ? <><s>{money(fromMinor(l.priceMinor))}</s> {money(fromMinor(promo.salePrice(l.priceMinor)))}</> : money(fromMinor(l.priceMinor))} each
                  </span>
                  <span className="flex items-center justify-end gap-1.5">
                    <Button size="sm" aria-label={`Decrease ${l.name}`} onClick={() => setQty(l.productId, l.qty - 1)}>−</Button>
                    <span className="min-w-8 text-center font-semibold" aria-live="polite">{l.qty}</span>
                    <Button size="sm" aria-label={`Increase ${l.name}`} onClick={() => setQty(l.productId, l.qty + 1)}>+</Button>
                    <Button size="sm" variant="danger" aria-label={`Remove ${l.name}`} onClick={() => setQty(l.productId, 0)}>Remove</Button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <dl className="mt-3 grid gap-1.5 border-t border-peach pt-3">
            <Row label="Subtotal" value={money(fromMinor(totals.subtotalMinor))} />
            {totals.discountMinor > 0 && <Row label={`Discount (${promo.promotion.short})`} value={`− ${money(fromMinor(totals.discountMinor))}`} />}
            <Row label="Order Total" value={money(fromMinor(totals.totalMinor))} big />
            {canPay && cart.length > 0 && (
              <>
                <label className="mt-2 grid gap-1.5 text-sm font-medium text-slate">Amount Received (Rs)
                  <Input inputMode="decimal" autoComplete="off" placeholder="0" value={received} onChange={(e) => setReceived(e.target.value)} aria-invalid={receivedMinor === null} />
                </label>
                {receivedMinor === null && <Alert>Enter a valid amount (up to 2 decimals).</Alert>}
                <div className="flex flex-wrap gap-1.5">
                  {quick.map(([label, v]) => <Button key={label} size="sm" onClick={() => setReceived(fromMinor(v).replace(/\.00$/, ''))}>{label}</Button>)}
                  <Button size="sm" variant="ghost" onClick={() => setReceived('')}>Clear</Button>
                </div>
                {pay && (
                  <>
                    <Row label="Change Returned" value={money(fromMinor(pay.changeMinor))} />
                    <Row label="Outstanding Amount" value={money(fromMinor(pay.outstandingMinor))} />
                    <div className="flex items-center justify-between"><dt className="text-graphite">Payment Status</dt><dd><Pill tone={STATUS_PILL[pay.status][0]}>{STATUS_PILL[pay.status][1]}</Pill></dd></div>
                  </>
                )}
              </>
            )}
            {!canPay && cart.length > 0 && <p className="text-[13px] text-graphite">Your role cannot record payments; the order will be saved as unpaid.</p>}
          </dl>

          {error && <Alert className="mt-3">{error}</Alert>}
          <div className="mt-4 grid gap-2">
            <Button variant="accent" size="lg" disabled={busy || cart.length === 0 || receivedMinor === null} onClick={confirm}>{busy ? 'Confirming…' : 'Confirm order'}</Button>
            {cart.length > 0 && !busy && <Button variant="ghost" onClick={() => { setCart([]); setReceived(''); setError(''); }}>Clear order</Button>}
          </div>
        </Card>
      </div>

      {done && (
        <Modal title={`Order #${done.order.orderNo} confirmed`} onClose={() => setDone(null)}>
          <dl className="grid gap-2">
            {Number(done.order.discount) > 0 && <Row label={done.order.discountLabel ? `Discount (${done.order.discountLabel})` : 'Discount'} value={`− ${money(done.order.discount)}`} />}
            <Row label="Order Total" value={money(done.order.total)} big />
            <Row label="Amount Received" value={money(sum(done.order.payments, 'amountReceived'))} />
            <Row label="Change Returned" value={money(sum(done.order.payments, 'changeReturned'))} big />
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

function Row({ label, value, big }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-graphite">{label}</dt>
      <dd className={big ? 'text-xl font-semibold' : 'font-medium'}>{value}</dd>
    </div>
  );
}
