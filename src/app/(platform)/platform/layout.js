import PlatformSidebar from '@/components/layout/PlatformSidebar';
import { requirePlatformPage } from '@/lib/auth/platform-guard';

/** Every page under /platform requires a signed-in PearlSolutions admin. */
export default async function PlatformLayout({ children }) {
  const { user } = await requirePlatformPage();
  return (
    <div className="grid min-h-screen md:grid-cols-[264px_1fr]">
      <PlatformSidebar user={user} />
      <main className="w-full min-w-0 max-w-[1200px] p-4 md:p-8">{children}</main>
    </div>
  );
}
