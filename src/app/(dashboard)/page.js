import ModulePending from '@/components/layout/ModulePending';
import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';

export default async function DashboardPage() {
  await requirePage(P.DASHBOARD_VIEW);
  return <ModulePending title="Dashboard" step="Step 8">Sales, orders and inventory analytics for any date range will appear here.</ModulePending>;
}
