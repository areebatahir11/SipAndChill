import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';
import { assertBusinessNameFree } from '@/modules/tenants/names';

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

/**
 * Only the Business Owner reaches this (settings.manage). Renaming follows the same rule as PearlSolutions' "Edit details":
 * the name must not belong to another business (ignoring case, punctuation and "&" / "and"), and the comparison key is
 * updated with it. The slug (the business's permanent identity in links and records) never changes.
 */
export async function updateSettings(auth, { businessName, ...rest }) {
  const current = await prisma.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { name: true } });
  const renamed = businessName !== undefined && businessName !== current.name;
  const nameData = renamed ? { name: businessName, nameKey: await assertBusinessNameFree(businessName, { exceptTenantId: auth.tenantId }) } : {};
  try {
    const [tenant, settings] = await prisma.$transaction([
      prisma.tenant.update({ where: { id: auth.tenantId }, data: nameData }),
      prisma.tenantSettings.upsert({ where: { tenantId: auth.tenantId }, update: rest, create: { tenantId: auth.tenantId, ...rest } }),
    ]);
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'settings.updated', entity: 'Tenant', entityId: auth.tenantId, metadata: { ...rest, ...(renamed ? { renamedFrom: current.name, renamedTo: businessName } : {}) } });
    return shape(tenant, settings);
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, 'A business with this name already exists. If this is another branch, add the area to the name, for example "Sip & Chill DHA".', 'NAME_TAKEN'); // two renames at the same moment
    throw e;
  }
}
