import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseCsv } from '../src/lib/menu/import/csv.mjs';
import { readXlsx } from '../src/lib/menu/import/xlsx.mjs';
import { nameKey, parseMenuRows, parsePrice } from '../src/lib/menu/import/parse-menu.mjs';
import { planMenuImport } from '../src/lib/menu/import/plan.mjs';
import { fileKey, matchImage } from '../src/lib/menu/match-images.mjs';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const xlsx = (f) => parseMenuRows(readXlsx(new Uint8Array(readFileSync(new URL(`./fixtures/${f}`, import.meta.url)))));

// ---------- reading files ----------
test('csv: quotes, BOM, semicolon (Excel in some regions) and line breaks inside quotes', () => {
  assert.deepEqual(parseCsv('﻿Item,Price\n"Latte, Large","1,200"\n'), [['Item', 'Price'], ['Latte, Large', '1,200']]);
  assert.deepEqual(parseCsv('Item;Price\nTea;300'), [['Item', 'Price'], ['Tea', '300']]);
  assert.deepEqual(parseCsv('A,B\n"two\nlines",x'), [['A', 'B'], ['two\nlines', 'x']]);
});

test('xlsx: an Excel file and the same sheet re-saved by LibreOffice read the same', () => {
  const a = xlsx('menu-a.xlsx');
  assert.equal(a.items.length, 6);
  assert.deepEqual(xlsx('lo/menu-a.xlsx'), a);
  assert.deepEqual(a.items[0], { row: 4, category: 'Hot Bar', name: 'Cappuccino', price: 500, description: 'Classic' });
  assert.equal(a.items.find((i) => i.name === 'Kiwi Smoothie').price, 450.5);
  assert.ok(a.items.some((i) => i.name === 'Café Crème'), 'accents survive');
});

test('xlsx: a file with no Item/Price headings is refused with a plain message; the blank template has headings but no items', () => {
  assert.throws(() => xlsx('menu-bad.xlsx'), /column headings/);
  const template = readXlsx(new Uint8Array(readFileSync(new URL('../public/templates/menu-import-template.xlsx', import.meta.url))));
  assert.throws(() => parseMenuRows(template), /no items/);
});

// ---------- rules ----------
test('prices: Rs, commas and "/-" are understood; junk and 3 decimals are not', () => {
  assert.equal(parsePrice('Rs 1,200'), 1200);
  assert.equal(parsePrice('500/-'), 500);
  assert.equal(parsePrice('PKR 450.50'), 450.5);
  assert.equal(parsePrice(550), 550);
  for (const bad of ['abc', '', '12.345', '-5', '1e3']) assert.equal(parsePrice(bad), null, bad);
});

test('problem rows carry the row number as Excel shows it (duplicate item, bad price) and the good rows still parse', () => {
  const { items, errors } = xlsx('menu-a.xlsx');
  assert.equal(items.length, 6);
  assert.deepEqual(errors.map((e) => e.row), [9, 10]);
  assert.match(errors[0].message, /already listed on row 8/);
  assert.match(errors[1].message, /Korean Ice Tea.*"abc"/);
});

test('layouts: blank Category cell = same as above; Item+Price only = a bold heading row starts a section', () => {
  const a = parseMenuRows(parseCsv('Category,Item,Price\nHot Bar,Espresso,350\n,Latte,500\nIce Teas,Peach,400'));
  assert.deepEqual(a.items.map((i) => i.category), ['Hot Bar', 'Hot Bar', 'Ice Teas']);
  const b = parseMenuRows(parseCsv('Item,Price\nHot Bar,\nEspresso,350\nIce Teas,\nPeach,400'));
  assert.deepEqual(b.items.map((i) => [i.category, i.name]), [['Hot Bar', 'Espresso'], ['Ice Teas', 'Peach']]);
});

test('headings are found in any column order and wording', () => {
  const { items } = parseMenuRows(parseCsv('Rate,Drink,Section\n350,Espresso,Hot Bar'));
  assert.deepEqual(items[0], { row: 2, category: 'Hot Bar', name: 'Espresso', price: 350, description: null });
});

// ---------- plan (what an import does to an existing menu) ----------
const existing = {
  categories: [{ id: 'c1', name: 'Hot Bar' }],
  products: [
    { id: 'p1', name: 'Cappuccino', price: 500, categoryId: 'c1', categoryName: 'Hot Bar' },
    { id: 'p2', name: 'Espresso', price: 300, categoryId: 'c1', categoryName: 'Hot Bar' },
    { id: 'p9', name: 'Old Item Not In Sheet', price: 100, categoryId: null, categoryName: null },
  ],
};

test('plan: new items, price changes and unchanged items are told apart; names match ignoring capitals and spacing', () => {
  const items = [
    { row: 2, category: 'Hot Bar', name: 'cappuccino ', price: 500, description: null }, // same
    { row: 3, category: 'Hot Bar', name: 'Espresso', price: 350, description: null }, // price 300 -> 350
    { row: 4, category: 'Ice Teas', name: 'Peach Ice Tea', price: 400, description: null }, // new, new section
  ];
  const plan = planMenuImport(items, existing);
  assert.deepEqual(plan.rows.map((r) => r.status), ['same', 'update', 'new']);
  assert.deepEqual(plan.categoriesNew, ['Ice Teas']);
  assert.deepEqual(plan.counts, { newItems: 1, updates: 1, unchanged: 1, newCategories: 1 });
  assert.equal(plan.rows[1].oldPrice, 300);
});

test('plan: an item missing from the sheet is never deleted, and a row without a section never moves an item', () => {
  const plan = planMenuImport([{ row: 2, category: null, name: 'Cappuccino', price: 500, description: null }], existing);
  assert.equal(plan.rows.length, 1); // only what is in the sheet; "Old Item Not In Sheet" is simply not mentioned
  assert.equal(plan.rows[0].status, 'same');
});

