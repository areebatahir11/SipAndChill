import { handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { parseUsageDays } from '@/lib/platform/usage.mjs';
import { getClientUsage } from '@/modules/platform/usage';

/** GET /api/platform/clients/:id/usage?days=7|30|90 : sign-ins and feature use of one client (counts only). */
export const GET = handle(async (request, { params }) => {
  await requirePlatformApi(request);
  const { id } = await params;
  const days = parseUsageDays(new URL(request.url).searchParams.get('days'));
  return ok(await getClientUsage(id, days));
});
