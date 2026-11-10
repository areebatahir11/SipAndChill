import { handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { readUpload } from '@/lib/uploads';
import { PRODUCT_IMAGE_MAX_BYTES } from '@/lib/menu/product-image.mjs';
import { saveProductImage } from '@/modules/menu/images';

/** PearlSolutions sets a menu item's picture for a client. The item must belong to that client (saveProductImage checks it). */
export const POST = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id, productId } = await params;
  const { file } = await readUpload(request, 'image', { maxBytes: PRODUCT_IMAGE_MAX_BYTES, missing: 'Choose a picture first.', tooBig: 'This picture is too big. Please use one under 150 KB.' });
  return ok(await saveProductImage({ tenantId: id, user: admin.user }, productId, Buffer.from(await file.arrayBuffer())));
});
