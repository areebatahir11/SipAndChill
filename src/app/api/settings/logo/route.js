import { HttpError, handle, ok } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { LOGO_MAX_BYTES } from '@/lib/branding/logo.mjs';
import { getLogo, removeLogo, saveLogo } from '@/modules/settings/logo';

/** The logo of the signed-in user's own business. No id in the URL, so one business can never fetch another's. */
export const GET = handle(async (request) => {
  const auth = await requireApi(request, []); // any signed-in user of this business (the sidebar shows it to everyone)
  const logo = await getLogo(auth.tenantId);
  if (!logo) throw new HttpError(404, 'No logo.', 'NOT_FOUND');
  return new Response(logo.data, {
    headers: {
      'Content-Type': logo.contentType,
      'X-Content-Type-Options': 'nosniff',
      // The page adds ?v=<version>, so a changed logo is a new URL and the old one can be cached for a year.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
});

export const POST = handle(async (request) => {
  const auth = await requireApi(request, P.SETTINGS_MANAGE);
  const form = await request.formData().catch(() => { throw new HttpError(400, 'Choose a logo picture first.', 'VALIDATION'); });
  const file = form.get('logo');
  if (!file || typeof file === 'string') throw new HttpError(400, 'Choose a logo picture first.', 'VALIDATION');
  if (file.size > LOGO_MAX_BYTES) throw new HttpError(413, 'This logo is too big. Please use a picture under 300 KB.', 'VALIDATION'); // checked before reading it
  return ok(await saveLogo(auth, Buffer.from(await file.arrayBuffer())));
});

export const DELETE = handle(async (request) => {
  const auth = await requireApi(request, P.SETTINGS_MANAGE);
  return ok(await removeLogo(auth));
});
