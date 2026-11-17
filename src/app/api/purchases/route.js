import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { purchaseSchema } from '@/lib/validation/expenses';
import { recordPurchase } from '@/modules/inventory/service';

// Same permission as "Update stock": whoever may receive stock may record what it cost.
export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.INVENTORY_ADJUST);
  return ok(await recordPurchase(auth, purchaseSchema.parse(await readJson(request))), { status: 201 });
});
