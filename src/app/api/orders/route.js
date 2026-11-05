import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createOrderSchema, listOrdersSchema } from '@/lib/validation/orders';
import { createOrder, listOrders } from '@/modules/orders/service';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.ORDERS_VIEW);
  const query = listOrdersSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await listOrders(auth, query));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.ORDERS_CREATE);
  const input = createOrderSchema.parse(await readJson(request));
  const { order, duplicate } = await createOrder(auth, input);
  return ok({ order, duplicate }, { status: duplicate ? 200 : 201 });
});
