import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { resolveRange } from '@/lib/orders/dates.mjs';
import { getDashboard } from '@/modules/reports/dashboard';
import Dashboard from '@/features/dashboard/Dashboard';

export default async function DashboardPage({ searchParams }) {
  const auth = await requirePage(P.DASHBOARD_VIEW);
  const sp = await searchParams;
  let range, rangeError = '';
  try {
    range = resolveRange(sp.range ?? 'today', { from: sp.from, to: sp.to || sp.from });
  } catch (e) {
    if (!(e instanceof RangeError)) throw e;
    rangeError = e.message;
    range = resolveRange('today');
  }
  const data = await getDashboard(auth.tenantId, range);
  return <Dashboard data={data} rangeError={rangeError} />;
}
