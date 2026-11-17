import Sidebar from '@/components/layout/Sidebar';
import { AuthProvider } from '@/components/layout/AuthProvider';
import ChangePasswordForm from '@/features/account/ChangePasswordForm';
import TermsGate from '@/features/legal/TermsGate';
import { requirePage } from '@/lib/auth/guard';
import { requiredStep } from '@/lib/auth/gates.mjs';
import { canSeeBillingNotice, hasPermission, PERMISSIONS } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { getPlan } from '@/modules/billing/service';
import PlanBanner from '@/features/billing/PlanBanner';

/**
 * Every page in this route group requires a signed-in user. Individual pages add their own permission check.
 * A user still on a temporary password sees only the "choose your own password" screen, whatever URL they open.
 * After that, a Business Owner who has not accepted the current Terms & Conditions sees only the terms screen.
 * Billing: the owner sees the full plan (sidebar chip, banner, Plan & Billing page); a manager sees only the reminder banner, with no amounts;
 * cashiers and inventory staff see nothing.
 */
export default async function DashboardLayout({ children }) {
  const { user, tenant, role, permissions, mustChangePassword, termsRequired } = await requirePage();
  const step = requiredStep({ mustChangePassword, termsRequired }); // same order the API enforces
  const isOwner = hasPermission(permissions, PERMISSIONS.SETTINGS_MANAGE); // owner: full plan, sidebar chip, billing page
  const plan = step === null && canSeeBillingNotice(permissions) ? await getPlan(tenant.id) : null; // owner + manager: reminder banner
  return (
    <AuthProvider value={{ user, tenant, role, permissions, plan: isOwner && plan ? plain(plan) : null }}>
      {step === 'password' ? (
        <main className="mx-auto w-full max-w-[520px] p-6 pt-16"><ChangePasswordForm forced /></main>
      ) : step === 'terms' ? (
        <main className="mx-auto w-full max-w-[760px] p-4 pt-10 md:p-6 md:pt-14"><TermsGate /></main>
      ) : (
        <div className="grid min-h-screen md:grid-cols-[264px_1fr]">
          <Sidebar />
          <main className="w-full min-w-0 max-w-[1200px] p-4 md:p-8">
            <PlanBanner plan={plan} isOwner={isOwner} />
            {children}
          </main>
        </div>
      )}
    </AuthProvider>
  );
}
