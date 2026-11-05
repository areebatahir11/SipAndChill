import { getOrder } from './service';
import { getSettings } from '@/modules/settings/service';
import { buildReceipt, normalizeWidth } from '@/lib/orders/receipt.mjs';

/** Receipt model + paper width for one order of the signed-in business (used by the print page and the print API). */
export async function getReceiptForPrint(auth, orderId, widthOverride) {
  const order = await getOrder(auth, orderId);
  const settings = await getSettings(auth.tenantId);
  const paper = normalizeWidth(widthOverride ?? settings.receiptWidthMm);
  const model = buildReceipt(order, { ...settings, currency: settings.currency === 'PKR' ? 'Rs' : settings.currency });
  return { model, paper };
}
