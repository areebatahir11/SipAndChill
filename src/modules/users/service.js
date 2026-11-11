import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { hashPassword } from '@/lib/auth/password';
import { revokeUserSessions } from '@/lib/auth/session';
import { canManageRank } from '@/lib/permissions/codes.mjs';
import { audit } from '@/modules/auth/audit';

const toStaff = (m) => ({
  userId: m.user.id,
  name: m.user.name,
  email: m.user.email,
  isActive: m.isActive && m.user.isActive,
  role: { code: m.role.code, name: m.role.name, rank: m.role.rank },
  lastLoginAt: m.user.lastLoginAt,
  createdAt: m.createdAt,
});
const include = { user: true, role: true };

export async function listStaff(tenantId) {
  const rows = await prisma.membership.findMany({ where: { tenantId }, include, orderBy: { createdAt: 'asc' } });
  return rows.map(toStaff);
}

/** The only way to reach a staff member: scoped by tenantId, so guessing another tenant's userId yields 404. */
async function findMember(tenantId, userId) {
  const m = await prisma.membership.findUnique({ where: { tenantId_userId: { tenantId, userId } }, include });
  if (!m) throw new HttpError(404, 'Staff member not found.', 'NOT_FOUND');
  return m;
}

async function findRole(code) {
  const role = await prisma.role.findUnique({ where: { code } });
  if (!role) throw new HttpError(400, 'Unknown role.', 'BAD_ROLE');
  return role;
}

/** The hierarchy rule, enforced on the server for every staff action. */
function assertCanManage(auth, targetRank, verb) {
  if (!canManageRank(auth.role.rank, targetRank)) {
    throw new HttpError(403, `Your role is not allowed to ${verb} an account at that level.`, 'RANK');
  }
}

export async function createStaff(auth, { name, email, password, roleCode }) {
  const role = await findRole(roleCode);
  assertCanManage(auth, role.rank, 'create');
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN');
  }
  const passwordHash = await hashPassword(password);
  const membership = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { name, email, passwordHash, mustChangePassword: true } });
    return tx.membership.create({ data: { tenantId: auth.tenantId, userId: user.id, roleId: role.id }, include });
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'staff.created', entity: 'User', entityId: membership.userId, metadata: { email, role: role.code } });
  return toStaff(membership);
}

export async function updateStaff(auth, userId, { name, roleCode, isActive }) {
  const member = await findMember(auth.tenantId, userId);
  const isSelf = userId === auth.user.id;
  const changingRole = roleCode !== undefined && roleCode !== member.role.code;
  const deactivating = isActive === false && member.isActive;

  if (isSelf && (changingRole || deactivating)) {
    throw new HttpError(400, 'You cannot change your own role or deactivate yourself.', 'SELF_CHANGE');
  }
  if (!isSelf) assertCanManage(auth, member.role.rank, 'change');
  const role = changingRole ? await findRole(roleCode) : null;
  if (role) assertCanManage(auth, role.rank, 'assign');

  const updated = await prisma.$transaction(async (tx) => {
    if (name !== undefined) await tx.user.update({ where: { id: userId }, data: { name } });
    return tx.membership.update({
      where: { id: member.id },
      data: { ...(role ? { roleId: role.id } : {}), ...(isActive !== undefined ? { isActive } : {}) },
      include,
    });
  });
  if (deactivating) await revokeUserSessions(userId);

  await audit({
    tenantId: auth.tenantId, userId: auth.user.id, action: 'staff.updated', entity: 'User', entityId: userId,
    metadata: { name, renamedFrom: name !== undefined && name !== member.user.name ? member.user.name : undefined, role: changingRole ? roleCode : undefined, isActive },
  });
  return toStaff(updated);
}

export async function resetStaffPassword(auth, userId, newPassword) {
  if (userId === auth.user.id) throw new HttpError(400, 'Use "My account" to change your own password.', 'SELF_RESET');
  const member = await findMember(auth.tenantId, userId);
  assertCanManage(auth, member.role.rank, 'reset the password of');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(newPassword), mustChangePassword: true, failedLoginCount: 0, lockedUntil: null } });
  await revokeUserSessions(userId);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'staff.password_reset', entity: 'User', entityId: userId });
}
