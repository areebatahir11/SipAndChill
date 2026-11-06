import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { businessNameKey } from '@/lib/platform/names.mjs';

/**
 * Business names are unique across all clients (ignoring case, spaces, punctuation and "&" / "and"), whatever the owner's email.
 * Returns the comparison key to store in Tenant.nameKey. Throws 400 for a name without letters/digits and 409 when taken.
 *   exceptTenantId: a business that is being renamed may keep its own name.
 *   checkRequests / exceptEmail: also refuse a name another person is in the middle of signing up with (unexpired SignupRequest).
 */
export async function assertBusinessNameFree(name, { exceptTenantId, checkRequests = false, exceptEmail } = {}) {
  const nameKey = businessNameKey(name);
  if (!nameKey) throw new HttpError(400, 'Business name must contain letters or numbers.', 'INVALID_NAME');

  const [tenant, request] = await Promise.all([
    prisma.tenant.findUnique({ where: { nameKey }, select: { id: true } }),
    checkRequests
      ? prisma.signupRequest.findFirst({ where: { nameKey, expiresAt: { gt: new Date() }, ...(exceptEmail ? { email: { not: exceptEmail } } : {}) }, select: { id: true } })
      : null,
  ]);
  if ((tenant && tenant.id !== exceptTenantId) || request) {
    throw new HttpError(409, 'A business with this name already exists. If this is another branch, add the area to the name, for example "Sip & Chill DHA".', 'NAME_TAKEN');
  }
  return nameKey;
}
