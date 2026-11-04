import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword, verifyPassword, DUMMY_HASH } from '@/lib/auth/password';
import { createSession, revokeUserSessions } from '@/lib/auth/session';
import { audit } from './audit';

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
const INVALID = 'Email or password is incorrect.';

export async function login({ email, password }, meta) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { where: { isActive: true, tenant: { isActive: true } }, orderBy: { createdAt: 'asc' } } },
  });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(429, 'Too many failed attempts. Try again in a few minutes.', 'LOCKED');
  }

  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid || !user.isActive) {
    if (user) await registerFailure(user);
    throw new HttpError(401, INVALID, 'INVALID_CREDENTIALS');
  }

  const membership = user.memberships[0];
  if (!membership) throw new HttpError(403, 'This account has no active business access.', 'NO_MEMBERSHIP');

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() } });
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }); // housekeeping
  await createSession({ userId: user.id, membershipId: membership.id, ...meta });
  await audit({ tenantId: membership.tenantId, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });
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
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
  await revokeUserSessions(user.id, auth.sessionId); // sign out every other device
  await audit({ tenantId: auth.tenantId, userId: user.id, action: 'auth.password_changed', entity: 'User', entityId: user.id });
}
