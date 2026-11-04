import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { createStaffSchema } from '@/lib/validation/staff';
import { listStaff, createStaff } from '@/modules/users/service';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.USERS_VIEW);
  return ok(await listStaff(auth.tenantId));
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.USERS_MANAGE);
  const input = createStaffSchema.parse(await readJson(request));
  return ok(await createStaff(auth, input), { status: 201 });
});
