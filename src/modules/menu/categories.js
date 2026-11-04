import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';

const DUPLICATE = new HttpError(409, 'A category with this name already exists.', 'DUPLICATE');
const log = (auth, action, id, metadata) =>
  audit({ tenantId: auth.tenantId, userId: auth.user.id, action, entity: 'Category', entityId: id, metadata });

export async function listCategories(tenantId) {
  const rows = await prisma.category.findMany({ where: { tenantId }, orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } });
  return rows.map(({ _count, ...c }) => ({ ...c, productCount: _count.products }));
}

export async function findCategory(tenantId, id) {
  const c = await prisma.category.findFirst({ where: { id, tenantId } });
  if (!c) throw new HttpError(404, 'Category not found.', 'NOT_FOUND');
  return c;
}

export async function createCategory(auth, data) {
  try {
    const c = await prisma.category.create({ data: { ...data, tenantId: auth.tenantId } });
    await log(auth, 'category.created', c.id, { name: c.name });
    return { ...c, productCount: 0 };
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

export async function updateCategory(auth, id, data) {
  await findCategory(auth.tenantId, id);
  try {
    const c = await prisma.category.update({ where: { id }, data });
    await log(auth, 'category.updated', id, data);
    return c;
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

/** Products in a deleted category become "Uncategorised" (onDelete: SetNull). */
export async function deleteCategory(auth, id) {
  const c = await findCategory(auth.tenantId, id);
  await prisma.category.delete({ where: { id } });
  await log(auth, 'category.deleted', id, { name: c.name });
}
