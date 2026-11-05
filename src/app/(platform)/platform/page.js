import { requirePlatformPage } from '@/lib/auth/platform-guard';
import PlatformDashboard from '@/features/platform/PlatformDashboard';

export default async function PlatformHomePage() {
  await requirePlatformPage();
  return <PlatformDashboard />;
}
