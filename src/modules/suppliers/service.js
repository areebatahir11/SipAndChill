import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';

const DUPLICATE = new HttpError(409, 'A supplier with this name already exists.', 'DUPLICATE');

export const listSuppliers = (tenantId) =>
  prisma.supplier.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { ingredients: true } } },
  }).then((rows) => rows.map(({ _count, ...s }) => ({ ...s, itemCount: _count.ingredients })));

/** Tenant-scoped lookup: another tenant's id behaves exactly like a missing one. */
export async function findSupplier(tenantId, id) {
  const s = await prisma.supplier.findFirst({ where: { id, tenantId } });
  if (!s) throw new HttpError(404, 'Supplier not found.', 'NOT_FOUND');
  return s;
}

export async function createSupplier(auth, data) {
  try {
    const s = await prisma.supplier.create({ data: { ...data, tenantId: auth.tenantId } });
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'supplier.created', entity: 'Supplier', entityId: s.id, metadata: { name: s.name } });
    return { ...s, itemCount: 0 };
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

export async function updateSupplier(auth, id, data) {
  await findSupplier(auth.tenantId, id);
  try {
    const s = await prisma.supplier.update({ where: { id }, data });
    await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'supplier.updated', entity: 'Supplier', entityId: id, metadata: data });
    return s;
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

/** Items linked to this supplier simply lose the link (onDelete: SetNull). */
export async function deleteSupplier(auth, id) {
  const s = await findSupplier(auth.tenantId, id);
  await prisma.supplier.delete({ where: { id } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'supplier.deleted', entity: 'Supplier', entityId: id, metadata: { name: s.name } });
}
