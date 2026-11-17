import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertProductImage, PRODUCT_IMAGE_MAX_BYTES } from '../src/lib/menu/product-image.mjs';

const png = (n = 16) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); return b; };
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('menu picture: type comes from the bytes; PNG, JPG and WebP only', () => {
  assert.equal(assertProductImage(png()), 'image/png');
  assert.equal(assertProductImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'image/jpeg');
  const webp = new Uint8Array(16); webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(assertProductImage(webp), 'image/webp');
  assert.throws(() => assertProductImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>')), /PNG, JPG or WebP/); // SVG can carry scripts
  assert.throws(() => assertProductImage(new TextEncoder().encode('GIF89a......')), /PNG, JPG or WebP/);
  assert.throws(() => assertProductImage(new Uint8Array(0)), /Choose a picture/);
});

test('menu picture: 150 KB limit, exact boundary accepted', () => {
  assert.equal(PRODUCT_IMAGE_MAX_BYTES, 150 * 1024);
  assert.equal(assertProductImage(png(PRODUCT_IMAGE_MAX_BYTES)), 'image/png');
  assert.throws(() => assertProductImage(png(PRODUCT_IMAGE_MAX_BYTES + 1)), /too big/);
});

test('menu picture: the list queries select only the version, never the bytes', () => {
  const products = read('src/modules/menu/products.js');
  assert.match(products, /image: \{ select: \{ updatedAt: true \} \}/);
  assert.doesNotMatch(products, /image: true/);
  assert.match(read('src/modules/orders/service.js'), /image: \{ select: \{ updatedAt: true \} \}/);
});

test('menu picture: every read and write is scoped to the signed-in business', () => {
  const svc = read('src/modules/menu/images.js');
  assert.match(svc, /findFirst\(\{ where: \{ productId, tenantId \}/);
  assert.match(svc, /findFirst\(\{ where: \{ id: productId, tenantId \}/);
  const route = read('src/app/api/products/[id]/image/route.js');
  assert.match(route, /requireApi\(request, P\.PRODUCTS_MANAGE\)/); // only people who manage the menu can change pictures
  assert.match(route, /immutable/);
});

test('POS grid is sized by available room, not browser width (the bug that cut "Cappuccino" on scaled screens)', () => {
  const tile = read('src/features/pos/MenuTile.js');
  assert.match(tile, /repeat\(auto-fill,minmax\(10\.5rem,1fr\)\)/);
  assert.doesNotMatch(read('src/features/pos/PosCounter.js'), /xl:grid-cols-4/);
  assert.match(tile, /break-words/);
});
