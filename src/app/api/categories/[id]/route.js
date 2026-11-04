import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateCategorySchema } from '@/lib/validation/menu';
import { updateCategory, deleteCategory } from '@/modules/menu/categories';

export const PATCH = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.CATEGORIES_MANAGE);
  const { id } = await params;
  return ok(await updateCategory(auth, id, updateCategorySchema.parse(await readJson(request))));
});

export const DELETE = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.CATEGORIES_MANAGE);
  const { id } = await params;
  await deleteCategory(auth, id);
  return ok({ deleted: true });
});
