import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { plain } from '@/lib/plain';
import { getSettings } from '@/modules/settings/service';
import { listPosProducts } from '@/modules/orders/service';
import { normalizeWidth } from '@/lib/orders/receipt.mjs';
import PosCounter from '@/features/pos/PosCounter';

export default async function PosPage() {
  const auth = await requirePage(P.ORDERS_CREATE);
  // Menu and shop settings are fetched together on the server: the counter opens with its menu already in place.
  const [settings, menu] = await Promise.all([getSettings(auth.tenantId), listPosProducts(auth.tenantId)]);
  return <PosCounter shopPaper={normalizeWidth(settings.receiptWidthMm)} initialMenu={plain(menu)} />;
}
