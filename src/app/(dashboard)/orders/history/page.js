import OrdersView from '@/features/orders/OrdersView';

/** Every day before today, newest first, grouped by day. */
export default function OrdersHistoryPage({ searchParams }) {
  return <OrdersView view="past" searchParams={searchParams} />;
}
