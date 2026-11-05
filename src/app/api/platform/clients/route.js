import { handle, ok, readJson } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { createClientSchema } from '@/lib/validation/platform';
import { createClient, listClients } from '@/modules/platform/clients';

export const GET = handle(async (request) => {
  await requirePlatformApi(request);
  return ok(await listClients());
});

export const POST = handle(async (request) => {
  const admin = await requirePlatformApi(request);
  const input = createClientSchema.parse(await readJson(request));
  return ok(await createClient(admin, input), { status: 201 });
});
