import { requirePage } from '@/lib/auth/guard';
import { hasPermission, PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { listItems } from '@/modules/inventory/service';
import { listSuppliers } from '@/modules/suppliers/service';
import InventoryManager from '@/features/inventory/InventoryManager';

export default async function InventoryPage() {
  const auth = await requirePage([P.INGREDIENTS_VIEW, P.INVENTORY_VIEW]);
  const [items, suppliers] = await Promise.all([
    listItems(auth.tenantId, {}),
    hasPermission(auth.permissions, P.SUPPLIERS_VIEW) ? listSuppliers(auth.tenantId) : [], // dropdown only
  ]);
  return <InventoryManager initialItems={plain(items)} initialSuppliers={plain(suppliers)} />;
}
