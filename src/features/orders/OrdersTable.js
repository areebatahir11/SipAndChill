import Link from 'next/link';
import PrintReceiptButton from '@/features/printing/PrintReceiptButton';
import PrintStatusPill from '@/features/printing/PrintStatusPill';
import { DataTable, Td } from '@/components/ui';
import { OrderStatusPills } from './OrderStatusPills';
import OrderNo from './OrderNo';
import { dayLabel, longDayLabel } from '@/lib/orders/dates.mjs';
import { dateTime, money } from '@/lib/format';

/** One heading row per business day: "Today · Tuesday 10 Nov 2026 — 12 orders · Rs 7,450 sales". */
function DayHeading({ day, summary, span }) {
  const label = dayLabel(day);
  return (
    <tr className="pointer-events-none">
      <td colSpan={span} className="border-b border-peach bg-sand/40 px-5 py-2.5 text-sm">
        <b>{label === 'Today' || label === 'Yesterday' ? `${label} · ` : ''}{longDayLabel(day)}</b>
        {summary && <span className="ml-3 text-graphite" title="Cancelled orders are not counted">{summary.orders} order{summary.orders === 1 ? '' : 's'} · {money(summary.sales)} sales</span>}
      </td>
    </tr>
  );
}

/** Orders grouped under a heading per business day. `days` = per-day totals from listOrders. */
export default function OrdersTable({ orders, days, canPrint, emptyText }) {
  const head = ['Order', 'Date & time', 'Cashier', 'Total', 'Paid', 'Status', ...(canPrint ? ['Receipt'] : []), ''];
  return (
    <DataTable head={head} emptyText={orders.length ? undefined : emptyText}>
      {orders.map((o, i) => (
        <OrderRows key={o.id} o={o} first={i === 0 || orders[i - 1].businessDate !== o.businessDate} days={days} canPrint={canPrint} span={head.length} />
      ))}
    </DataTable>
  );
}

function OrderRows({ o, first, days, canPrint, span }) {
  return (
    <>
      {first && <DayHeading day={o.businessDate} summary={days[o.businessDate]} span={span} />}
      <tr>
        <Td><OrderNo no={o.orderNo} date={o.businessDate} /></Td>
        <Td>{dateTime(o.createdAt)}</Td>
        <Td>{o.cashierName}</Td>
        <Td>{money(o.total)}</Td>
        <Td>{money(o.amountPaid)}</Td>
        <Td><OrderStatusPills order={o} /></Td>
        {canPrint && <Td><PrintStatusPill status={o.printStatus} attempts={o.printAttempts} /></Td>}
        <Td className="text-right">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {canPrint && <PrintReceiptButton orderId={o.id} size="sm" label={o.printAttempts > 0 ? 'Reprint' : 'Print'} />}
            <Link className="font-medium underline" href={`/orders/${o.id}`}>View</Link>
          </div>
        </Td>
      </tr>
    </>
  );
}
