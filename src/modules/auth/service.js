import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword, verifyPassword, DUMMY_HASH } from '@/lib/auth/password';
import { createSession, revokeUserSessions } from '@/lib/auth/session';
import { TRIAL_DAYS } from '@/lib/platform/constants.mjs';
import { trialEndDate } from '@/lib/platform/billing.mjs';
import { provisionBusiness } from '@/modules/tenants/provision';
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

  // PearlSolutions staff sign in to the platform area; they belong to no business.
  if (user.isPlatformAdmin) {
    await startSession(user, null, meta);
    await audit({ userId: user.id, action: 'platform.login', entity: 'User', entityId: user.id });
    return { redirectTo: '/platform' };
  }

  const membership = user.memberships[0];
  if (!membership) throw new HttpError(403, 'This account has no active business access.', 'NO_MEMBERSHIP');

  await startSession(user, membership.id, meta);
  await audit({ tenantId: membership.tenantId, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id });
  return { redirectTo: '/' }; // the server then sends each role to its own first page
}

async function startSession(user, membershipId, meta) {
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

/**
 * Public self-serve signup: creates the business with the signer as its single Business Owner, starts their
 * free trial (first payment due after TRIAL_DAYS) and signs them in. They chose the password, so no forced change.
 */
export async function signup({ businessName, businessType, ownerName, email, password }, meta) {
  const { tenantId, userId, membershipId, slug } = await provisionBusiness({
    businessName, businessType,
    dueDate: trialEndDate(new Date(), TRIAL_DAYS),
    owner: { name: ownerName, email, passwordHash: await hashPassword(password) },
  });
  await startSession({ id: userId }, membershipId, meta);
  await audit({ tenantId, userId, action: 'auth.signup', entity: 'Tenant', entityId: tenantId, metadata: { slug, businessType } });
  return { redirectTo: '/' };
}
