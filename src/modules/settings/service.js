import { prisma } from '@/lib/db/prisma';
import { audit } from '@/modules/auth/audit';

const shape = (tenant, s) => ({
  businessName: tenant.name,
  currency: tenant.currency,
  phone: s.phone,
  address: s.address,
  receiptWidthMm: s.receiptWidthMm,
  receiptFooter: s.receiptFooter,
});

export async function getSettings(tenantId) {
  const [tenant, settings] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.tenantSettings.upsert({ where: { tenantId }, update: {}, create: { tenantId } }),
  ]);
  return shape(tenant, settings);
}

export async function updateSettings(auth, { businessName, ...rest }) {
  const [tenant, settings] = await prisma.$transaction([
    prisma.tenant.update({ where: { id: auth.tenantId }, data: businessName ? { name: businessName } : {} }),
    prisma.tenantSettings.upsert({ where: { tenantId: auth.tenantId }, update: rest, create: { tenantId: auth.tenantId, ...rest } }),
  ]);
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'settings.updated', entity: 'Tenant', entityId: auth.tenantId, metadata: { businessName, ...rest } });
  return shape(tenant, settings);
}
