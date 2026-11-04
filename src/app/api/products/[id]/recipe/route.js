import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { recipeSchema } from '@/lib/validation/menu';
import { getRecipe, setRecipe } from '@/modules/menu/products';

export const GET = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.RECIPES_VIEW);
  const { id } = await params;
  return ok(await getRecipe(auth.tenantId, id));
});

export const PUT = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.RECIPES_MANAGE);
  const { id } = await params;
  const { items } = recipeSchema.parse(await readJson(request));
  return ok(await setRecipe(auth, id, items));
});
