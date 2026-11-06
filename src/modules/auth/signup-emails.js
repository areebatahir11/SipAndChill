import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email/smtp';
import { SIGNUP_OTP_TTL_MS } from '@/lib/auth/signup-policy.mjs';

const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const appUrl = () => (process.env.APP_URL || '').replace(/\/+$/, '');

const shell = (title, inner) =>
  `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#263238"><h2>${title}</h2>${inner}<p style="color:#777;font-size:12px">PearlSolutions</p></div>`;

/** The 6-digit code that proves the signer owns the email. Throws if the email cannot be sent (the signup form must tell the user). */
export async function sendSignupCode({ to, name, otp }) {
  const minutes = Math.round(SIGNUP_OTP_TTL_MS / 60_000);
  await sendEmail({
    to,
    subject: 'Your PearlSolutions verification code',
    text: `Hi ${name},\n\nYour verification code is ${otp}. It expires in ${minutes} minutes and can only be used once.\n\nIf you did not try to create a business account, you can ignore this email.`,
    html: shell('Verify your email', `<p>Hi ${esc(name)},</p><p>Use this code to finish creating your business account:</p><p style="font-size:30px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4eee8;border-radius:10px;text-align:center">${esc(otp)}</p><p>It expires in <strong>${minutes} minutes</strong> and can only be used once.</p><p>If you did not try to create an account, you can safely ignore this email.</p>`),
  });
}

/** Tells PearlSolutions a new signup is waiting. Best effort: never throws. Goes to ADMIN_NOTIFY_EMAIL, else to every active platform admin. */
export async function notifyAdminsOfSignup({ businessName, ownerName, email }) {
  try {
    const configured = (process.env.ADMIN_NOTIFY_EMAIL || '').split(',').map((e) => e.trim()).filter(Boolean);
    const to = configured.length
      ? configured
      : (await prisma.user.findMany({ where: { isPlatformAdmin: true, isActive: true }, select: { email: true } })).map((u) => u.email);
    const link = appUrl() ? `${appUrl()}/platform/clients` : null;
    for (const address of to) {
      await sendEmail({
        to: address,
        subject: `New signup waiting for approval: ${businessName}`,
        text: `${ownerName} (${email}) created the business "${businessName}". Open My Clients and approve or reject it.${link ? `\n\n${link}` : ''}`,
        html: shell('New signup waiting for approval', `<p><strong>${esc(businessName)}</strong><br>${esc(ownerName)} · ${esc(email)}</p><p>Open <em>My Clients</em> and approve or reject it.</p>${link ? `<p><a href="${esc(link)}">Open My Clients</a></p>` : ''}`),
      });
    }
  } catch (error) {
    console.error('[signup] admin notification failed:', error);
  }
}

/** Tells the owner their signup was approved or declined. Best effort: never throws. */
export async function notifyOwnerOfDecision({ to, name, businessName, approved }) {
  try {
    const login = appUrl() ? `${appUrl()}/login` : null;
    if (approved) {
      await sendEmail({
        to,
        subject: 'Your business account is approved',
        text: `Hi ${name},\n\nGood news: ${businessName} has been approved. You can sign in now and start setting up your menu, stock and team.${login ? `\n\n${login}` : ''}`,
        html: shell('Your business account is approved', `<p>Hi ${esc(name)},</p><p>Good news: <strong>${esc(businessName)}</strong> has been approved. You can sign in now and start setting up your menu, stock and team.</p>${login ? `<p><a href="${esc(login)}">Sign in</a></p>` : ''}`),
      });
    } else {
      await sendEmail({
        to,
        subject: 'About your PearlSolutions signup',
        text: `Hi ${name},\n\nWe could not approve the signup for ${businessName} at this time. If you think this is a mistake, please contact PearlSolutions.`,
        html: shell('About your signup', `<p>Hi ${esc(name)},</p><p>We could not approve the signup for <strong>${esc(businessName)}</strong> at this time. If you think this is a mistake, please contact PearlSolutions.</p>`),
      });
    }
  } catch (error) {
    console.error('[signup] decision email failed:', error);
  }
}
