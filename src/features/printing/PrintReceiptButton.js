'use client';
import { useState } from 'react';
import usePrinter from './usePrinter';

const SMALL = 'px-3 py-1 text-[13.5px]';
const LINK = 'inline-flex items-center rounded-[10px] border border-slate bg-slate px-4 py-2 font-medium text-blush hover:bg-night';

/** "Print receipt": straight to the connected thermal printer, or the print page when none is connected on this device. */
export default function PrintReceiptButton({ orderId, autoprint = false, label = 'Print receipt', size }) {
  const { direct, link, status, api: printer } = usePrinter();
  const [triedAt, setTriedAt] = useState(0); // the printer status is shared by every button on the page: only the pressed button shows its own failure
  const size_ = size === 'sm' ? SMALL : '';
  // USB printer blocked by a Windows driver: the print window still works, so offer that instead of an error.
  if (!direct || link === 'blocked') {
    return <a className={`${LINK} ${size_}`} href={`/orders/${orderId}/receipt${autoprint ? '?autoprint=1' : ''}`} target="_blank" rel="noreferrer">{label}</a>;
  }
  const mine = triedAt > 0 && (status.at ?? 0) >= triedAt;
  const busy = status.state === 'printing';
  const failed = mine && status.state === 'error';
  return (
    <>
      <button type="button" disabled={busy} className={`${LINK} ${size_} cursor-pointer disabled:cursor-not-allowed disabled:opacity-55`} onClick={() => { setTriedAt(Date.now()); printer.printOrder(orderId).catch(() => {}); }}>
        {busy && mine ? 'Printing…' : failed ? 'Retry print' : label}
      </button>
      {(failed || (!triedAt && status.state === 'error')) && (
        <span role="alert" className="basis-full text-[13px] font-medium text-graphite">
          {status.message}{' '}
          <a className="underline" href={`/orders/${orderId}/receipt`} target="_blank" rel="noreferrer">Open receipt page (browser print)</a>
        </span>
      )}
    </>
  );
}
