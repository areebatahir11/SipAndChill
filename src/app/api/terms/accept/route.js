import { handle, ok, readJson, HttpError } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { clientIp } from '@/lib/auth/client-ip';
import { TERMS_VERSION } from '@/lib/legal/terms.mjs';
import { acceptTermsSchema } from '@/lib/validation/auth';
import { acceptTerms } from '@/modules/auth/terms';

/** The Business Owner agrees to the current Terms & Conditions. This is the only API open to an owner who has not accepted yet. */
export const POST = handle(async (request) => {
  const auth = await requireApi(request, null, { allowTerms: true });
  const { version } = acceptTermsSchema.parse(await readJson(request));
  if (version !== TERMS_VERSION) throw new HttpError(409, 'The Terms & Conditions were just updated. Please reload the page and read the latest version.', 'TERMS_OUTDATED');
  await acceptTerms(auth, { ipAddress: clientIp(request), userAgent: request.headers.get('user-agent') });
  return ok({ accepted: true });
});
