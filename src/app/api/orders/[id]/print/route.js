import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { printEventSchema } from '@/lib/validation/orders';
import { recordPrintEvent } from '@/modules/orders/service';

/** The receipt page reports what really happened (sent to the printer / dialog opened / cashier confirmed / failed). Changes print columns only. */
export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.RECEIPTS_PRINT);
  const { id } = await params;
  const { event } = printEventSchema.parse(await readJson(request));
  return ok(await recordPrintEvent(auth, id, event));
});
