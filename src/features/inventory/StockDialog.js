'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';

const TYPES = {
  PURCHASE: { label: 'Stock in (purchase)', qty: 'Quantity received' },
  WASTAGE: { label: 'Wastage / spoiled', qty: 'Quantity wasted' },
  ADJUSTMENT: { label: 'Stock count (set exact stock)', qty: 'Counted stock on shelf' },
};

export default function StockDialog({ item, onSaved, onClose }) {
  const [form, setForm] = useState({ type: 'PURCHASE', quantity: '', unitCost: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(`/api/ingredients/${item.id}/stock`, { method: 'POST', body: form });
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
          <Input type="number" min="0" step="any" required value={form.quantity} onChange={set('quantity')} />
        </Field>
        {form.type === 'PURCHASE' && (
          <Field label="Cost per unit (Rs, optional)"><Input type="number" min="0" step="any" value={form.unitCost} onChange={set('unitCost')} placeholder={String(item.costPerUnit)} /></Field>
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
