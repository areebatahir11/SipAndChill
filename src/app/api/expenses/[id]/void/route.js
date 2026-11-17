import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { voidExpenseSchema } from '@/lib/validation/expenses';
import { voidExpense } from '@/modules/expenses/service';

export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.EXPENSES_MANAGE);
  const { id } = await params;
  return ok(await voidExpense(auth, id, voidExpenseSchema.parse(await readJson(request))));
});
