import Sidebar from '@/components/layout/Sidebar';
import { AuthProvider } from '@/components/layout/AuthProvider';
import ChangePasswordForm from '@/features/account/ChangePasswordForm';
import { requirePage } from '@/lib/auth/guard';

/**
 * Every page in this route group requires a signed-in user. Individual pages add their own permission check.
 * A user still on a temporary password sees only the "choose your own password" screen, whatever URL they open.
 */
export default async function DashboardLayout({ children }) {
  const { user, tenant, role, permissions, mustChangePassword } = await requirePage();
  return (
    <AuthProvider value={{ user, tenant, role, permissions }}>
      {mustChangePassword ? (
        <main className="mx-auto w-full max-w-[520px] p-6 pt-16"><ChangePasswordForm forced /></main>
      ) : (
        <div className="grid min-h-screen md:grid-cols-[264px_1fr]">
          <Sidebar />
          <main className="w-full min-w-0 max-w-[1200px] p-4 md:p-8">{children}</main>
        </div>
      )}
    </AuthProvider>
  );
}
