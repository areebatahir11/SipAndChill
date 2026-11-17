import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import StaffManager from '@/features/staff/StaffManager';

export default async function StaffPage() {
  await requirePage(P.USERS_VIEW);
  return <StaffManager />;
}
