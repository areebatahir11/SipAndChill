'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { fromMinor } from '@/lib/money.mjs';
import { lineTotalMinor } from '@/lib/expenses.mjs';
import { METHOD_LABEL, PAYMENT_METHODS } from '@/lib/payments.mjs';

const TYPES = {
  PURCHASE: { label: 'Stock in (purchase)', qty: 'Quantity received' },
  WASTAGE: { label: 'Wastage / spoiled', qty: 'Quantity wasted' },
  ADJUSTMENT: { label: 'Stock count (set exact stock)', qty: 'Counted stock on shelf' },
};

export default function StockDialog({ item, onSaved, onClose }) {
  const [form, setForm] = useState({ type: 'PURCHASE', quantity: '', unitCost: '', note: '', amountPaid: '', method: 'CASH' });
  const [paidTouched, setPaidTouched] = useState(false); // once the person types an amount, we stop suggesting one
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Quantity or cost changed: suggest quantity x cost as the amount paid (exact paisa arithmetic), unless the person set their own. */
  const setQtyCost = (k) => (e) => setForm((f) => {
    const next = { ...f, [k]: e.target.value };
    if (!paidTouched && Number(next.unitCost) > 0 && Number(next.quantity) > 0) {
      try { next.amountPaid = fromMinor(lineTotalMinor(next.quantity, next.unitCost)); } catch { next.amountPaid = ''; }
    }
    return next;
  });

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const body = form.type === 'PURCHASE' ? form : { type: form.type, quantity: form.quantity, note: form.note }; // money only applies to a purchase
      await api(`/api/ingredients/${item.id}/stock`, { method: 'POST', body });
      onSaved('Stock updated.');
    } catch (err) {
      setError(err.message); setBusy(false);
    }
  }

  return (
    <Modal title={`Update stock: ${item.name}`} onClose={onClose}>
      <Form onSubmit={submit}>
        <p className="text-graphite">Current stock: <b className="text-night">{item.stock} {item.unit}</b></p>
        <Field label="What happened?">
          <Select value={form.type} onChange={set('type')}>{Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}</Select>
        </Field>
        <Field label={`${TYPES[form.type].qty} (${item.unit})`}>
          <Input type="number" min="0" step="any" required value={form.quantity} onChange={setQtyCost('quantity')} />
        </Field>
        {form.type === 'PURCHASE' && (
          <>
            <Field label="Cost per unit (Rs, optional)"><Input type="number" min="0" step="any" value={form.unitCost} onChange={setQtyCost('unitCost')} placeholder={String(item.costPerUnit)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount paid (Rs)"><Input type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amountPaid} onChange={(e) => { setPaidTouched(true); set('amountPaid')(e); }} /></Field>
              <Field label="Paid by">
                <Select value={form.method} onChange={set('method')} disabled={!form.amountPaid}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</Select>
              </Field>
            </div>
            <p className="-mt-2 text-[13px] text-graphite">{form.amountPaid ? 'This money will appear in Expenses as a stock purchase.' : 'Leave the amount empty to add stock only, without recording any spending.'}</p>
          </>
        )}
        <Field label="Note (optional)"><Input maxLength={200} value={form.note} onChange={set('note')} placeholder="Invoice no., reason…" /></Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
