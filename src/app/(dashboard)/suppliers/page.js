import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { listSuppliers } from '@/modules/suppliers/service';
import SuppliersManager from '@/features/suppliers/SuppliersManager';

export default async function SuppliersPage() {
  const auth = await requirePage(P.SUPPLIERS_VIEW);
  return <SuppliersManager initialRows={plain(await listSuppliers(auth.tenantId))} />;
}
