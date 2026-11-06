import { prisma } from '@/lib/db/prisma';
import { TERMS_VERSION } from '@/lib/legal/terms.mjs';
import { audit } from './audit';

/** Records that the signed-in Business Owner accepted the current Terms & Conditions. Safe to call twice. */
export async function acceptTerms(auth, { ipAddress, userAgent }) {
  await prisma.termsAcceptance.upsert({
    where: { userId_version: { userId: auth.user.id, version: TERMS_VERSION } },
    create: { userId: auth.user.id, tenantId: auth.tenantId, version: TERMS_VERSION, ipAddress, userAgent: userAgent?.slice(0, 300) },
    update: {},
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'terms.accepted', entity: 'User', entityId: auth.user.id, metadata: { version: TERMS_VERSION } });
}
