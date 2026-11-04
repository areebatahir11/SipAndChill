import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createIngredientSchema } from '@/lib/validation/inventory';
import { listItems, createItem } from '@/modules/inventory/service';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, [P.INGREDIENTS_VIEW, P.INVENTORY_VIEW]);
  const kind = new URL(request.url).searchParams.get('kind') || undefined;
  return ok(await listItems(auth.tenantId, { kind }));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.INGREDIENTS_MANAGE);
  return ok(await createItem(auth, createIngredientSchema.parse(await readJson(request))), { status: 201 });
});
