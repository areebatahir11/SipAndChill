// Pure rules for a menu item picture (plain .mjs so the API, the browser and the tests share them).
// Same safety stance as the business logo: PNG / JPG / WebP only, type decided by the file's first bytes, never SVG.
import { detectLogoType } from '../branding/logo.mjs';

export const PRODUCT_IMAGE_MAX_BYTES = 150 * 1024;
export const PRODUCT_IMAGE_MAX_SIDE = 640; // the browser shrinks bigger photos to this before uploading

/** Throws Error(plain message) when the bytes are not an acceptable picture; otherwise returns the content type. */
export function assertProductImage(bytes) {
  if (!bytes || bytes.length === 0) throw new Error('Choose a picture first.');
  if (bytes.length > PRODUCT_IMAGE_MAX_BYTES) throw new Error('This picture is too big. Please use one under 150 KB.');
  const type = detectLogoType(bytes);
  if (!type) throw new Error('The picture must be a PNG, JPG or WebP file.');
  return type;
}
