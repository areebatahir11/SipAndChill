import { prisma } from '@/lib/db/prisma';

/** The logo of one business (or null). Read-only: only PearlSolutions can change a client's logo (see modules/platform/logo.js). */
export function getLogo(tenantId) {
  return prisma.tenantLogo.findUnique({ where: { tenantId }, select: { contentType: true, data: true } });
}
