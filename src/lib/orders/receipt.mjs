import { fromMinor, toMinor } from '../money.mjs';

export const RECEIPT_WIDTHS = [58, 80];
// Characters per line in the monospace font at each paper width (used by the plain-text fallback).
export const CHARS = { 58: 32, 80: 48 };

export const normalizeWidth = (w) => (RECEIPT_WIDTHS.includes(Number(w)) ? Number(w) : 80);

const rs = (minor, currency = 'Rs') => `${currency} ${Math.floor(minor / 100).toLocaleString('en-PK')}${minor % 100 ? '.' + String(minor % 100).padStart(2, '0') : ''}`;

/**
 * Presentation model for a receipt. Everything printed comes from the saved order (snapshots),
 * never from the live product list, so a reprint years later is identical.
 */
export function buildReceipt(order, settings) {
  const total = toMinor(order.total);
  const paid = toMinor(order.amountPaid);
  const received = order.payments.reduce((s, p) => s + toMinor(p.amountReceived), 0);
  const change = order.payments.reduce((s, p) => s + toMinor(p.changeReturned), 0);
  const c = settings.currency ?? 'Rs';
  return {
    businessName: settings.businessName,
    phone: settings.phone || null,
    address: settings.address || null,
    footer: settings.receiptFooter || null,
    orderNo: order.orderNo,
    createdAt: order.createdAt,
    cashierName: order.cashierName,
    cancelled: order.status === 'CANCELLED',
    lines: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: rs(toMinor(i.unitPrice), c), lineTotal: rs(toMinor(i.lineTotal), c) })),
    subtotal: rs(toMinor(order.subtotal), c),
    discount: toMinor(order.discount) > 0 ? rs(toMinor(order.discount), c) : null,
    discountLabel: toMinor(order.discount) > 0 ? (order.discountLabel || null) : null,
    total: rs(total, c),
    received: rs(received, c),
    change: rs(change, c),
    outstanding: rs(Math.max(total - paid, 0), c),
    hasOutstanding: total - paid > 0,
    paymentStatus: order.paymentStatus,
  };
}
export { fromMinor };
