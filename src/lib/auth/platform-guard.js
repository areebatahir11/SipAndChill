import { cache } from 'react';
import { redirect } from 'next/navigation';
import { HttpError } from '@/lib/http';
import { assertSameOrigin } from './guard';
import { resolvePlatformSession } from './session';

/** Cached per request for Server Components (layout + page share one DB lookup). */
export const getPlatformAuth = cache(resolvePlatformSession);

/** API guard for /api/platform/*: only a signed-in PearlSolutions admin passes. */
export async function requirePlatformApi(request) {
  if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request);
  const auth = await resolvePlatformSession();
  if (!auth) throw new HttpError(401, 'Please sign in as a PearlSolutions admin.', 'UNAUTHENTICATED');
  return auth;
}

/** Page/layout guard for /platform/*. Everyone else is sent to the login page, which routes them home. */
export async function requirePlatformPage() {
  const auth = await getPlatformAuth();
  if (!auth) redirect('/login');
  return auth;
}
