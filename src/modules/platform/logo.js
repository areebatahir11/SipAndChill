import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { assertLogo } from '@/lib/branding/logo.mjs';
import { audit } from '@/modules/auth/audit';

async function assertClient(tenantId) {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!t) throw new HttpError(404, 'Client not found.', 'NOT_FOUND');
}

/** PearlSolutions sets or replaces a client's logo. The tenant comes from the URL here (platform admins have no tenant session). */
export async function saveClientLogo(admin, tenantId, bytes) {
  await assertClient(tenantId);
  let contentType;
  try { contentType = assertLogo(bytes); } catch (e) { throw new HttpError(400, e.message, 'VALIDATION'); }
  const now = new Date();
  await prisma.$transaction([
    prisma.tenantLogo.upsert({ where: { tenantId }, update: { contentType, data: bytes }, create: { tenantId, contentType, data: bytes } }),
    prisma.tenant.update({ where: { id: tenantId }, data: { logoUpdatedAt: now } }),
  ]);
  await audit({ tenantId, userId: admin.user.id, action: 'platform.client_logo_changed', entity: 'Tenant', entityId: tenantId, metadata: { contentType, bytes: bytes.length } });
  return { logoVersion: now.getTime() };
}

export async function removeClientLogo(admin, tenantId) {
  await assertClient(tenantId);
  await prisma.$transaction([
    prisma.tenantLogo.deleteMany({ where: { tenantId } }),
    prisma.tenant.update({ where: { id: tenantId }, data: { logoUpdatedAt: null } }),
  ]);
  await audit({ tenantId, userId: admin.user.id, action: 'platform.client_logo_removed', entity: 'Tenant', entityId: tenantId });
  return { logoVersion: null };
}
