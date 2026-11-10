// Turns spreadsheet rows (from CSV or XLSX) into validated menu items. Pure: no database, no file access.
//
// Accepted layouts (headers are found automatically, in any column order, in any of these words):
//   A) Category | Item | Price | Description        a blank Category cell means "same as the row above" (merged cells work)
//   B) Item | Price                                  a row with only a name and no price is a section heading ("Hot Bar") for the items below it

export const MAX_MENU_ROWS = 500;
const NAME_MAX = 80, DESC_MAX = 200, PRICE_MAX = 9_999_999;

const HEADER_WORDS = {
  category: ['category', 'categories', 'section', 'sections', 'group', 'menu section', 'menu category', 'type'],
  name: ['item', 'items', 'item name', 'name', 'product', 'product name', 'drink', 'dish', 'menu item'],
  price: ['price', 'prices', 'rate', 'rs', 'price rs', 'price pkr', 'amount', 'cost'],
  description: ['description', 'details', 'detail', 'notes', 'note'],
};

/** Case/space/punctuation-insensitive key, used to match names ("Cafe  Latte" = "cafe latte"). */
export const nameKey = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const headerOf = (cell) => { const k = nameKey(cell); return Object.keys(HEADER_WORDS).find((h) => HEADER_WORDS[h].includes(k)) ?? null; };

/** "Rs 1,200", "500/-", 550.5 -> 1200 | 500 | 550.5 ; null when it is not a usable price. */
export function parsePrice(raw) {
  const s = String(raw ?? '').trim().replace(/^(rs\.?|pkr)\s*/i, '').replace(/(\/-|rs\.?|pkr)\s*$/i, '').replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s), cents = Math.round(n * 100);
  if (Math.abs(n * 100 - cents) > 1e-6) return null; // more than 2 decimals
  return cents / 100;
}

function findHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i += 1) {
    const cols = {};
    (rows[i] ?? []).forEach((c, ci) => { const h = headerOf(c); if (h && cols[h] === undefined) cols[h] = ci; });
    if (cols.name !== undefined && cols.price !== undefined) return { index: i, cols };
  }
  return null;
}

/**
 * @returns {{ items: {row:number, category:string|null, name:string, price:number, description:string|null}[], errors: {row:number, message:string}[] }}
 * `row` is the row number the user sees in Excel. Throws Error(plain message) when the sheet cannot be understood at all.
 */
export function parseMenuRows(rows) {
  const header = findHeader(rows);
  if (!header) throw new Error('Could not find the column headings. The first row must say Item and Price (and Category, if the sheet has sections). Use the template.');
  const { cols, index } = header;
  const hasCategoryColumn = cols.category !== undefined;
  const body = rows.slice(index + 1);
  if (body.length > MAX_MENU_ROWS + 200) throw new Error(`This sheet has too many rows. Import at most ${MAX_MENU_ROWS} items at a time.`);

  const items = [], errors = [], seen = new Map();
  let currentCategory = null;
  const fail = (row, message) => errors.push({ row, message });

  body.forEach((cells = [], i) => {
    const row = index + 2 + i;
    const get = (k) => (cols[k] === undefined ? '' : clean(cells[cols[k]]));
    const name = get('name'), priceText = get('price');
    if (hasCategoryColumn && get('category')) currentCategory = get('category');
    if (!name && !priceText && !get('description') && !(hasCategoryColumn && get('category'))) return; // blank row
    if (!hasCategoryColumn && name && !priceText && !get('description')) { currentCategory = name; return; } // layout B: a section heading
    if (!name) return fail(row, 'Item name is missing.');
    if (!priceText) return fail(row, `"${name}" has no price.`);
    const price = parsePrice(priceText);
    if (price === null) return fail(row, `"${name}": price "${priceText}" is not a valid amount (use numbers, at most 2 decimals).`);
    if (price > PRICE_MAX) return fail(row, `"${name}": price is too large.`);
    if (name.length < 2 || name.length > NAME_MAX) return fail(row, `"${name}": item name must be 2 to ${NAME_MAX} characters.`);
    const category = currentCategory;
    if (category && (category.length < 2 || category.length > NAME_MAX)) return fail(row, `"${name}": section name must be 2 to ${NAME_MAX} characters.`);
    const description = get('description') || null;
    if (description && description.length > DESC_MAX) return fail(row, `"${name}": description is longer than ${DESC_MAX} characters.`);
    const key = nameKey(name);
    if (seen.has(key)) return fail(row, `"${name}" is already listed on row ${seen.get(key)}. Each item must appear once.`);
    seen.set(key, row);
    items.push({ row, category, name, price, description });
  });

  if (items.length + errors.length === 0) throw new Error('The sheet has headings but no items under them.');
  if (items.length > MAX_MENU_ROWS) throw new Error(`This sheet has ${items.length} items. Import at most ${MAX_MENU_ROWS} at a time.`);
  return { items, errors };
}
