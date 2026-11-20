import { handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { parseUsageDays } from '@/lib/platform/usage.mjs';
import { getUsageOverview } from '@/modules/platform/usage';

/** GET /api/platform/usage?days=7|30|90 : sign-ins and feature use of every running client (counts only). */
export const GET = handle(async (request) => {
  await requirePlatformApi(request);
  const days = parseUsageDays(new URL(request.url).searchParams.get('days'));
  return ok(await getUsageOverview(days));
});
