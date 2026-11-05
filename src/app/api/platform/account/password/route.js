import { handle, ok, readJson } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { changePasswordSchema } from '@/lib/validation/auth';
import { changeOwnPassword } from '@/modules/auth/service';

export const POST = handle(async (request) => {
  const admin = await requirePlatformApi(request);
  await changeOwnPassword(admin, changePasswordSchema.parse(await readJson(request)));
  return ok({ updated: true });
});
