import Sidebar from '@/components/layout/Sidebar';
import { AuthProvider } from '@/components/layout/AuthProvider';
import { requirePage } from '@/lib/auth/guard';

/** Every page in this route group requires a signed-in user. Individual pages add their own permission check. */
export default async function DashboardLayout({ children }) {
  const { user, tenant, role, permissions } = await requirePage();
  return (
    <AuthProvider value={{ user, tenant, role, permissions }}>
      <div className="grid min-h-screen md:grid-cols-[264px_1fr]">
        <Sidebar />
        <main className="w-full min-w-0 max-w-[1200px] p-4 md:p-8">{children}</main>
      </div>
    </AuthProvider>
  );
}
