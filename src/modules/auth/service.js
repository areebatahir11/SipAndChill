import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword, verifyPassword, DUMMY_HASH } from '@/lib/auth/password';
import { createSession, revokeUserSessions } from '@/lib/auth/session';
import { TENANT_STATUS } from '@/lib/platform/constants.mjs';
import { audit } from './audit';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const INVALID = 'Email or password is incorrect.';

export async function login({ email, password }, meta) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { isActive: true, tenant: { isActive: true, status: TENANT_STATUS.ACTIVE } }, orderBy: { createdAt: 'asc' } } },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.', 'LOCKED');
  }

  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.isActive) {
    if (user) await registerFailure(user);
    throw new HttpError(401, INVALID, 'INVALID_CREDENTIALS');
  }

  // PearlSolutions staff sign in to the platform area; they belong to no business.
  if (user.isPlatformAdmin) {
    await startSession(user, null, meta);
    await audit({ userId: user.id, action: 'platform.login', entity: 'User', entityId: user.id });
    return { redirectTo: '/platform' };
  }

  const membership = user.memberships[0];
  if (!membership) {
    // Password was correct, so it is safe to say why: a signup that is still waiting for approval, or was declined.
    const waiting = await prisma.membership.findFirst({
      where: { userId: user.id, isActive: true, tenant: { status: { not: TENANT_STATUS.ACTIVE } } },
      select: { tenant: { select: { status: true } } },
    });
    if (waiting?.tenant.status === TENANT_STATUS.PENDING) {
      throw new HttpError(403, 'Your business account is waiting for approval. We will email you as soon as it is approved.', 'PENDING_APPROVAL');
    }
    if (waiting?.tenant.status === TENANT_STATUS.REJECTED) {
      throw new HttpError(403, 'Your signup was not approved. Please contact PearlSolutions.', 'SIGNUP_REJECTED');
    }
    throw new HttpError(403, 'This account has no active business access.', 'NO_MEMBERSHIP');
  }

  await startSession(user, membership.id, meta);
  await audit({ tenantId: membership.tenantId, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });
  return { redirectTo: '/' }; // the server then sends each role to its own first page
}

export async function startSession(user, membershipId, meta) {
  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }); // housekeeping
  await createSession({ userId: user.id, membershipId, ...meta });
}

async function registerFailure(user) {
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });
  if (updated.failedLoginCount >= MAX_FAILED) {
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) },
    });
    await audit({ userId: user.id, action: 'auth.locked', entity: 'User', entityId: user.id });
  }
}

export async function changeOwnPassword(auth, { currentPassword, newPassword }) {
  const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is incorrect.', 'WRONG_PASSWORD');
  }
  if (currentPassword === newPassword) throw new HttpError(400, 'Choose a new password that is different from the current one.', 'SAME_PASSWORD');
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false } });
  await revokeUserSessions(user.id, auth.sessionId); // sign out every other device
  await audit({ tenantId: auth.tenantId, userId: user.id, action: 'auth.password_changed', entity: 'User', entityId: user.id });
}
