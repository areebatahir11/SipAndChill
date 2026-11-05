import { handle, ok, readJson } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { updateClientSchema } from '@/lib/validation/platform';
import { getClient, updateClient } from '@/modules/platform/clients';

export const GET = handle(async (request, { params }) => {
  await requirePlatformApi(request);
  const { id } = await params;
  return ok(await getClient(id));
});

export const PATCH = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id } = await params;
  return ok(await updateClient(admin, id, updateClientSchema.parse(await readJson(request))));
});
