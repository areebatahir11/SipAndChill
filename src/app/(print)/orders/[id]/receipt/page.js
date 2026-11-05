import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';
import { HttpError } from '@/lib/http';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import { getReceiptForPrint } from '@/modules/orders/receipt';
import Receipt from '@/features/receipt/Receipt';

export const metadata = { title: 'Receipt' };

export default async function ReceiptPage({ params, searchParams }) {
  const auth = await requirePage(P.RECEIPTS_PRINT);
  const { id } = await params;
  const sp = await searchParams;
  let receipt;
  try { receipt = await getReceiptForPrint(auth, id, sp.w); } catch (e) { if (e instanceof HttpError && e.status === 404) notFound(); throw e; }
  return <Receipt model={receipt.model} width={receipt.paper} orderId={id} autoprint={sp.autoprint === '1'} />;
}
