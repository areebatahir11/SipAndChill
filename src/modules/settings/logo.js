import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { assertLogo } from '@/lib/branding/logo.mjs';
import { audit } from '@/modules/auth/audit';

/** The signed-in business's own logo (tenantId always comes from the session) or null. */
export function getLogo(tenantId) {
  return prisma.tenantLogo.findUnique({ where: { tenantId }, select: { contentType: true, data: true } });
}

export async function saveLogo(auth, bytes) {
  let contentType;
  try { contentType = assertLogo(bytes); } catch (e) { throw new HttpError(400, e.message, 'VALIDATION'); }
  const now = new Date();
  await prisma.$transaction([
    prisma.tenantLogo.upsert({ where: { tenantId: auth.tenantId }, update: { contentType, data: bytes }, create: { tenantId: auth.tenantId, contentType, data: bytes } }),
    prisma.tenant.update({ where: { id: auth.tenantId }, data: { logoUpdatedAt: now } }),
  ]);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'settings.logo_changed', entity: 'Tenant', entityId: auth.tenantId, metadata: { contentType, bytes: bytes.length } });
  return { logoVersion: now.getTime() };
}

export async function removeLogo(auth) {
  await prisma.$transaction([
    prisma.tenantLogo.deleteMany({ where: { tenantId: auth.tenantId } }),
    prisma.tenant.update({ where: { id: auth.tenantId }, data: { logoUpdatedAt: null } }),
  ]);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'settings.logo_removed', entity: 'Tenant', entityId: auth.tenantId });
  return { logoVersion: null };
}
