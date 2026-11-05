import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/smtp';
import { OTP_TTL_MS, MAX_OTP_ATTEMPTS, canIssueOtp } from '@/lib/auth/otp-policy.mjs';
import { audit } from './audit';

export const GENERIC_REQUEST_MESSAGE = 'If this account is eligible for self-service recovery, a 6-digit code has been sent.';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export async function requestPasswordReset(email) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, email: true, name: true, isActive: true, isPlatformAdmin: true,
      memberships: { where: { isActive: true }, select: { role: { select: { code: true } } } },
    },
  });
  const canSelfRecover = user?.isPlatformAdmin || user?.memberships?.some((membership) => membership.role.code === 'OWNER');
  // Staff continue to use the existing owner/manager password-reset process.
  if (!user?.isActive || !canSelfRecover) return GENERIC_REQUEST_MESSAGE;

  const now = new Date();
  // Limits are read from the database so they also work when the site runs on many serverless instances.
  const recent = await prisma.passwordResetOtp.findMany({
    where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - 60 * 60_000) } },
    select: { createdAt: true },
  });
  if (!canIssueOtp(recent.map((r) => r.createdAt), now.getTime()).ok) return GENERIC_REQUEST_MESSAGE;

  const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const otpHash = await hashPassword(otp);
  // Only the newest code may work: older unused ones are closed (kept as rows so the hourly limit can count them).
  await prisma.passwordResetOtp.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
  await prisma.passwordResetOtp.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } } }); // housekeeping
  const record = await prisma.passwordResetOtp.create({
    data: { userId: user.id, otpHash, expiresAt: new Date(now.getTime() + OTP_TTL_MS) },
  });

  const safeName = escapeHtml(user.name || 'there');
  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Sip & Chill password recovery code',
      text: `Hi ${user.name || 'there'},\n\nYour password recovery code is ${otp}. It expires in 10 minutes and can only be used once.\n\nIf you did not request this, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#263238"><h2>Password recovery</h2><p>Hi ${safeName},</p><p>Use this code to reset your Sip &amp; Chill account password:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4eee8;border-radius:10px;text-align:center">${otp}</p><p>This code expires in <strong>10 minutes</strong> and can only be used once.</p><p>If you did not request this, you can safely ignore this email.</p><p style="color:#777;font-size:12px">PearlSolutions · Sip &amp; Chill</p></div>`,
    });
  } catch (error) {
    await prisma.passwordResetOtp.deleteMany({ where: { id: record.id } });
    console.error('[password-reset] email delivery failed:', error);
    // Keep the public response identical for known and unknown email addresses.
  }
  return GENERIC_REQUEST_MESSAGE;
}

export async function completePasswordReset({ email, otp, newPassword }) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, isActive: true, name: true, email: true } });
  if (!user?.isActive) throw new HttpError(400, 'The code is invalid or expired. Request a new one.', 'INVALID_RESET_CODE');

  const now = new Date();
  const reset = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: MAX_OTP_ATTEMPTS } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset) throw new HttpError(400, 'The code is invalid or expired. Request a new one.', 'INVALID_RESET_CODE');

  const valid = await verifyPassword(otp, reset.otpHash);
  if (!valid) {
    await prisma.passwordResetOtp.updateMany({
      where: { id: reset.id, consumedAt: null, attempts: { lt: MAX_OTP_ATTEMPTS } },
      data: { attempts: { increment: 1 } },
    });
    throw new HttpError(400, 'The code is invalid or expired. Check it and try again.', 'INVALID_RESET_CODE');
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetOtp.updateMany({
      where: { id: reset.id, userId: user.id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: MAX_OTP_ATTEMPTS } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new HttpError(400, 'The code is invalid or expired. Request a new one.', 'INVALID_RESET_CODE');

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
    });
    // Password recovery invalidates every browser/device session for this global user account.
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.passwordResetOtp.deleteMany({ where: { userId: user.id } });
    await audit({ userId: user.id, action: 'auth.password_reset', entity: 'User', entityId: user.id }, tx);
  });

  // Tell the owner their password changed, so a reset they did not make is noticed. Best effort: never fails the reset.
  try {
    const name = user.name || 'there';
    await sendEmail({
      to: user.email,
      subject: 'Your Sip & Chill password was changed',
      text: `Hi ${name},\n\nYour password was just changed and you were signed out everywhere. If this was not you, contact PearlSolutions immediately.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#263238"><h2>Password changed</h2><p>Hi ${escapeHtml(name)},</p><p>Your Sip &amp; Chill password was just changed and you were signed out on every device.</p><p><strong>If this was not you</strong>, contact PearlSolutions immediately.</p></div>`,
    });
  } catch (error) {
    console.error('[password-reset] confirmation email failed:', error);
  }
}
