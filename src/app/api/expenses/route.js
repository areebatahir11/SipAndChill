import { handle, HttpError, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createExpenseSchema } from '@/lib/validation/expenses';
import { createExpense, listExpenses } from '@/modules/expenses/service';
import { rangeFromParams } from '@/modules/expenses/range';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.EXPENSES_VIEW);
  const sp = new URL(request.url).searchParams;
  const { range, error } = rangeFromParams((k) => sp.get(k));
  if (error) throw new HttpError(400, error, 'BAD_RANGE');
  return ok(await listExpenses(auth.tenantId, range, { categoryId: sp.get('categoryId') || undefined, page: sp.get('page') || 1 }));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.EXPENSES_MANAGE);
  return ok(await createExpense(auth, createExpenseSchema.parse(await readJson(request))), { status: 201 });
});
