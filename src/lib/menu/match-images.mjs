// Matches picture file names to menu items ("cappuccino.jpg", "Caramel_Cappuccino.png", "capuccino.webp" -> the item). Pure.
import { nameKey } from './import/parse-menu.mjs';

/** "Caramel_Cappuccino (1).JPG" -> "caramel cappuccino"  (extension, copy numbers like "(1)" and "- Copy" are ignored) */
export const fileKey = (fileName) => nameKey(String(fileName).replace(/\.[^.]+$/, '').replace(/\(\d+\)|[-_ ]copy\b/gi, ' '));

function distance(a, b) { // Levenshtein, small strings only
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j += 1) { const t = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return row[b.length];
}

/**
 * products: [{id, name}]. Returns { productId, exact } or null.
 * exact = the names are the same apart from capitals/punctuation; otherwise it is a close guess (1-2 typos) the person must double-check.
 * A guess is only made when exactly one item is that close, so two similar items are never mixed up silently.
 */
export function matchImage(fileName, products) {
  const key = fileKey(fileName);
  if (!key) return null;
  const exact = products.find((p) => nameKey(p.name) === key);
  if (exact) return { productId: exact.id, exact: true };
  const limit = key.length >= 9 ? 2 : 1;
  const close = products.filter((p) => distance(key, nameKey(p.name)) <= limit);
  return close.length === 1 ? { productId: close[0].id, exact: false } : null;
}
