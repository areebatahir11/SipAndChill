import { requirePage } from '@/lib/auth/guard';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { currentOrUpcoming } from '@/lib/promotions/promotions.mjs';
import { plain } from '@/lib/plain';
import { listProducts } from '@/modules/menu/products';
import { listCategories } from '@/modules/menu/categories';
import ProductsManager from '@/features/products/ProductsManager';

export default async function ProductsPage() {
  const auth = await requirePage(P.PRODUCTS_VIEW);
  // Same data and same permission rules as GET /api/products and /api/categories, fetched here in parallel
  // so the browser does not need a second round trip (and a second sign-in check) after the page opens.
  const [items, categories] = await Promise.all([
    listProducts(auth.tenantId, { withRecipe: hasPermission(auth.permissions, P.RECIPES_VIEW) }),
    hasPermission(auth.permissions, P.CATEGORIES_VIEW) ? listCategories(auth.tenantId) : [],
  ]);
  return <ProductsManager promotion={currentOrUpcoming()} initialItems={plain(items)} initialCategories={plain(categories)} />;
}
