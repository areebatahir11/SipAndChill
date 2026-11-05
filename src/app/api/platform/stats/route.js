import { handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { getOverview } from '@/modules/platform/overview';

export const GET = handle(async (request) => {
  await requirePlatformApi(request);
  return ok(await getOverview());
});
