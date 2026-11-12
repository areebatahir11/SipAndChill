'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { Button } from '@/components/ui';
import OrderNo from '@/features/orders/OrderNo';
import PrintReceiptButton from './PrintReceiptButton';
import { PRINT_CHANGED, reportPrint } from './print-report';

/**
 * Warning that does not disappear with a dialog: it is read from the saved orders, so it survives closing the order dialog,
 * navigating and refreshing. Lists recent orders whose receipt was never confirmed (print failed, or the print window was
 * opened and nobody said it came out). Reloads when the tab regains focus (the receipt tab closed) and after any print action.
 */
export default function PrintAttentionBanner() {
  const [data, setData] = useState({ count: 0, orders: [] });

  const load = useCallback(async () => {
    try { setData(await api('/api/orders/print-attention')); } catch { /* banner is a helper: stay quiet if offline */ }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', load);
    window.addEventListener(PRINT_CHANGED, load);
    document.addEventListener('visibilitychange', onVisible);
    const t = setInterval(load, 300000); // every 5 minutes (it also reloads on focus and after any print action)
    return () => { window.removeEventListener('focus', load); window.removeEventListener(PRINT_CHANGED, load); document.removeEventListener('visibilitychange', onVisible); clearInterval(t); };
  }, [load]);

  if (data.count === 0) return null;
  const confirm = async (id) => { await reportPrint(id, 'confirmed'); load(); };

  return (
    <section role="alert" aria-label="Receipts to check" className="mb-4 rounded-[10px] border-l-4 border-graphite bg-peach px-4 py-3 text-night">
      <p className="m-0 font-semibold">
        {data.count === 1 ? '1 receipt did not print' : `${data.count} receipts did not print`}
        <span className="ml-2 font-normal text-graphite">Check the printer (power, paper, cable), then press Print again.</span>
      </p>
      <ul className="mt-2 grid gap-2">
        {data.orders.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-2">
            <span>Order <OrderNo no={o.orderNo} date={o.businessDate} /></span>
            <span className="text-graphite">{o.printStatus === 'PROBLEM' ? 'did not print' : 'outcome unknown (print window)'}</span>
            <PrintReceiptButton orderId={o.id} label="Print again" size="sm" />
            <Button size="sm" variant="secondary" onClick={() => confirm(o.id)}>It printed</Button>
          </li>
        ))}
      </ul>
      {data.count > data.orders.length && <p className="mt-2 mb-0"><Link className="font-medium underline" href="/orders?filter=print">See all {data.count} in Orders & Receipts</Link></p>}
    </section>
  );
}
