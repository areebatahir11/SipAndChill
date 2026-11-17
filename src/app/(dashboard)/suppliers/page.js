import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import SuppliersManager from '@/features/suppliers/SuppliersManager';

export default async function SuppliersPage() {
  await requirePage(P.SUPPLIERS_VIEW);
  return <SuppliersManager />;
}
