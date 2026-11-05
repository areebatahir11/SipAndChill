import Link from 'next/link';
import { requirePage } from '@/lib/auth/guard';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { listOrdersSchema } from '@/lib/validation/orders';
import { listOrders } from '@/modules/orders/service';
import { getSettings } from '@/modules/settings/service';
import { normalizeWidth } from '@/lib/orders/receipt.mjs';
import PrinterStatusButton from '@/features/printing/PrinterStatusButton';
import { Button, ButtonLink, DataTable, Input, PageHeader, Td } from '@/components/ui';
import { OrderStatusPills } from '@/features/orders/OrderStatusPills';
import { dateTime, money } from '@/lib/format';

const FILTERS = [['all', 'All'], ['paid', 'Paid'], ['partial', 'Partially paid'], ['unpaid', 'Unpaid'], ['cancelled', 'Cancelled']];

export default async function OrdersPage({ searchParams }) {
  const auth = await requirePage(P.ORDERS_VIEW);
  const parsed = listOrdersSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listOrdersSchema.parse({});
  const { orders, total, page, pages } = await listOrders(auth, query);
  const canPrint = hasPermission(auth.permissions, P.RECEIPTS_PRINT);
  const shopPaper = canPrint ? normalizeWidth((await getSettings(auth.tenantId)).receiptWidthMm) : 80;
  const href = (over) => { const u = new URLSearchParams({ filter: query.filter, ...(query.q ? { q: query.q } : {}), page: String(page), ...over }); return `/orders?${u}`; };

  return (
    <>
      <PageHeader title="Orders & Receipts" sub={`${total} order${total === 1 ? '' : 's'}`}>
        {canPrint && <PrinterStatusButton shopPaper={shopPaper} />}
        <form action="/orders" className="flex gap-2">
          <input type="hidden" name="filter" value={query.filter} />
          <Input name="q" inputMode="numeric" defaultValue={query.q} placeholder="Order number" aria-label="Search by order number" className="w-40" />
          <Button type="submit">Search</Button>
        </form>
      </PageHeader>
      {!parsed.success && <p className="mb-3 text-graphite">Search by order number only.</p>}

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter orders">
        {FILTERS.map(([k, label]) => <ButtonLink key={k} href={href({ filter: k, page: '1' })} variant={query.filter === k ? 'primary' : 'secondary'} size="sm" aria-current={query.filter === k ? 'page' : undefined}>{label}</ButtonLink>)}
      </nav>

      <DataTable head={['Order', 'Date & time', 'Cashier', 'Total', 'Paid', 'Status', '']} emptyText={orders.length ? undefined : 'No orders found.'}>
        {orders.map((o) => (
          <tr key={o.id}>
            <Td><b>#{o.orderNo}</b></Td>
            <Td>{dateTime(o.createdAt)}</Td>
            <Td>{o.cashierName}</Td>
            <Td>{money(o.total)}</Td>
            <Td>{money(o.amountPaid)}</Td>
            <Td><OrderStatusPills order={o} /></Td>
            <Td className="text-right"><Link className="font-medium underline" href={`/orders/${o.id}`}>View</Link></Td>
          </tr>
        ))}
      </DataTable>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          {page > 1 ? <ButtonLink href={href({ page: String(page - 1) })}>← Newer</ButtonLink> : <span />}
          <span className="text-graphite">Page {page} of {pages}</span>
          {page < pages ? <ButtonLink href={href({ page: String(page + 1) })}>Older →</ButtonLink> : <span />}
        </div>
      )}
    </>
  );
}
