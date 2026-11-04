import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import ProductsManager from '@/features/products/ProductsManager';

export default async function ProductsPage() {
  await requirePage(P.PRODUCTS_VIEW);
  return <ProductsManager />;
}
