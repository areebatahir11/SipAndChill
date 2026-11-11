import Link from 'next/link';
import { Alert, Card, DataTable, PageHeader, Pill, StatCard, Td } from '@/components/ui';
import { OrderStatusPills } from '@/features/orders/OrderStatusPills';
import OrderNo from '@/features/orders/OrderNo';
import RangeFilter from './RangeFilter';
import SalesChart from './SalesChart';
import { dateTime, money } from '@/lib/format';
import { METHOD_LABEL, PAYMENT_METHODS } from '@/lib/payments.mjs';

export default function Dashboard({ data: d, rangeError }) {
  const rangeText = d.range.from === d.range.to ? d.range.from : `${d.range.from} to ${d.range.to}`;
  const before = d.range.days === 1 ? 'the day before' : `the ${d.range.days} days before`;
  const delta = (p) => (p === null ? 'nothing earlier to compare' : `${p > 0 ? '▲ up' : p < 0 ? '▼ down' : '■ same'} ${p === 0 ? '' : `${Math.abs(p)}% `}vs ${before}`);
  const empty = d.current.orders === 0 && d.cancelled === 0;

  return (
    <>
      <PageHeader title="Sales Summary" sub={`${d.range.label} · ${rangeText}`} />
      {rangeError && <Alert className="mb-4">{rangeError} Showing today instead.</Alert>}
      <RangeFilter range={d.range} />

      <div className="mb-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sales" value={money(d.current.sales)} hint={delta(d.change.sales)} />
        <StatCard label="Orders" value={d.current.orders} hint={d.cancelled ? `${d.cancelled} cancelled (not counted)` : delta(d.change.orders)} />
        <StatCard label="Money received" value={money(d.current.received)} hint={d.current.unpaid > 0 ? `${money(d.current.unpaid)} not paid yet` : 'Everything was paid'} />
        <StatCard label="Average per order" value={money(d.current.average)} hint={`Before: ${money(d.previous.average)}`} />
      </div>
      <p className="mb-4 text-[13px] text-graphite">Cancelled orders are never counted as sales.</p>

      {d.current.received > 0 && (
        <Card className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">How customers paid</h2>
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {PAYMENT_METHODS.map((m) => (
              <div key={m}>
                <dt className="text-[13px] font-medium text-graphite">{m === 'CASH' ? 'Cash (in the drawer)' : METHOD_LABEL[m]}</dt>
                <dd className="text-2xl font-semibold tracking-tight">{money(d.byMethod[m])}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {empty ? (
        <Card className="mb-6">
          <p className="mb-2 text-graphite">No orders in this period. When you take orders, your sales and graph will show here.</p>
          <p className="font-semibold">New here? Set up in this order:</p>
          <ol className="mt-1 list-decimal pl-5">
            <li><Link href="/ingredients" className="underline">Stock</Link>: add your ingredients, cups and supplies</li>
            <li><Link href="/products" className="underline">Menu &amp; Prices</Link>: add what you sell</li>
            <li><Link href="/staff" className="underline">My Team</Link>: give your cashiers and managers their logins</li>
            <li><Link href="/pos" className="underline">Take Orders</Link>: make your first sale</li>
          </ol>
        </Card>
      ) : (
        <div className="mb-6 grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Sales {d.chart.bucket === 'hour' ? 'hour by hour' : `by ${d.chart.bucket}`}</h2>
            <SalesChart points={d.chart.points} bucket={d.chart.bucket} />
          </Card>
          <Card>
            <h2 className="mb-2 text-lg font-semibold">Most sold items</h2>
            {d.bestSellers.length === 0 ? <p className="text-graphite">Nothing sold yet.</p> : (
              <ol className="grid gap-2.5">
                {d.bestSellers.map((b, i) => (
                  <li key={b.name} className="flex items-baseline justify-between gap-3 border-b border-blush pb-2 last:border-0">
                    <span><b className="mr-2 text-graphite">{i + 1}</b>{b.name}</span>
                    <span className="text-right"><b>{b.qty} sold</b><br /><small className="text-graphite">{money(b.revenue)}</small></span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}

      <h2 className="mb-2 text-lg font-semibold">Orders in this period</h2>
      <DataTable head={['Order', 'Date & time', 'Total', 'Status', '']} emptyText={d.recent.length ? undefined : 'No orders in this period.'}>
        {d.recent.map((o) => (
          <tr key={o.id}>
            <Td><OrderNo no={o.orderNo} date={o.businessDate} /></Td><Td>{dateTime(o.createdAt)}</Td><Td>{money(o.total)}</Td>
            <Td><OrderStatusPills order={o} /></Td>
            <Td className="text-right"><Link href={`/orders/${o.id}`} className="font-medium underline">Details</Link></Td>
          </tr>
        ))}
      </DataTable>
      <p className="mb-8 mt-2 text-right"><Link href="/orders" className="font-medium underline">See all orders →</Link></p>

      <h2 className="mb-1 text-lg font-semibold">Running low on stock</h2>
      <p className="mb-3 text-[13px] text-graphite">What you have right now. This does not change with the date you pick.</p>
      <div className="grid gap-5 md:grid-cols-2">
        <StockList title="Finished (0 left)" tone="alert" rows={d.inventory.out} count={d.inventory.outCount} empty="Nothing has run out." />
        <StockList title="Almost finished" tone="neutral" rows={d.inventory.low} count={d.inventory.lowCount} empty="Nothing is running low." />
      </div>
    </>
  );
}

function StockList({ title, tone, rows, count, empty }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">{title}</h3><Pill tone={count ? tone : 'ok'}>{count}</Pill></div>
      {rows.length === 0 ? <p className="text-graphite">{empty}</p> : (
        <ul className="grid gap-1.5">
          {rows.map((r) => <li key={r.id} className="flex justify-between gap-3"><span>{r.name}</span><span className="text-graphite">{r.stock} {r.unit} left (reorder at {r.minStock})</span></li>)}
        </ul>
      )}
      {count > rows.length && <p className="mt-2 text-[13px]"><Link href="/ingredients" className="underline">See all {count}</Link></p>}
    </Card>
  );
}
