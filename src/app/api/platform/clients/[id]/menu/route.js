import { handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { listProducts } from '@/modules/menu/products';

/** A client's menu items (names, sections, picture versions): what the bulk picture upload matches file names against. */
export const GET = handle(async (request, { params }) => {
  await requirePlatformApi(request);
  const { id } = await params;
  const products = await listProducts(id, { withRecipe: false });
  return ok(products.map((p) => ({ id: p.id, name: p.name, categoryName: p.categoryName, imageVersion: p.imageVersion })));
});
