import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateProductSchema } from '@/lib/validation/menu';
import { updateProduct, deleteProduct } from '@/modules/menu/products';

export const PATCH = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.PRODUCTS_MANAGE);
  const { id } = await params;
  const input = updateProductSchema.parse(await readJson(request));
  return ok(await updateProduct(auth, id, input, hasPermission(auth.permissions, P.RECIPES_VIEW)));
});

export const DELETE = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.PRODUCTS_MANAGE);
  const { id } = await params;
  return ok(await deleteProduct(auth, id));
});
