import { handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { getOrder } from '@/modules/orders/service';

export const GET = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.ORDERS_VIEW);
  const { id } = await params;
  return ok(await getOrder(auth, id));
});
