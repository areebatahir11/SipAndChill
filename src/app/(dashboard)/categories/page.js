import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import CategoriesManager from '@/features/categories/CategoriesManager';

export default async function CategoriesPage() {
  await requirePage(P.CATEGORIES_VIEW);
  return <CategoriesManager />;
}
