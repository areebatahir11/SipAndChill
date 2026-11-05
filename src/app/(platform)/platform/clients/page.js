import { requirePlatformPage } from '@/lib/auth/platform-guard';
import ClientsManager from '@/features/platform/ClientsManager';

export default async function ClientsPage() {
  await requirePlatformPage();
  return <ClientsManager />;
}
