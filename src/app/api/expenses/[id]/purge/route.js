import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { purgeExpenseSchema } from '@/lib/validation/expenses';
import { purgeExpense } from '@/modules/expenses/service';

/** POST /api/expenses/:id/purge { reason, confirm: "PURGE" } : permanent delete of a voided expense (Business Owner only). */
export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.EXPENSES_PURGE);
  const { id } = await params;
  return ok(await purgeExpense(auth, id, purgeExpenseSchema.parse(await readJson(request))));
});
