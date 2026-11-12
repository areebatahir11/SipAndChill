import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { listCategories } from '@/modules/menu/categories';
import CategoriesManager from '@/features/categories/CategoriesManager';

export default async function CategoriesPage() {
  const auth = await requirePage(P.CATEGORIES_VIEW);
  return <CategoriesManager initialRows={plain(await listCategories(auth.tenantId))} />;
}
