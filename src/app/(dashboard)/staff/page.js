import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { listStaff } from '@/modules/users/service';
import StaffManager from '@/features/staff/StaffManager';

export default async function StaffPage() {
  const auth = await requirePage(P.USERS_VIEW);
  return <StaffManager initialStaff={plain(await listStaff(auth.tenantId))} />;
}
