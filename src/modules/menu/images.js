import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { assertProductImage } from '@/lib/menu/product-image.mjs';
import { audit } from '@/modules/auth/audit';

/** The picture of one menu item of this business (or null). The tenant filter means one business can never read another's pictures. */
export function getProductImage(tenantId, productId) {
  return prisma.productImage.findFirst({ where: { productId, tenantId }, select: { contentType: true, data: true } });
}

async function assertProduct(tenantId, productId) {
  const p = await prisma.product.findFirst({ where: { id: productId, tenantId }, select: { id: true, name: true } });
  if (!p) throw new HttpError(404, 'Menu item not found.', 'NOT_FOUND');
  return p;
}

/** Sets or replaces a menu item's picture. Returns the new version (the browser adds it to the URL so the cache refreshes). */
export async function saveProductImage(auth, productId, bytes) {
  const p = await assertProduct(auth.tenantId, productId);
  let contentType;
  try { contentType = assertProductImage(bytes); } catch (e) { throw new HttpError(400, e.message, 'VALIDATION'); }
  const row = await prisma.productImage.upsert({
    where: { productId },
    update: { contentType, data: bytes },
    create: { productId, tenantId: auth.tenantId, contentType, data: bytes },
    select: { updatedAt: true },
  });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'product.image_changed', entity: 'Product', entityId: productId, metadata: { name: p.name, contentType, bytes: bytes.length } });
  return { imageVersion: row.updatedAt.getTime() };
}

export async function removeProductImage(auth, productId) {
  const p = await assertProduct(auth.tenantId, productId);
  await prisma.productImage.deleteMany({ where: { productId, tenantId: auth.tenantId } });
  await audit({ tenantId: auth.tenantId, userId: auth.user.id, action: 'product.image_removed', entity: 'Product', entityId: productId, metadata: { name: p.name } });
  return { imageVersion: null };
}
