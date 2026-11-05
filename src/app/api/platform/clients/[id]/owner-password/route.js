import { handle, ok, readJson } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { resetOwnerPasswordSchema } from '@/lib/validation/platform';
import { resetOwnerPassword } from '@/modules/platform/clients';

export const POST = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id } = await params;
  await resetOwnerPassword(admin, id, resetOwnerPasswordSchema.parse(await readJson(request)));
  return ok({ updated: true });
});
