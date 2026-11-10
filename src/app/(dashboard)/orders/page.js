import OrdersView from '@/features/orders/OrdersView';

/** Today's orders only. Earlier days live on /orders/history. */
export default function OrdersPage({ searchParams }) {
  return <OrdersView view="today" searchParams={searchParams} />;
}
