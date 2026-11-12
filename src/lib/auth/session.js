import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { TENANT_STATUS } from '@/lib/platform/constants.mjs';
import { TERMS_VERSION, termsRequired } from '@/lib/legal/terms.mjs';

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

// ---------------------------------------------------------------------------
// Session lookup. This runs on EVERY page and API call, so its number of database round trips matters most:
// each one costs a full network trip to the database. The fast path below is ONE query (plus a cached role).
// ---------------------------------------------------------------------------

// Roles and their permissions are fixed by migrations / the seed (no screen edits them), so they are kept for a few
// minutes per server instance. WHICH role a user has is still read from the database on every request.
const ROLE_TTL_MS = 5 * 60_000;
const roleCache = new Map(); // roleId -> { at, role }

async function loadRole(roleId) {
  const hit = roleCache.get(roleId);
  if (hit && Date.now() - hit.at < ROLE_TTL_MS) return hit.role;
  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { permissions: { include: { permission: true } } } });
  if (role) roleCache.set(roleId, { at: Date.now(), role });
  return role;
}

/** One SQL statement: session + user + membership + tenant + accepted terms. Returns the same shape as the slow lookup. */
async function loadSessionFast(tokenHash) {
  const rows = await prisma.$queryRaw`
    SELECT s."id" AS "sessionId", s."expiresAt" AS "expiresAt",
           u."id" AS "userId", u."name" AS "userName", u."email" AS "userEmail", u."isActive" AS "userActive",
           u."isPlatformAdmin" AS "isPlatformAdmin", u."mustChangePassword" AS "mustChangePassword",
           COALESCE((SELECT json_agg(t."version") FROM "TermsAcceptance" t WHERE t."userId" = u."id"), '[]'::json) AS "terms",
           m."id" AS "membershipId", m."tenantId" AS "tenantId", m."isActive" AS "membershipActive", m."roleId" AS "roleId",
           tn."name" AS "tenantName", tn."currency" AS "currency", tn."logoUpdatedAt" AS "logoUpdatedAt",
           tn."isActive" AS "tenantActive", tn."status" AS "tenantStatus"
    FROM "Session" s
    JOIN "User" u ON u."id" = s."userId"
    LEFT JOIN "Membership" m ON m."id" = s."membershipId"
    LEFT JOIN "Tenant" tn ON tn."id" = m."tenantId"
    WHERE s."tokenHash" = ${tokenHash}
    LIMIT 1`;
  const r = rows[0];
  if (!r) return null;

  const role = r.membershipId ? await loadRole(r.roleId) : null;
  if (r.membershipId && !role) throw new Error('role not found for membership');
  return {
    id: r.sessionId,
    expiresAt: r.expiresAt,
    user: {
      id: r.userId, name: r.userName, email: r.userEmail, isActive: r.userActive,
      isPlatformAdmin: r.isPlatformAdmin, mustChangePassword: r.mustChangePassword,
      termsAcceptances: (r.terms ?? []).map((version) => ({ version })),
    },
    membership: r.membershipId ? {
      id: r.membershipId, tenantId: r.tenantId, isActive: r.membershipActive,
      tenant: { id: r.tenantId, name: r.tenantName, currency: r.currency, logoUpdatedAt: r.logoUpdatedAt, isActive: r.tenantActive, status: r.tenantStatus },
      role,
    } : null,
  };
}

/** The original lookup: several round trips, but it only uses Prisma's own model API. Kept as a safety net. */
function loadSessionSlow(tokenHash) {
  return prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: { include: { termsAcceptances: { select: { version: true } } } },
      membership: {
        include: { tenant: true, role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });
}

let fastLookupBroken = false; // set if the raw SQL does not match the database (table/column mismatch): then only the slow lookup is used

/** Looks up the cookie's session (any kind). Returns null when missing, expired or the user is disabled. */
async function loadSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);

  let session;
  if (!fastLookupBroken) {
    try {
      session = await loadSessionFast(tokenHash);
    } catch (err) {
      // P2010 = the raw query itself failed (wrong table/column). Anything else (network blip) is retried next time.
      if (err?.code === 'P2010') fastLookupBroken = true;
      console.error('[session] fast lookup failed, using the slower one:', err);
      session = await loadSessionSlow(tokenHash);
    }
  } else {
    session = await loadSessionSlow(tokenHash);
  }
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
  if (!membership || !membership.isActive || !membership.tenant.isActive || membership.tenant.status !== TENANT_STATUS.ACTIVE) return null;
  const { user } = session;

  return {
    sessionId: session.id,
    membershipId: membership.id,
    tenantId: membership.tenantId,
    user: { id: user.id, name: user.name, email: user.email },
    mustChangePassword: user.mustChangePassword,
    // The Business Owner must accept the current Terms & Conditions before anything else opens.
    termsRequired: termsRequired({ roleCode: membership.role.code, acceptedVersions: user.termsAcceptances.map((a) => a.version) }, TERMS_VERSION),
    tenant: {
      id: membership.tenant.id, name: membership.tenant.name, currency: membership.tenant.currency,
      logoVersion: membership.tenant.logoUpdatedAt ? membership.tenant.logoUpdatedAt.getTime() : null, // null = no logo
    },
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
