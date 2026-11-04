import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createSupplierSchema } from '@/lib/validation/suppliers';
import { listSuppliers, createSupplier } from '@/modules/suppliers/service';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.SUPPLIERS_VIEW);
  return ok(await listSuppliers(auth.tenantId));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.SUPPLIERS_MANAGE);
  return ok(await createSupplier(auth, createSupplierSchema.parse(await readJson(request))), { status: 201 });
});
