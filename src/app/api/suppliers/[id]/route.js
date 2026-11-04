import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateSupplierSchema } from '@/lib/validation/suppliers';
import { updateSupplier, deleteSupplier } from '@/modules/suppliers/service';

export const PATCH = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.SUPPLIERS_MANAGE);
  const { id } = await params;
  return ok(await updateSupplier(auth, id, updateSupplierSchema.parse(await readJson(request))));
});

export const DELETE = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.SUPPLIERS_MANAGE);
  const { id } = await params;
  await deleteSupplier(auth, id);
  return ok({ deleted: true });
});
