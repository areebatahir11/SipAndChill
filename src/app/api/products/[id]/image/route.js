import { HttpError, handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { PRODUCT_IMAGE_MAX_BYTES } from '@/lib/menu/product-image.mjs';
import { getProductImage, removeProductImage, saveProductImage } from '@/modules/menu/images';

const TOO_BIG = 'This picture is too big. Please use one under 150 KB.';

/** The picture of one menu item of the signed-in business. Any signed-in user (the cashier's counter shows it). */
export const GET = handle(async (request, { params }) => {
  const auth = await requireApi(request, []);
  const { id } = await params;
  const image = await getProductImage(auth.tenantId, id);
  if (!image) throw new HttpError(404, 'No picture.', 'NOT_FOUND');
  return new Response(image.data, {
    headers: {
      'Content-Type': image.contentType,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
      // The page adds ?v=<version>, so a changed picture is a new URL and the old one can be cached for a year.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});

export const POST = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.PRODUCTS_MANAGE);
  const { id } = await params;
  if (Number(request.headers.get('content-length')) > PRODUCT_IMAGE_MAX_BYTES + 64 * 1024) throw new HttpError(413, TOO_BIG, 'VALIDATION'); // refused before it is read into memory
  const form = await request.formData().catch(() => { throw new HttpError(400, 'Choose a picture first.', 'VALIDATION'); });
  const file = form.get('image');
  if (!file || typeof file === 'string') throw new HttpError(400, 'Choose a picture first.', 'VALIDATION');
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) throw new HttpError(413, TOO_BIG, 'VALIDATION');
  return ok(await saveProductImage(auth, id, Buffer.from(await file.arrayBuffer())));
});

export const DELETE = handle(async (request, { params }) => {
  const auth = await requireApi(request, P.PRODUCTS_MANAGE);
  const { id } = await params;
  return ok(await removeProductImage(auth, id));
});
