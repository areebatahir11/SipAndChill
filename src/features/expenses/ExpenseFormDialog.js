'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { localDateString } from '@/lib/orders/dates.mjs';
import { METHOD_LABEL, PAYMENT_METHODS } from '@/lib/payments.mjs';

export default function ExpenseFormDialog({ categories, suppliers, onSaved, onClose }) {
  const today = localDateString(new Date());
  const choices = categories.filter((c) => c.isActive && !c.isSystem); // "Stock Purchase" is filled in by the Stock page
  const [form, setForm] = useState({ categoryId: '', amount: '', method: 'CASH', businessDate: today, supplierId: '', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api('/api/expenses', { method: 'POST', body: form });
      onSaved('Expense saved.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title="Add expense" onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Category">
          <Select required value={form.categoryId} onChange={set('categoryId')}>
            <option value="" disabled>Choose…</option>
            {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Amount (Rs)"><Input type="number" inputMode="decimal" min="0.01" step="0.01" required value={form.amount} onChange={set('amount')} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Paid by">
            <Select value={form.method} onChange={set('method')}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</Select>
          </Field>
          <Field label="Date"><Input type="date" max={today} required value={form.businessDate} onChange={set('businessDate')} /></Field>
        </div>
        {suppliers.length > 0 && (
          <Field label="Supplier (optional)">
            <Select value={form.supplierId} onChange={set('supplierId')}>
              <option value="">None</option>
              {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Note (optional)"><Input maxLength={200} value={form.note} onChange={set('note')} placeholder="Bill no., month, who was paid…" /></Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
