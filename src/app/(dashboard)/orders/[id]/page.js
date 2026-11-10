import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { HttpError } from '@/lib/http';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { getOrder } from '@/modules/orders/service';
import { Card, DataTable, PageHeader, Td } from '@/components/ui';
import { OrderStatusPills } from '@/features/orders/OrderStatusPills';
import OrderActions from '@/features/orders/OrderActions';
import PrintStatusPill from '@/features/printing/PrintStatusPill';
import { dateTime, money } from '@/lib/format';
import { dayLabel } from '@/lib/orders/dates.mjs';

export default async function OrderDetailPage({ params }) {
  const auth = await requirePage(P.ORDERS_VIEW);
  const { id } = await params;
  let order;
  try { order = await getOrder(auth, id); } catch (e) { if (e instanceof HttpError && e.status === 404) notFound(); throw e; }
  const has = (c) => hasPermission(auth.permissions, c);
  const open = order.status === 'COMPLETED';

  return (
    <>
      <PageHeader title={`Order #${order.orderNo} · ${dayLabel(order.businessDate)}`} sub={`${dateTime(order.createdAt)} · Cashier: ${order.cashierName}`}>
        <OrderStatusPills order={order} />
        {has(P.RECEIPTS_PRINT) && <PrintStatusPill status={order.printStatus} attempts={order.printAttempts} />}
        <OrderActions orderId={order.id} outstanding={order.outstanding} canPay={open && order.paymentStatus !== 'PAID' && has(P.PAYMENTS_RECORD)} canCancel={open && has(P.ORDERS_CANCEL)} canPrint={has(P.RECEIPTS_PRINT)} />
      </PageHeader>

      {order.status === 'CANCELLED' && <Card className="mb-4 border-graphite"><b>Cancelled</b> on {dateTime(order.cancelledAt)}. Reason: {order.cancelReason}</Card>}

      <DataTable head={['Item', 'Unit price', 'Qty', 'Line total']}>
        {order.items.map((i) => (
          <tr key={i.id}><Td>{i.name}</Td><Td>{money(i.unitPrice)}</Td><Td>{i.quantity}</Td><Td>{money(i.lineTotal)}</Td></tr>
        ))}
      </DataTable>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Totals</h2>
          <dl className="grid gap-1.5">
            <L k="Subtotal" v={money(order.subtotal)} />
            {Number(order.discount) > 0 && <L k={order.discountLabel ? `Discount (${order.discountLabel})` : 'Discount'} v={`− ${money(order.discount)}`} />}
            <L k="Order Total" v={money(order.total)} big />
            <L k="Collected" v={money(order.amountPaid)} />
            <L k="Outstanding Amount" v={order.status === 'CANCELLED' ? '—' : money(order.outstanding)} />
          </dl>
        </Card>
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Payments</h2>
          {order.payments.length === 0 ? <p className="text-graphite">No payment recorded.</p> : (
            <ul className="grid gap-2">
              {order.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 border-b border-blush pb-2 last:border-0">
                  <span>{dateTime(p.createdAt)}<br /><small className="text-graphite">Cash · received {money(p.amountReceived)}</small></span>
                  <span className="text-right"><b>{money(p.amountApplied)}</b><br /><small className="text-graphite">change {money(p.changeReturned)}</small></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function L({ k, v, big }) {
  return <div className="flex justify-between gap-3"><dt className="text-graphite">{k}</dt><dd className={big ? 'text-xl font-semibold' : 'font-medium'}>{v}</dd></div>;
}
