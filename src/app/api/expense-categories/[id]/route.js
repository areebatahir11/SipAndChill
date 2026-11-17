import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateCategorySchema } from '@/lib/validation/expenses';
import { updateCategory } from '@/modules/expenses/service';

export const PATCH = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.EXPENSES_MANAGE);
  const { id } = await params;
  return ok(await updateCategory(auth, id, updateCategorySchema.parse(await readJson(request))));
});
