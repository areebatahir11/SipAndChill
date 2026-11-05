import { requirePage } from '@/lib/auth/guard';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { getSettings } from '@/modules/settings/service';
import { normalizeWidth } from '@/lib/orders/receipt.mjs';
import PrinterPanel from '@/features/printing/PrinterPanel';

export const metadata = { title: 'Receipt Printer' };

/** Printer settings are per device (the counter PC / tablet that the printer is plugged into), so every
 *  user who may print receipts can open this page, not only the owner. */
export default async function PrinterPage() {
  const auth = await requirePage(P.RECEIPTS_PRINT);
  const settings = await getSettings(auth.tenantId);
  return <PrinterPanel shopPaper={normalizeWidth(settings.receiptWidthMm)} />;
}
