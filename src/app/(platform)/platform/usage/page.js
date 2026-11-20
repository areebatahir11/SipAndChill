import { requirePlatformPage } from '@/lib/auth/platform-guard';
import UsageAnalytics from '@/features/platform/UsageAnalytics';

export default async function UsagePage() {
  await requirePlatformPage();
  return <UsageAnalytics />;
}
