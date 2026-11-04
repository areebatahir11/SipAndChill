import { handle, ok, readJson } from '@/lib/http';
import { requireApi } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { updateSettingsSchema } from '@/lib/validation/settings';
import { getSettings, updateSettings } from '@/modules/settings/service';

export const GET = handle(async (request) => {
  const auth = await requireApi(request, P.SETTINGS_MANAGE);
  return ok(await getSettings(auth.tenantId));
});

export const PATCH = handle(async (request) => {
  const auth = await requireApi(request, P.SETTINGS_MANAGE);
  return ok(await updateSettings(auth, updateSettingsSchema.parse(await readJson(request))));
});
