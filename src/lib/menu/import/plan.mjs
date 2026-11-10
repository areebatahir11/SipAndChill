// Decides, WITHOUT touching the database, what an import would do to a business's existing menu. Pure and testable.
// Items are matched by name (ignoring capitals/spacing). An import only adds or updates; it never deletes or hides anything.
import { nameKey } from './parse-menu.mjs';

/**
 * existing: { categories: [{id, name}], products: [{id, name, price, categoryId, categoryName}] }
 * Returns { categoriesNew: [name], rows: [{row,name,category,price,description,status:'new'|'update'|'same', productId?, oldPrice?, oldCategory?}], counts }
 */
export function planMenuImport(items, existing) {
  const catByKey = new Map(existing.categories.map((c) => [nameKey(c.name), c]));
  const productByKey = new Map(existing.products.map((p) => [nameKey(p.name), p]));
  const categoriesNew = new Map(); // key -> display name (first spelling wins)

  const rows = items.map((it) => {
    const catKey = it.category ? nameKey(it.category) : null;
    if (catKey && !catByKey.has(catKey) && !categoriesNew.has(catKey)) categoriesNew.set(catKey, it.category);
    const found = productByKey.get(nameKey(it.name));
    const base = { row: it.row, name: it.name, category: it.category, price: it.price, description: it.description };
    if (!found) return { ...base, status: 'new' };
    const sameCategory = catKey === null || found.categoryId === (catByKey.get(catKey)?.id ?? '__new__'); // a row with no section never changes the item's current section
    const samePrice = Math.round(Number(found.price) * 100) === Math.round(it.price * 100);
    return { ...base, productId: found.id, status: sameCategory && samePrice ? 'same' : 'update', oldPrice: Number(found.price), oldCategory: found.categoryName ?? null };
  });

  const count = (s) => rows.filter((r) => r.status === s).length;
  return { categoriesNew: [...categoriesNew.values()], rows, counts: { newItems: count('new'), updates: count('update'), unchanged: count('same'), newCategories: categoriesNew.size } };
}
