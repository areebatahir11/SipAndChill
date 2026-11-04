import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { stockMovementSchema } from '@/lib/validation/inventory';
import { recordMovement } from '@/modules/inventory/service';

export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.INVENTORY_ADJUST);
  const { id } = await params;
  return ok(await recordMovement(auth, id, stockMovementSchema.parse(await readJson(request))), { status: 201 });
});