test('plan: the same new section written twice becomes one section', () => {
  const plan = planMenuImport([
    { row: 2, category: 'Milk Shakes', name: 'Oreo', price: 450, description: null },
    { row: 3, category: 'milk  shakes', name: 'Mango', price: 450, description: null },
  ], existing);
  assert.deepEqual(plan.categoriesNew, ['Milk Shakes']);
});

// ---------- picture file names ----------
test('pictures: file names match items ignoring capitals, _ - spaces, extension and "(1)"', () => {
  const products = [{ id: 'p1', name: 'Cappuccino' }, { id: 'p2', name: 'Caramel Cappuccino' }, { id: 'p3', name: 'Kiwi Smoothie' }, { id: 'p4', name: 'Peach Smoothie' }, { id: 'p5', name: 'Peach Chiller' }];
  assert.equal(fileKey('Caramel_Cappuccino (1).JPG'), 'caramel cappuccino');
  assert.deepEqual(matchImage('cappuccino.jpg', products), { productId: 'p1', exact: true });
  assert.deepEqual(matchImage('Caramel_Cappuccino.PNG', products), { productId: 'p2', exact: true });
  assert.deepEqual(matchImage('kiwi-smoothie (1).jpg', products), { productId: 'p3', exact: true });
});

test('pictures: a typo is only a flagged guess; an ambiguous or unknown name is never guessed', () => {
  const products = [{ id: 'p1', name: 'Cappuccino' }, { id: 'p4', name: 'Peach Smoothie' }, { id: 'p5', name: 'Peach Chiller' }];
  assert.deepEqual(matchImage('capuccino.webp', products), { productId: 'p1', exact: false }); // must be double-checked by the person
  assert.equal(matchImage('peach.jpg', products), null); // two items start with Peach
  assert.equal(matchImage('IMG_20261109_1832.jpg', products), null);
});

test('nameKey ignores accents, capitals and punctuation', () => {
  assert.equal(nameKey('  Café   Crème! '), 'cafe creme');
});

// ---------- safety of the platform-side wiring ----------
test('import and bulk pictures are platform-admin only, scoped to the client in the URL, and never delete', () => {
  for (const f of ['src/app/api/platform/clients/[id]/menu-import/route.js', 'src/app/api/platform/clients/[id]/menu/route.js', 'src/app/api/platform/clients/[id]/products/[productId]/image/route.js']) {
    assert.match(read(f), /requirePlatformApi\(request\)/, f);
  }
  const svc = read('src/modules/menu/import.js');
  assert.doesNotMatch(svc, /\.delete(Many)?\(/); // an import adds and updates only
  assert.match(svc, /\$transaction/); // all or nothing
  assert.match(svc, /errors\.length\) throw/); // a file with problem rows is refused, not half-applied
  assert.match(read('src/modules/menu/images.js'), /findFirst\(\{ where: \{ id: productId, tenantId \}/); // a client's item id from another client is a 404
});

test('platform import: the dialog names the client it imports into, and the audit log keeps what changed', () => {
  assert.match(read('src/features/platform/MenuImportDialog.js'), /<ImportTarget clientName=\{clientName\}/);
  assert.match(read('src/features/platform/BulkPicturesDialog.js'), /<ImportTarget clientName=\{clientName\}/);
  assert.match(read('src/features/platform/ClientDetail.js'), /clientName=\{client\.name\} clientSlug=\{client\.slug\}/);
  const svc = read('src/modules/menu/import.js');
  assert.match(svc, /action: 'menu\.imported'/);
  assert.match(svc, /price: \[r\.oldPrice, r\.price\]/); // old and new price are recorded
});

test('every query in the menu import is limited to the client being imported into', () => {
  const svc = read('src/modules/menu/import.js');
  assert.match(svc, /db\.category\.findMany\(\{ where: \{ tenantId \}/);
  assert.match(svc, /db\.product\.findMany\(\{ where: \{ tenantId \}/);
  assert.match(svc, /tx\.category\.findMany\(\{ where: \{ tenantId \}/);
  const creates = svc.split('\n').filter((l) => l.includes('createMany('));
  assert.equal(creates.length, 2);
  for (const l of creates) assert.match(l, /tenantId/); // categories and products are created with that tenantId
  assert.doesNotMatch(svc, /\.(updateMany|deleteMany|delete)\(/);
  assert.doesNotMatch(svc, /\$(query|execute)Raw/); // no raw SQL that could skip the tenant filter
});

test('platform import: the client in the URL and the client the page names must be the same one, or nothing is imported', () => {
  const svc = read('src/modules/menu/import.js');
  assert.match(svc, /t\.slug !== expectedSlug/);
  assert.match(svc, /CLIENT_MISMATCH/);
  assert.equal((svc.match(/await assertClient\(tenantId, expectedSlug\)/g) ?? []).length, 2); // both the preview and the real import check it
  assert.match(read('src/app/api/platform/clients/[id]/menu-import/route.js'), /form\.get\('client'\)/);
  assert.match(read('src/features/platform/MenuImportDialog.js'), /form\.append\('client', clientSlug\)/);
});

test('business owners have no import route at all: it exists only under /api/platform', async () => {
  const { readdirSync, existsSync } = await import('node:fs');
  const api = new URL('../src/app/api/', import.meta.url);
  assert.ok(!existsSync(new URL('menu-import', api)));
  assert.ok(!existsSync(new URL('products/import', api)));
  assert.ok(readdirSync(new URL('platform/clients/[id]/', api)).includes('menu-import'));
});
