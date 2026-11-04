import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateIngredientSchema } from '@/lib/validation/inventory';
import { updateItem, deleteItem } from '@/modules/inventory/service';

export const PATCH = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.INGREDIENTS_MANAGE);
  const { id } = await params;
  return ok(await updateItem(auth, id, updateIngredientSchema.parse(await readJson(request))));
});

export const DELETE = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.INGREDIENTS_MANAGE);
  const { id } = await params;
  return ok(await deleteItem(auth, id));
});
