'use client';
import usePrinter from './usePrinter';

const LINK = 'inline-flex items-center rounded-[10px] border border-slate bg-slate px-4 py-2 font-medium text-blush hover:bg-night';

/** "Print receipt": straight to the connected thermal printer, or the print page when none is connected on this device. */
export default function PrintReceiptButton({ orderId, autoprint = false, label = 'Print receipt' }) {
  const { direct, link, status, api: printer } = usePrinter();
  // USB printer blocked by a Windows driver: the print window still works, so offer that instead of an error.
  if (!direct || link === 'blocked') {
    return <a className={LINK} href={`/orders/${orderId}/receipt${autoprint ? '?autoprint=1' : ''}`} target="_blank" rel="noreferrer">{label}</a>;
  }
  const busy = status.state === 'printing';
  return (
    <>
      <button type="button" disabled={busy} className={`${LINK} cursor-pointer disabled:cursor-not-allowed disabled:opacity-55`} onClick={() => printer.printOrder(orderId).catch(() => {})}>
        {busy ? 'Printing…' : label}
      </button>
      {status.state === 'error' && <span role="alert" className="basis-full text-[13px] font-medium text-graphite">{status.message}</span>}
    </>
  );
}
