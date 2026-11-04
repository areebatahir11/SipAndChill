import { handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';

export const GET = handle(async (request) => {
  const { user, tenant, role, permissions } = await requireApi(request);
  return ok({ user, tenant, role, permissions });
});
