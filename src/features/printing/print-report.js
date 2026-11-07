'use client';
// Tells the server what happened to a receipt ('sent' | 'opened' | 'confirmed' | 'failed') so the result survives closing a dialog,
// navigating and refreshing. Best effort and silent: the sale is already saved, a failed report must never block or undo anything.
import { api } from '@/lib/api-client';

export const PRINT_CHANGED = 'pearl:print-changed'; // banners / lists listen to this and reload

export function notifyPrintChanged() {
  try { window.dispatchEvent(new Event(PRINT_CHANGED)); } catch { /* not in a browser */ }
}

/** Resolves to true when saved. No orderId (test slip, cash drawer) = nothing to record. */
export async function reportPrint(orderId, event) {
  if (!orderId) return false;
  try {
    await api(`/api/orders/${orderId}/print`, { method: 'POST', body: { event } });
    notifyPrintChanged();
    return true;
  } catch { return false; }
}
