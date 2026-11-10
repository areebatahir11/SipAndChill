import { handle, ok } from '@/lib/http';
import { requirePlatformApi } from '@/lib/auth/platform-guard';
import { readUpload } from '@/lib/uploads';
import { applyMenuImport, MENU_FILE_MAX_BYTES, previewMenuImport } from '@/modules/menu/import';

/**
 * PearlSolutions sets up a client's menu from their Excel/CSV file.
 * apply=false (default): a dry run that only reports what would change. apply=true: saves it (all or nothing).
 */
export const POST = handle(async (request, { params }) => {
  const admin = await requirePlatformApi(request);
  const { id } = await params;
  const { file, form } = await readUpload(request, 'file', { maxBytes: MENU_FILE_MAX_BYTES, missing: 'Choose the menu file first.', tooBig: 'This file is too big. A menu sheet should be under 1 MB.' });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const slug = String(form.get('client') ?? ''); // the client the page believes it is importing into; checked against the URL's client
  return ok(form.get('apply') === 'true' ? await applyMenuImport(admin, id, bytes, slug) : await previewMenuImport(id, bytes, slug));
});
