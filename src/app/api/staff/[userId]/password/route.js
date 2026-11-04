import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { resetPasswordSchema } from '@/lib/validation/staff';
import { resetStaffPassword } from '@/modules/users/service';

export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.USERS_MANAGE);
  const { userId } = await params;
  const { newPassword } = resetPasswordSchema.parse(await readJson(request));
  await resetStaffPassword(auth, userId, newPassword);
  return ok({ updated: true });
});
