import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { TRIAL_DAYS, TENANT_STATUS } from '@/lib/platform/constants.mjs';
import { trialEndDate } from '@/lib/platform/billing.mjs';
import {
  MAX_SIGNUP_ATTEMPTS, SIGNUP_MAX_REQUESTS_PER_IP_HOUR, SIGNUP_MODES, SIGNUP_OTP_TTL_MS,
  canSendSignupCode, getSignupMode, nextSendState,
} from '@/lib/auth/signup-policy.mjs';
import { provisionBusiness } from '@/modules/tenants/provision';
import { assertBusinessNameFree } from '@/modules/tenants/names';
import { audit } from './audit';
import { startSession } from './service';
import { sendSignupCode } from './signup-emails';

const HOUR_MS = 60 * 60_000;
const CLOSED = () => new HttpError(403, 'Sign-ups are by invitation only. Please contact PearlSolutions.', 'SIGNUP_CLOSED');
const INVALID_CODE = () => new HttpError(400, 'The code is invalid or expired. Check it, or request a new one.', 'INVALID_SIGNUP_CODE');

/**
 * Step 1 of public signup. Nothing is created yet except a short-lived SignupRequest: the business and its owner
 * only come into existence when the emailed code is confirmed (verifySignup). Calling this again for the same email
 * sends a fresh code (this is what "Resend code" does), within the cooldown and hourly limits kept in the database.
 */
export async function requestSignup({ businessName, businessType, ownerName, email, password }, { ipAddress }) {
  if (getSignupMode() === SIGNUP_MODES.INVITE_ONLY) throw CLOSED();

  const now = Date.now();
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new HttpError(409, 'An account with this email already exists. Try signing in instead.', 'EMAIL_TAKEN');
  }

  const nameKey = await assertBusinessNameFree(businessName, { checkRequests: true, exceptEmail: email });

  // Limits live in the database so they hold on serverless hosting, where every request may run on a different instance.
  if (ipAddress) {
    const fromIp = await prisma.signupRequest.count({ where: { ipAddress, updatedAt: { gt: new Date(now - HOUR_MS) } } });
    if (fromIp >= SIGNUP_MAX_REQUESTS_PER_IP_HOUR) throw new HttpError(429, 'Too many signups from this network. Please try again later.', 'RATE_LIMITED');
  }
  const existing = await prisma.signupRequest.findUnique({ where: { email } });
  const verdict = canSendSignupCode(existing, now);
  if (!verdict.ok) {
    throw new HttpError(429, verdict.reason === 'COOLDOWN'
      ? 'A code was just sent. Please wait a minute before requesting another.'
      : 'Too many codes were requested for this email. Please try again in an hour.', 'RATE_LIMITED');
  }

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const [otpHash, passwordHash] = await Promise.all([hashPassword(otp), hashPassword(password)]);
  const data = {
    businessName, nameKey, businessType, ownerName, passwordHash, otpHash, attempts: 0, ipAddress,
    expiresAt: new Date(now + SIGNUP_OTP_TTL_MS),
    ...nextSendState(existing, now),
  };
  await prisma.signupRequest.upsert({ where: { email }, create: { email, ...data }, update: data });
  await prisma.signupRequest.deleteMany({ where: { expiresAt: { lt: new Date(now - 24 * HOUR_MS) } } }); // housekeeping

  try {
    await sendSignupCode({ to: email, name: ownerName, otp });
  } catch (error) {
    console.error('[signup] verification email failed:', error);
    throw new HttpError(502, 'We could not send the verification email. Please check the address and try again.', 'EMAIL_FAILED');
  }
  return { email };
}

/**
 * Step 2: the emailed code is correct, so create the business and its Business Owner.
 *  - approval mode: the business is created PENDING (switched off) and nobody is signed in.
 *  - open mode: the business is active, the free trial starts now and the owner is signed in.
 */
export async function verifySignup({ email, otp }, meta) {
  const mode = getSignupMode();
  if (mode === SIGNUP_MODES.INVITE_ONLY) throw CLOSED();

  const request = await prisma.signupRequest.findUnique({ where: { email } });
  if (!request || request.expiresAt <= new Date() || request.attempts >= MAX_SIGNUP_ATTEMPTS) throw INVALID_CODE();

  if (!(await verifyPassword(otp, request.otpHash))) {
    await prisma.signupRequest.updateMany({
      where: { id: request.id, attempts: { lt: MAX_SIGNUP_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    throw INVALID_CODE();
  }

  // Claim the request in one atomic step, so a code can only ever create one business (even if submitted twice at once).
  const claimed = await prisma.signupRequest.deleteMany({
    where: { id: request.id, expiresAt: { gt: new Date() }, attempts: { lt: MAX_SIGNUP_ATTEMPTS } },
  });
  if (claimed.count !== 1) throw INVALID_CODE();

  const pending = mode === SIGNUP_MODES.APPROVAL;
  const { tenantId, userId, membershipId, slug } = await provisionBusiness({
    businessName: request.businessName,
    businessType: request.businessType,
    status: pending ? TENANT_STATUS.PENDING : TENANT_STATUS.ACTIVE,
    dueDate: pending ? null : trialEndDate(new Date(), TRIAL_DAYS), // in approval mode the trial starts when PearlSolutions approves
    owner: { name: request.ownerName, email: request.email, passwordHash: request.passwordHash }, // they chose it themselves
  });
  await audit({
    tenantId, userId, action: pending ? 'auth.signup_pending' : 'auth.signup', entity: 'Tenant', entityId: tenantId,
    metadata: { slug, businessType: request.businessType, ip: meta.ipAddress },
  });

  const summary = { businessName: request.businessName, ownerName: request.ownerName, email: request.email };
  if (pending) return { status: TENANT_STATUS.PENDING, ...summary };

  await startSession({ id: userId }, membershipId, meta);
  return { status: TENANT_STATUS.ACTIVE, redirectTo: '/', ...summary };
}
