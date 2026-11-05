import { handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { listPosProducts } from '@/modules/orders/service';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.ORDERS_CREATE);
  return ok(await listPosProducts(auth.tenantId));
});
