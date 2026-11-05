import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';

export const SESSION_COOKIE = 'sc_session';
const SESSION_DAYS = 7;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export async function createSession({ userId, membershipId, ipAddress, userAgent }) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, membershipId, expiresAt, ipAddress, userAgent: userAgent?.slice(0, 300) },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  store.delete(SESSION_COOKIE);
}

/** Revoke every session of a user (optionally keeping one), e.g. after password reset or deactivation. */
export const revokeUserSessions = (userId, exceptSessionId) =>
  prisma.session.deleteMany({ where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) } });

/** Looks up the cookie's session (any kind). Returns null when missing, expired or the user is disabled. */
async function loadSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: true,
      membership: {
        include: { tenant: true, role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
  return session;
}

/**
 * Tenant session: resolves the cookie into { user, tenant, role, permissions } or null.
 * tenantId always comes from the stored membership, never from the client.
 * PearlSolutions platform sessions have no membership, so they never resolve here.
 */
export async function resolveSession() {
  const session = await loadSession();
  const membership = session?.membership;
  if (!membership || !membership.isActive || !membership.tenant.isActive) return null;
  const { user } = session;

  return {
    sessionId: session.id,
    membershipId: membership.id,
    tenantId: membership.tenantId,
    user: { id: user.id, name: user.name, email: user.email },
    mustChangePassword: user.mustChangePassword,
    tenant: { id: membership.tenant.id, name: membership.tenant.name, currency: membership.tenant.currency },
    role: { code: membership.role.code, name: membership.role.name, rank: membership.role.rank },
    permissions: membership.role.permissions.map((rp) => rp.permission.code),
  };
}

/**
 * PearlSolutions session: { sessionId, user } or null. Only a platform admin's membership-less
 * session qualifies, so a tenant session can never be mistaken for a platform one.
 */
export async function resolvePlatformSession() {
  const session = await loadSession();
  if (!session || session.membership || !session.user.isPlatformAdmin) return null;
  const { user } = session;
  return { sessionId: session.id, user: { id: user.id, name: user.name, email: user.email } };
}
