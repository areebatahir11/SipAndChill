import test from 'node:test';
import assert from 'node:assert/strict';
import { assertLogo, detectLogoType, LOGO_MAX_BYTES } from '../src/lib/branding/logo.mjs';

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Uint8Array.from([...Buffer.from('RIFF'), 1, 0, 0, 0, ...Buffer.from('WEBP')]);

test('logo type comes from the file bytes, not the file name', () => {
  assert.equal(detectLogoType(PNG), 'image/png');
  assert.equal(detectLogoType(JPG), 'image/jpeg');
  assert.equal(detectLogoType(WEBP), 'image/webp');
});

test('SVG, HTML, text and empty files are rejected (an SVG can carry scripts)', () => {
  for (const text of ['<svg xmlns="http://www.w3.org/2000/svg"></svg>', '<html><script>alert(1)</script>', 'GIF89a', '']) {
    assert.equal(detectLogoType(Buffer.from(text)), null, text);
  }
  assert.throws(() => assertLogo(Buffer.from('<svg></svg>')), /PNG, JPG or WebP/);
  assert.throws(() => assertLogo(new Uint8Array(0)), /Choose a logo/);
});

test('a logo above the size limit is rejected, one at the limit is accepted', () => {
  const big = new Uint8Array(LOGO_MAX_BYTES + 1); big.set(PNG);
  assert.throws(() => assertLogo(big), /too big/);
  const edge = new Uint8Array(LOGO_MAX_BYTES); edge.set(PNG);
  assert.equal(assertLogo(edge), 'image/png');
});
