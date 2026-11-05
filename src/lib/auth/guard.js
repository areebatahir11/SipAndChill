import { cache } from 'react';
import { redirect } from 'next/navigation';
import { HttpError } from '@/lib/http';
import { hasPermission, homeFor } from '@/lib/permissions/codes.mjs';
import { resolveSession } from './session';

/** Cached per request for Server Components (layout + page share one DB lookup). */
export const getAuth = cache(resolveSession);

/** Reject cross-site form/fetch posts. Browsers always send Origin on POST/PATCH/DELETE. */
export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  let originHost = null;
  try { originHost = origin ? new URL(origin).host : null; } catch {}
  if (!originHost || originHost !== host) throw new HttpError(403, 'Cross-site request blocked.', 'CSRF');
}

/**
 * API guard. Usage:  const auth = await requireApi(request, PERMISSIONS.USERS_MANAGE)
 * `needed` may be a code or an array (any-of). Throws 401/403 HttpError.
 * While a user still has a temporary password, every API except the change-password one is blocked.
 */
export async function requireApi(request, needed, { allowPasswordChange = false } = {}) {
  if (!['GET', 'HEAD'].includes(request.method)) assertSameOrigin(request);
  const auth = await resolveSession();
  if (!auth) throw new HttpError(401, 'Please sign in.', 'UNAUTHENTICATED');
  if (auth.mustChangePassword && !allowPasswordChange) throw new HttpError(403, 'Please choose your own password first.', 'PASSWORD_CHANGE_REQUIRED');
  if (!hasPermission(auth.permissions, needed)) throw new HttpError(403, 'You do not have permission to do that.', 'FORBIDDEN');
  return auth;
}

/** Page/layout guard for Server Components. Redirects instead of throwing. */
export async function requirePage(needed) {
  const auth = await getAuth();
  if (!auth) redirect('/login');
  if (!hasPermission(auth.permissions, needed)) redirect(homeFor(auth.permissions));
  return auth;
}
