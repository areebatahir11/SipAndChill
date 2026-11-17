import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P, hasPermission } from '@/lib/permissions/codes.mjs';
import { businessDateBounds } from '@/lib/expenses.mjs';
import { plain } from '@/lib/plain';
import { listCategories, listExpenses } from '@/modules/expenses/service';
import { rangeFromParams } from '@/modules/expenses/range';
import { listSuppliers } from '@/modules/suppliers/service';
import RangeFilter from '@/features/dashboard/RangeFilter';
import ExpensesManager from '@/features/expenses/ExpensesManager';

export default async function ExpensesPage({ searchParams }) {
  const auth = await requirePage(P.EXPENSES_VIEW);
  const sp = await searchParams;
  const { range, error } = rangeFromParams((k) => (typeof sp[k] === 'string' ? sp[k] : undefined));
  const categoryId = typeof sp.category === 'string' ? sp.category : undefined;
  const page = typeof sp.page === 'string' ? sp.page : 1;

  const [data, categories, suppliers] = await Promise.all([
    listExpenses(auth.tenantId, range, { categoryId, page }),
    listCategories(auth.tenantId),
    hasPermission(auth.permissions, P.SUPPLIERS_VIEW) ? listSuppliers(auth.tenantId) : [],
  ]);
  const bounds = businessDateBounds(range);
  const view = { preset: range.preset, label: range.label, ...bounds, categoryId: categoryId ?? '' };

  return (
    <ExpensesManager data={plain(data)} categories={plain(categories)} suppliers={plain(suppliers)} view={view} rangeError={error}>
      <RangeFilter range={{ preset: range.preset, from: bounds.from, to: bounds.to }} basePath="/expenses" keep={categoryId ? { category: categoryId } : {}} />
    </ExpensesManager>
  );
}
