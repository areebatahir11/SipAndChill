import { handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { getReceiptForPrint } from '@/modules/orders/receipt';

/** Receipt data as JSON so the browser can send it straight to a thermal printer (ESC/POS). */
export const GET = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.RECEIPTS_PRINT);
  const { id } = await params;
  return ok(await getReceiptForPrint(auth, id));
});
