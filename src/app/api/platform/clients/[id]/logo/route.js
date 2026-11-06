import { HttpError, handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { LOGO_MAX_BYTES } from '@/lib/branding/logo.mjs';
import { getLogo } from '@/modules/settings/logo';
import { removeClientLogo, saveClientLogo } from '@/modules/platform/logo';

const noLogo = () => new HttpError(404, 'No logo.', 'NOT_FOUND');

/** Preview of a client's logo for the PearlSolutions admin. */
export const GET = handle(async (request, { params }) => {
  await requirePlatformApi(request);
  const { id } = await params;
  const logo = await getLogo(id);
  if (!logo) throw noLogo();
  return new Response(logo.data, {
    headers: { 'Content-Type': logo.contentType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
});

export const POST = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id } = await params;
  const form = await request.formData().catch(() => { throw new HttpError(400, 'Choose a logo picture first.', 'VALIDATION'); });
  const file = form.get('logo');
  if (!file || typeof file === 'string') throw new HttpError(400, 'Choose a logo picture first.', 'VALIDATION');
  if (file.size > LOGO_MAX_BYTES) throw new HttpError(413, 'This logo is too big. Please use a picture under 300 KB.', 'VALIDATION'); // checked before reading it
  return ok(await saveClientLogo(admin, id, Buffer.from(await file.arrayBuffer())));
});

export const DELETE = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id } = await params;
  return ok(await removeClientLogo(admin, id));
});
