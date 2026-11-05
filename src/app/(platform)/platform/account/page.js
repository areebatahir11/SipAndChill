import { requirePlatformPage } from '@/lib/auth/platform-guard';
import ChangePasswordForm from '@/features/account/ChangePasswordForm';

export default async function PlatformAccountPage() {
  const { user } = await requirePlatformPage();
  return <ChangePasswordForm endpoint="/api/platform/account/password" identity={`${user.email} (PearlSolutions super admin)`} />;
}
