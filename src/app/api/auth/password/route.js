import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { changePasswordSchema } from '@/lib/validation/auth';
import { changeOwnPassword } from '@/modules/auth/service';

export const POST = handle(async (request) => {
  const auth = await requireApi(request);
  await changeOwnPassword(auth, changePasswordSchema.parse(await readJson(request)));
  return ok({ updated: true });
});
