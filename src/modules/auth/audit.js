import { prisma } from '@/lib/db/prisma';

/** Best-effort audit trail. `db` may be a transaction client. A logging failure never breaks the action. */
export async function audit({ tenantId = null, userId = null, action, entity, entityId, metadata }, db = prisma) {
  try {
    await db.auditLog.create({ data: { tenantId, userId, action, entity, entityId, metadata } });
  } catch (err) {
    console.error('[audit] failed to write', action, err);
  }
}
