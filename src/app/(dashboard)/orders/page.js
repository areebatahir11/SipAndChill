import ModulePending from '@/components/layout/ModulePending';
import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';

export default async function Page() {
  await requirePage([P.ORDERS_CREATE, P.ORDERS_VIEW]);
  return <ModulePending title="Orders & counter" step="Step 5 (POS and orders)">The point-of-sale counter, order history and payments will appear here.</ModulePending>;
}
