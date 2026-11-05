import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { cancelOrderSchema } from '@/lib/validation/orders';
import { cancelOrder } from '@/modules/orders/service';

export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.ORDERS_CANCEL);
  const { id } = await params;
  return ok(await cancelOrder(auth, id, cancelOrderSchema.parse(await readJson(request))));
});
