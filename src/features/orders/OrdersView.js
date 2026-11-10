import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { listOrdersSchema } from '@/lib/validation/orders';
import { listOrders } from '@/modules/orders/service';
import { getSettings } from '@/modules/settings/service';
import { normalizeWidth } from '@/lib/orders/receipt.mjs';
import { localDateString, longDayLabel } from '@/lib/orders/dates.mjs';
import PrinterStatusButton from '@/features/printing/PrinterStatusButton';
import PrintAttentionBanner from '@/features/printing/PrintAttentionBanner';
import { Button, ButtonLink, Card, Input, PageHeader } from '@/components/ui';
import OrdersTable from './OrdersTable';

const FILTERS = [['all', 'All'], ['paid', 'Paid'], ['partial', 'Partially paid'], ['unpaid', 'Unpaid'], ['cancelled', 'Cancelled'], ['print', 'Print problems']];
const PATHS = { today: '/orders', past: '/orders/history' };

/**
 * The one orders screen, used twice:  view="today"  -> /orders          (only today's orders; numbers start at #1 each morning)
 *                                     view="past"   -> /orders/history  (every earlier day, grouped by day, optional date picker)
 */
export default async function OrdersView({ view, searchParams }) {
  const auth = await requirePage(P.ORDERS_VIEW);
  const parsed = listOrdersSchema.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : listOrdersSchema.parse({});
  const today = localDateString(new Date());
  if (view === 'past' && query.date >= today && query.date) redirect('/orders'); // picked today (or a future day): today has its own page

  const { orders, days, total, page, pages } = await listOrders(auth, { ...query, view });
  const canPrint = hasPermission(auth.permissions, P.RECEIPTS_PRINT);
  const shopPaper = canPrint ? normalizeWidth((await getSettings(auth.tenantId)).receiptWidthMm) : 80;
  const base = PATHS[view];
  const href = (over) => `${base}?${new URLSearchParams({ filter: query.filter, ...(query.q ? { q: query.q } : {}), ...(view === 'past' && query.date ? { date: query.date } : {}), page: String(page), ...over })}`;
  const plain = view === 'today' && query.filter === 'all' && !query.q;

  return (
    <>
      <PageHeader title="Orders & Receipts" sub={view === 'today' ? `Today · ${longDayLabel(today)}` : 'Previous days'}>
        {canPrint && <PrinterStatusButton shopPaper={shopPaper} />}
        <form action={base} className="flex gap-2">
          <input type="hidden" name="filter" value={query.filter} />
          {view === 'past' && <Input name="date" type="date" max={today} defaultValue={query.date} aria-label="Show one day only" className="w-40" />}
          <Input name="q" inputMode="numeric" defaultValue={query.q} placeholder="Order number" aria-label="Search by order number" className="w-40" />
          <Button type="submit">Search</Button>
        </form>
      </PageHeader>
      {!parsed.success && <p className="mb-3 text-graphite">Search by order number, and pick a valid date.</p>}
      {canPrint && <PrintAttentionBanner />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ButtonLink href="/orders" variant={view === 'today' ? 'primary' : 'secondary'} size="sm">Today</ButtonLink>
        <ButtonLink href="/orders/history" variant={view === 'past' ? 'primary' : 'secondary'} size="sm">Past days</ButtonLink>
        <span aria-hidden className="mx-1 h-6 w-px bg-peach" />
        <nav className="flex flex-wrap gap-2" aria-label="Filter orders">
          {FILTERS.map(([k, label]) => <ButtonLink key={k} href={href({ filter: k, page: '1' })} variant={query.filter === k ? 'primary' : 'secondary'} size="sm" aria-current={query.filter === k ? 'page' : undefined}>{label}</ButtonLink>)}
        </nav>
      </div>
      {query.filter === 'print' && <p className="mb-3 text-graphite">Print problems from all days are shown here, so none is missed.</p>}
      {view === 'past' && query.date && <p className="mb-3"><Link className="font-medium underline" href={href({ date: '', page: '1' })}>Show all past days</Link></p>}

      {plain && total === 0
        ? <EmptyToday canOrder={hasPermission(auth.permissions, P.ORDERS_CREATE)} />
        : <OrdersTable orders={orders} days={days} canPrint={canPrint} emptyText={query.filter === 'print' ? 'No print problems. Nothing to check.' : 'No orders found.'} />}

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

function EmptyToday({ canOrder }) {
  return (
    <Card className="grid justify-items-center gap-2 py-14 text-center">
      <p className="m-0 text-xl font-semibold">No orders yet today</p>
      <p className="m-0 max-w-md text-graphite">A fresh day. The first order you take will be <b>#1</b> and appear here. Earlier days are under Past days.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {canOrder && <ButtonLink href="/pos">Take an order</ButtonLink>}
        <ButtonLink href="/orders/history" variant="secondary">See past days</ButtonLink>
      </div>
    </Card>
  );
}
