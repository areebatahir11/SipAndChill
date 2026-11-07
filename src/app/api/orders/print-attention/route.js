import { handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { listPrintAttention } from '@/modules/orders/service';

/** Recent orders whose receipt print was not confirmed (drives the warning banner on the counter and orders pages). */
export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.RECEIPTS_PRINT);
  return ok(await listPrintAttention(auth));
});
