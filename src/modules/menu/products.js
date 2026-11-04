import { prisma } from '@/lib/db/prisma';
import { HttpError } from '@/lib/http';
import { isUniqueViolation } from '@/lib/db/errors';
import { audit } from '@/modules/auth/audit';

const DUPLICATE = new HttpError(409, 'A menu item with this name already exists.', 'DUPLICATE');
const num = (d) => (d == null ? null : Number(d));
const log = (auth, action, id, metadata) =>
  audit({ tenantId: auth.tenantId, userId: auth.user.id, action, entity: 'Product', entityId: id, metadata });

/** Cost of one unit = sum(quantity x ingredient cost). Only computed for users who may view recipes. */
const recipeCost = (items) => Math.round(items.reduce((sum, r) => sum + Number(r.quantity) * Number(r.ingredient.costPerUnit), 0) * 100) / 100;

const toProduct = (p, withRecipe) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  price: num(p.price),
  isActive: p.isActive,
  categoryId: p.categoryId,
  categoryName: p.category?.name ?? null,
  ...(withRecipe ? { recipeLines: p.recipeItems.length, cost: recipeCost(p.recipeItems) } : {}),
});

const include = { category: { select: { name: true } }, recipeItems: { include: { ingredient: { select: { costPerUnit: true } } } } };

async function findProduct(tenantId, id) {
  const p = await prisma.product.findFirst({ where: { id, tenantId }, include });
  if (!p) throw new HttpError(404, 'Menu item not found.', 'NOT_FOUND');
  return p;
}

async function assertCategory(tenantId, categoryId) {
  if (!categoryId) return;
  const c = await prisma.category.findFirst({ where: { id: categoryId, tenantId }, select: { id: true } });
  if (!c) throw new HttpError(400, 'Unknown category.', 'BAD_CATEGORY');
}

export async function listProducts(tenantId, { withRecipe }) {
  const rows = await prisma.product.findMany({ where: { tenantId }, include, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  return rows.map((p) => toProduct(p, withRecipe));
}

export async function createProduct(auth, data, withRecipe) {
  await assertCategory(auth.tenantId, data.categoryId);
  try {
    const p = await prisma.product.create({ data: { ...data, tenantId: auth.tenantId }, include });
    await log(auth, 'product.created', p.id, { name: p.name, price: data.price });
    return toProduct(p, withRecipe);
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

export async function updateProduct(auth, id, data, withRecipe) {
  await findProduct(auth.tenantId, id);
  if (data.categoryId !== undefined) await assertCategory(auth.tenantId, data.categoryId);
  try {
    const p = await prisma.product.update({ where: { id }, data, include });
    await log(auth, 'product.updated', id, data);
    return toProduct(p, withRecipe);
  } catch (e) {
    if (isUniqueViolation(e)) throw DUPLICATE;
    throw e;
  }
}

/** Step 5 will archive instead of delete when a product already appears on past orders. */
export async function deleteProduct(auth, id) {
  const p = await findProduct(auth.tenantId, id);
  await prisma.product.delete({ where: { id } });
  await log(auth, 'product.deleted', id, { name: p.name });
}

export async function getRecipe(tenantId, productId) {
  await findProduct(tenantId, productId);
  const rows = await prisma.recipeItem.findMany({
    where: { tenantId, productId },
    include: { ingredient: { select: { name: true, unit: true, costPerUnit: true } } },
    orderBy: { ingredient: { name: 'asc' } },
  });
  return rows.map((r) => ({
    ingredientId: r.ingredientId, name: r.ingredient.name, unit: r.ingredient.unit,
    quantity: Number(r.quantity), costPerUnit: Number(r.ingredient.costPerUnit),
  }));
}

/** Replaces the whole recipe in one transaction. Every ingredient must belong to this tenant. */
export async function setRecipe(auth, productId, items) {
  await findProduct(auth.tenantId, productId);
  const ids = items.map((i) => i.ingredientId);
  if (ids.length) {
    const found = await prisma.ingredient.count({ where: { tenantId: auth.tenantId, id: { in: ids }, isActive: true } });
    if (found !== ids.length) throw new HttpError(400, 'One of the ingredients does not exist or is archived.', 'BAD_INGREDIENT');
  }
  await prisma.$transaction([
    prisma.recipeItem.deleteMany({ where: { productId, tenantId: auth.tenantId } }),
    prisma.recipeItem.createMany({ data: items.map((i) => ({ tenantId: auth.tenantId, productId, ingredientId: i.ingredientId, quantity: i.quantity })) }),
  ]);
  await log(auth, 'recipe.updated', productId, { lines: items.length });
  return getRecipe(auth.tenantId, productId);
}
