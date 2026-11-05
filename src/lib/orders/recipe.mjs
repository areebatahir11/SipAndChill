// Recipe consumption on integer "milli-units" (quantity DECIMAL(12,3) x 1000), so 0.150 kg is exact.

export const toMilli = (q) => Math.round(Number(q) * 1000);
export const fromMilli = (m) => (m / 1000).toFixed(3);

/**
 * lines:   [{ productId, quantity }]            quantity = whole units sold
 * recipes: Map productId -> [{ ingredientId, quantityMilli }]   (per ONE unit)
 * Returns Map ingredientId -> total milli-units to deduct. Products without a recipe consume nothing.
 */
export function consumption(lines, recipes) {
  const need = new Map();
  for (const { productId, quantity } of lines) {
    for (const r of recipes.get(productId) ?? []) {
      need.set(r.ingredientId, (need.get(r.ingredientId) ?? 0) + r.quantityMilli * quantity);
    }
  }
  return need;
}

/** How many units of a product the current stock allows. null = no recipe (not stock-limited). */
export function maxServings(recipe, stockMilliByIngredient) {
  if (!recipe || recipe.length === 0) return null;
  return Math.min(...recipe.map((r) => (r.quantityMilli <= 0 ? Infinity : Math.floor((stockMilliByIngredient.get(r.ingredientId) ?? 0) / r.quantityMilli))));
}

/** Merge duplicate productIds into one line (a cart may send the same product twice). */
export function mergeLines(lines) {
  const m = new Map();
  for (const l of lines) m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity);
  return [...m].map(([productId, quantity]) => ({ productId, quantity }));
}
