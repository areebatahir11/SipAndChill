import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { paymentSchema } from '@/lib/validation/orders';
import { addPayment } from '@/modules/orders/service';

export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, [P.PAYMENTS_RECORD]);
  const { id } = await params;
  const { payments } = paymentSchema.parse(await readJson(request));
  return ok(await addPayment(auth, id, payments), { status: 201 });
});
