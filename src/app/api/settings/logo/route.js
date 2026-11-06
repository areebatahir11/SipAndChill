import { HttpError, handle } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { getLogo } from '@/modules/settings/logo';

/**
 * The logo of the signed-in user's own business, for the sidebar. No id in the URL, so one business can never fetch another's.
 * Read-only on purpose: logos are uploaded by PearlSolutions in /platform (POST /api/platform/clients/:id/logo).
 */
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
