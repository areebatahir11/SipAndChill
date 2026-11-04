import { handle, ok, readJson } from '@/lib/http';
import { assertSameOrigin } from '@/lib/auth/guard';
import { loginSchema } from '@/lib/validation/auth';
import { login } from '@/modules/auth/service';

export const POST = handle(async (request) => {
  assertSameOrigin(request);
  const input = loginSchema.parse(await readJson(request));
  await login(input, {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
    userAgent: request.headers.get('user-agent'),
  });
  return ok({ signedIn: true });
});
