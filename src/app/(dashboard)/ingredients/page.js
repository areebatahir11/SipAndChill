import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import InventoryManager from '@/features/inventory/InventoryManager';

export default async function InventoryPage() {
  await requirePage([P.INGREDIENTS_VIEW, P.INVENTORY_VIEW]);
  return <InventoryManager />;
}
