import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword } from '@/lib/auth/password';
import { revokeUserSessions } from '@/lib/auth/session';
import { ROLE_CODES } from '@/lib/permissions/codes.mjs';
import { BILLING_STATUS } from '@/lib/platform/constants.mjs';
import { billingLabel } from '@/lib/platform/billing.mjs';
import { audit } from '@/modules/auth/audit';
import { provisionBusiness } from '@/modules/tenants/provision';

const ownerMemberships = (take) => ({
  where: { role: { code: ROLE_CODES.OWNER } },
  orderBy: { createdAt: 'asc' },
  ...(take ? { take } : {}),
  include: { user: true },
});

const toOwner = (m) => ({
  userId: m.user.id,
  name: m.user.name,
  email: m.user.email,
  isActive: m.isActive && m.user.isActive,
  lastLoginAt: m.user.lastLoginAt,
});

/** The shape the API returns for a client: billing and access only, never the shop's own data. */
function toClient(t) {
  const owners = t.memberships.map(toOwner);
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    businessType: t.businessType,
    currency: t.currency,
    isActive: t.isActive,
    billingStatus: t.billingStatus,
    billing: billingLabel(t),
    monthlyFee: Number(t.monthlyFee),
    dueDate: t.dueDate,
    lastPaidAt: t.lastPaidAt,
    internalNote: t.internalNote,
    createdAt: t.createdAt,
    staffCount: t._count.memberships,
    owner: owners[0] || null,
    owners,
  };
}

export async function listClients() {
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { memberships: true } }, memberships: ownerMemberships(1) },
  });
  return rows.map(toClient);
}

async function findTenant(id) {
  const t = await prisma.tenant.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true } }, memberships: ownerMemberships() },
  });
  if (!t) throw new HttpError(404, 'Client not found.', 'NOT_FOUND');
  return t;
}

// Deliberately no menu, stock or sales data: a client's shop data is private to that client.
export async function getClient(id) {
  return toClient(await findTenant(id));
}

/** PearlSolutions-assisted signup: creates the business and its owner login with a temporary password. */
export async function createClient(admin, { businessName, businessType, monthlyFee, dueDate, owner }) {
  const { tenantId, slug } = await provisionBusiness({
    businessName, businessType, monthlyFee, dueDate: dueDate ?? null,
    owner: { name: owner.name, email: owner.email, passwordHash: await hashPassword(owner.password) },
    mustChangePassword: true,
  });
  await audit({
    tenantId, userId: admin.user.id, action: 'platform.client_created', entity: 'Tenant', entityId: tenantId,
    metadata: { name: businessName, slug, ownerEmail: owner.email },
  });
  return getClient(tenantId);
}

export async function updateClient(admin, id, { businessName, businessType, monthlyFee, dueDate, billingStatus, internalNote, isActive }) {
  const current = await findTenant(id);

  const data = {
    ...(businessName !== undefined ? { name: businessName } : {}),
    ...(businessType !== undefined ? { businessType } : {}),
    ...(monthlyFee !== undefined ? { monthlyFee } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(internalNote !== undefined ? { internalNote } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
    ...(billingStatus !== undefined ? { billingStatus } : {}),
  };
  if (billingStatus === BILLING_STATUS.PAID && current.billingStatus !== BILLING_STATUS.PAID) data.lastPaidAt = new Date();

  await prisma.tenant.update({ where: { id }, data });

  // Suspending a client signs everyone of that business out right away.
  if (isActive === false && current.isActive) {
    await prisma.session.deleteMany({ where: { membership: { tenantId: id } } });
  }

  await audit({
    tenantId: id, userId: admin.user.id, action: 'platform.client_updated', entity: 'Tenant', entityId: id,
    metadata: { ...data, dueDate: data.dueDate === undefined ? undefined : data.dueDate?.toISOString() ?? null },
  });
  return getClient(id);
}

/** Lets PearlSolutions hand a client owner a new password (there is no self-service reset). */
export async function resetOwnerPassword(admin, tenantId, { userId, newPassword }) {
  const membership = await prisma.membership.findFirst({
    where: { tenantId, userId, role: { code: ROLE_CODES.OWNER } },
    include: { user: true },
  });
  if (!membership) throw new HttpError(404, 'Owner not found for this client.', 'NOT_FOUND');

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
  });
  await revokeUserSessions(userId);
  await audit({
    tenantId, userId: admin.user.id, action: 'platform.owner_password_reset', entity: 'User', entityId: userId,
    metadata: { email: membership.user.email },
  });
}
