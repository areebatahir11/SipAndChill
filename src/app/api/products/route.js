import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createProductSchema } from '@/lib/validation/menu';
import { listProducts, createProduct } from '@/modules/menu/products';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.PRODUCTS_VIEW);
  return ok(await listProducts(auth.tenantId, { withRecipe: hasPermission(auth.permissions, P.RECIPES_VIEW) }));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.PRODUCTS_MANAGE);
  const input = createProductSchema.parse(await readJson(request));
  return ok(await createProduct(auth, input, hasPermission(auth.permissions, P.RECIPES_VIEW)), { status: 201 });
});
