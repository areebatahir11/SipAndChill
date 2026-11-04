import { handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { listMovements } from '@/modules/inventory/service';

export const GET = handle(async (request, { params }) => {
  const auth = await requireApi(request, [P.INVENTORY_VIEW, P.INGREDIENTS_VIEW]);
  const { id } = await params;
  return ok(await listMovements(auth.tenantId, id));
});
