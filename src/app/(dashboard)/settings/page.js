import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import SettingsForm from '@/features/settings/SettingsForm';

export default async function SettingsPage() {
  await requirePage(P.SETTINGS_MANAGE);
  return <SettingsForm />;
}
