import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createCategorySchema } from '@/lib/validation/menu';
import { listCategories, createCategory } from '@/modules/menu/categories';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.CATEGORIES_VIEW);
  return ok(await listCategories(auth.tenantId));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.CATEGORIES_MANAGE);
  return ok(await createCategory(auth, createCategorySchema.parse(await readJson(request))), { status: 201 });
});
