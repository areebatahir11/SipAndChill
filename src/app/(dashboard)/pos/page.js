import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { getSettings } from '@/modules/settings/service';
import { normalizeWidth } from '@/lib/orders/receipt.mjs';
import PosCounter from '@/features/pos/PosCounter';

export default async function PosPage() {
  const auth = await requirePage(P.ORDERS_CREATE);
  const settings = await getSettings(auth.tenantId); // paper width, for the Printer button's setup dialog
  return <PosCounter shopPaper={normalizeWidth(settings.receiptWidthMm)} />;
}
