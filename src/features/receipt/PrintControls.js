'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import usePrinter from '@/features/printing/usePrinter';
import { receiptToEscPos } from '@/lib/printing/escpos.mjs';

const TRIM_KEY = 'sipchill.receipt.trim.v1';
const TRIM_STEP = 2, TRIM_MIN = -12, TRIM_MAX = 6; // millimetres

/** Remembered on this device only: printers differ in how much of the paper they really print. */
function useReceiptTrim() {
  const [trim, setTrim] = useState(0);
  useEffect(() => { try { setTrim(Number(localStorage.getItem(TRIM_KEY)) || 0); } catch { /* private mode: default */ } }, []);
  useEffect(() => { document.documentElement.style.setProperty('--receipt-trim', `${trim}mm`); }, [trim]);
  const change = (d) => setTrim((t) => {
    const next = Math.min(Math.max(t + d, TRIM_MIN), TRIM_MAX);
    try { localStorage.setItem(TRIM_KEY, String(next)); } catch { /* keep in memory */ }
    return next;
  });
  return [trim, change];
}

const MM_PER_PX = 25.4 / 96;

/**
 * Makes the printed page exactly as long as the receipt. Without this the browser uses the driver's default page (A4 or a very long
 * roll) and the printer feeds a long blank strip or a second slip. Runs just before every print (button, Ctrl+P, auto print).
 */
function usePageFitsReceipt(width) {
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.receiptPage = 'true';
    document.head.appendChild(style);
    const fit = () => {
      const el = document.querySelector('.receipt');
      if (!el) return;
      const mm = Math.ceil(el.getBoundingClientRect().height * MM_PER_PX) + 2; // +2 mm so rounding never spills onto a second page
      style.textContent = `@page { size: ${width}mm ${mm}mm; margin: 0; }`;
    };
    fit();
    window.addEventListener('beforeprint', fit);
    return () => { window.removeEventListener('beforeprint', fit); style.remove(); };
  }, [width]);
}

/** On-screen toolbar. Hidden when printing (see .no-print in receipt.css). */
export default function PrintControls({ orderId, width, autoprint, model }) {
  const { config, direct, status, hydrated, api: printer } = usePrinter();
  const fired = useRef(false);
  const [trim, changeTrim] = useReceiptTrim();
  usePageFitsReceipt(width);

  // Printing paper estimate for this very receipt (same bytes the printer would get).
  const paper = useMemo(() => receiptToEscPos(model, { paper: width }), [model, width]);

  useEffect(() => {
    if (!autoprint || !hydrated) return;
    if (direct) {
      if (fired.current) return;
      fired.current = true;
      printer.printModel(model, width, orderId).catch(() => {}); // the error is shown below and saved on the order
      return;
    }
    // Browser print window. The timer + its cleanup live together here (no "already fired" guard around them): in development
    // React runs every effect twice, and a guard would let the first run's timer be cancelled by the cleanup and never re-armed,
    // so the print dialog would never open.
    const t = setTimeout(() => window.print(), 400); // let fonts/layout settle first
    // The tab was only opened to print: close it afterwards so the cashier is back on the counter screen.
    const close = () => { try { window.close(); } catch { /* the browser may refuse; harmless */ } };
    window.addEventListener('afterprint', close, { once: true });
    return () => { clearTimeout(t); window.removeEventListener('afterprint', close); };
  }, [autoprint, hydrated, direct, model, width, printer]);

  const btn = 'rounded-[10px] border px-4 py-2 font-medium disabled:opacity-60';
  const busy = status.state === 'printing';
  return (
    <div className="no-print toolbar">
      {direct && (
        <button type="button" disabled={busy} className={`${btn} border-slate bg-slate text-blush`} onClick={() => printer.printModel(model, width, orderId).catch(() => {})}>
          {busy ? 'Printing…' : 'Print to receipt printer'}
        </button>
      )}
      <button type="button" className={`${btn} ${direct ? 'border-peach bg-white' : 'border-slate bg-slate text-blush'}`} onClick={() => window.print()}>
        {direct ? 'Browser print' : 'Print Receipt'}
      </button>
      <span role="group" aria-label="Paper width">
        {[58, 80].map((w) => (
          <Link key={w} href={`/orders/${orderId}/receipt?w=${w}`} replace aria-current={w === width ? 'true' : undefined} className={`${btn} ${w === width ? 'border-night bg-sand font-semibold' : 'border-peach bg-white'}`}>{w} mm</Link>
        ))}
      </span>
      <span role="group" aria-label="Receipt fit" className="inline-flex items-center gap-1">
        <button type="button" className={`${btn} border-peach bg-white`} disabled={trim <= TRIM_MIN} onClick={() => changeTrim(-TRIM_STEP)} title="Use this if the right side of the slip is cut off">Narrower</button>
        <button type="button" className={`${btn} border-peach bg-white`} disabled={trim >= TRIM_MAX} onClick={() => changeTrim(TRIM_STEP)}>Wider</button>
      </span>
      <Link href={`/orders/${orderId}`} className={`${btn} border-peach bg-white`}>Back to order</Link>

      {status.message && <p role={status.state === 'error' ? 'alert' : 'status'} className="hint" style={{ fontWeight: 600 }}>{status.message}</p>}
      <p className="hint">
        This receipt uses about {(paper.lengthMm / 10).toFixed(1)} cm of paper (a roll gives roughly {paper.receiptsPerRoll} like it).
        {direct
          ? ` Sending to: ${printer.deviceLabel(config)}.`
          : <> No receipt printer connected on this device. <Link href="/printer" className="underline">Connect one</Link> for one-click printing, or use the print dialog: choose your thermal printer, paper size = roll paper of the same width (not A4), margins “None”, scale 100%. Right side cut off? Press “Narrower”.</>}
      </p>
    </div>
  );
}
