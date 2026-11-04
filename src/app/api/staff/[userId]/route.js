import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateStaffSchema } from '@/lib/validation/staff';
import { updateStaff } from '@/modules/users/service';

export const PATCH = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.USERS_MANAGE);
  const { userId } = await params;
  return ok(await updateStaff(auth, userId, updateStaffSchema.parse(await readJson(request))));
});
