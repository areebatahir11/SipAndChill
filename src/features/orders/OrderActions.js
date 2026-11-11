'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Form, Input, Modal } from '@/components/ui';
import PaymentPicker from '@/features/pos/PaymentPicker';
import { api } from '@/lib/api-client';
import { toMinor } from '@/lib/money.mjs';
import { emptyPayForm, payloadOf, readPayForm } from '@/lib/payment-form.mjs';
import { money } from '@/lib/format';
import { useSubmit } from '@/lib/use-submit';
import PrintReceiptButton from '@/features/printing/PrintReceiptButton';

export default function OrderActions({ orderId, outstanding, canPay, canCancel, canPrint }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(null); // 'pay' | 'cancel'
  const done = () => { setDialog(null); router.refresh(); };

  return (
    <>
      {canPrint && <PrintReceiptButton orderId={orderId} />}
      {canPay && <Button variant="accent" onClick={() => setDialog('pay')}>Take payment</Button>}
      {canCancel && <Button variant="danger" onClick={() => setDialog('cancel')}>Cancel order</Button>}
      {dialog === 'pay' && <PayDialog orderId={orderId} outstanding={outstanding} onDone={done} onClose={() => setDialog(null)} />}
      {dialog === 'cancel' && <CancelDialog orderId={orderId} onDone={done} onClose={() => setDialog(null)} />}
    </>
  );
}

function PayDialog({ orderId, outstanding, onDone, onClose }) {
  const [form, setForm] = useState(emptyPayForm); // cash and/or online (JazzCash, Easypaisa, bank); both = split payment
  const owed = toMinor(outstanding);
  const res = useMemo(() => readPayForm(form, owed), [form, owed]);
  const { busy, error, submit } = useSubmit(async () => { await api(`/api/orders/${orderId}/payments`, { method: 'POST', body: { payments: payloadOf(res.payments) } }); onDone(); });
  return (
    <Modal title="Take payment" onClose={onClose}>
      <Form onSubmit={submit}>
        <p className="text-graphite">Outstanding Amount: <b className="text-night">{money(outstanding)}</b></p>
        <PaymentPicker form={form} setForm={setForm} dueMinor={owed} result={res} tone="light" />
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button type="submit" variant="primary" disabled={busy || res.payments.length === 0 || Boolean(res.error)}>{busy ? 'Saving…' : 'Record payment'}</Button>
        </div>
      </Form>
    </Modal>
  );
}

function CancelDialog({ orderId, onDone, onClose }) {
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(false);
  const { busy, error, submit } = useSubmit(async () => { await api(`/api/orders/${orderId}/cancel`, { method: 'POST', body: { reason, restock } }); onDone(); });
  return (
    <Modal title="Cancel this order?" onClose={onClose}>
      <Form onSubmit={submit}>
        <p className="text-graphite">A cancelled order is removed from sales. This cannot be undone.</p>
        <Field label="Reason"><Input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <label className="flex items-start gap-2.5">
          <input type="checkbox" className="mt-1 size-4" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          <span>Put the ingredients back in stock <small className="block text-graphite">Tick only if nothing was prepared.</small></span>
        </label>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Keep order</Button>
          <Button type="submit" variant="dangerSolid" disabled={busy}>{busy ? 'Cancelling…' : 'Cancel order'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
