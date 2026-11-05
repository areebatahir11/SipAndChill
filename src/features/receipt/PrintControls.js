'use client';
import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import usePrinter from '@/features/printing/usePrinter';
import { receiptToEscPos } from '@/lib/printing/escpos.mjs';

/** On-screen toolbar. Hidden when printing (see .no-print in receipt.css). */
export default function PrintControls({ orderId, width, autoprint, model }) {
  const { config, direct, status, hydrated, api: printer } = usePrinter();
  const fired = useRef(false);

  // Printing paper estimate for this very receipt (same bytes the printer would get).
  const paper = useMemo(() => receiptToEscPos(model, { paper: width }), [model, width]);

  useEffect(() => {
    if (!autoprint || !hydrated || fired.current) return;
    fired.current = true;
    if (direct) printer.printModel(model, width).catch(() => {});      // the error is shown below
    else { const t = setTimeout(() => window.print(), 400); return () => clearTimeout(t); } // let fonts/layout settle first
  }, [autoprint, hydrated, direct, model, width, printer]);

  const btn = 'rounded-[10px] border px-4 py-2 font-medium disabled:opacity-60';
  const busy = status.state === 'printing';
  return (
    <div className="no-print toolbar">
      {direct && (
        <button type="button" disabled={busy} className={`${btn} border-slate bg-slate text-blush`} onClick={() => printer.printModel(model, width).catch(() => {})}>
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
      <Link href={`/orders/${orderId}`} className={`${btn} border-peach bg-white`}>Back to order</Link>

      {status.message && <p role={status.state === 'error' ? 'alert' : 'status'} className="hint" style={{ fontWeight: 600 }}>{status.message}</p>}
      <p className="hint">
        This receipt uses about {(paper.lengthMm / 10).toFixed(1)} cm of paper (a roll gives roughly {paper.receiptsPerRoll} like it).
        {direct
          ? ` Sending to: ${printer.deviceLabel(config)}.`
          : <> No receipt printer connected on this device. <Link href="/printer" className="underline">Connect one</Link> for one-click printing, or use the print dialog: choose your thermal printer, margins “None”, scale 100%.</>}
      </p>
    </div>
  );
}
