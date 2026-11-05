import { requirePlatformPage } from '@/lib/auth/platform-guard';
import ClientDetail from '@/features/platform/ClientDetail';

export default async function ClientDetailPage({ params }) {
  await requirePlatformPage();
  const { id } = await params;
  return <ClientDetail id={id} />;
}
