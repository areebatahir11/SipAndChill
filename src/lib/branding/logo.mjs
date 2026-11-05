// Pure rules for a business logo upload (plain .mjs so the API, the browser and the tests share them).
// SVG is deliberately NOT allowed: an SVG can carry scripts, a PNG / JPG / WebP cannot.

export const LOGO_MAX_BYTES = 300 * 1024;
export const LOGO_MAX_SIDE = 512; // the browser shrinks bigger pictures to this before uploading

const ascii = (b, from, to) => String.fromCharCode(...b.slice(from, to));

/** Returns 'image/png' | 'image/jpeg' | 'image/webp' from the file's first bytes (not from its name), or null. */
export function detectLogoType(bytes) {
  const b = bytes;
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 4) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Throws Error(plain message) when the bytes are not an acceptable logo; otherwise returns the content type. */
export function assertLogo(bytes) {
  if (!bytes || bytes.length === 0) throw new Error('Choose a logo picture first.');
  if (bytes.length > LOGO_MAX_BYTES) throw new Error('This logo is too big. Please use a picture under 300 KB.');
  const type = detectLogoType(bytes);
  if (!type) throw new Error('The logo must be a PNG, JPG or WebP picture.');
  return type;
}
