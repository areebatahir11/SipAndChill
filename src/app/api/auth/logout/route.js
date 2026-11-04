import { handle, ok } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { destroyCurrentSession } from '@/lib/auth/session';

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  await destroyCurrentSession();
  return ok({ signedOut: true });
});
