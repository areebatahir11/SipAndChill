import Sidebar from '@/components/layout/Sidebar';
import { AuthProvider } from '@/components/layout/AuthProvider';
import ChangePasswordForm from '@/features/account/ChangePasswordForm';
import TermsGate from '@/features/legal/TermsGate';
import { requirePage } from '@/lib/auth/guard';

/**
 * Every page in this route group requires a signed-in user. Individual pages add their own permission check.
 * A user still on a temporary password sees only the "choose your own password" screen, whatever URL they open.
 * After that, a Business Owner who has not accepted the current Terms & Conditions sees only the terms screen.
 */
export default async function DashboardLayout({ children }) {
  const { user, tenant, role, permissions, mustChangePassword, termsRequired } = await requirePage();
  return (
    <AuthProvider value={{ user, tenant, role, permissions }}>
      {mustChangePassword ? (
        <main className="mx-auto w-full max-w-[520px] p-6 pt-16"><ChangePasswordForm forced /></main>
      ) : termsRequired ? (
        <main className="mx-auto w-full max-w-[760px] p-4 pt-10 md:p-6 md:pt-14"><TermsGate /></main>
      ) : (
        <div className="grid min-h-screen md:grid-cols-[264px_1fr]">
          <Sidebar />
          <main className="w-full min-w-0 max-w-[1200px] p-4 md:p-8">{children}</main>
        </div>
      )}
    </AuthProvider>
  );
}
