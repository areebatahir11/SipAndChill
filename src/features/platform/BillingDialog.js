'use client';
import { useState } from 'react';
import { Alert, Field, Form, FormActions, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateInputValue } from '@/lib/format';
import { useSubmit } from '@/lib/use-submit';

export default function BillingDialog({ client, onSaved, onClose }) {
  const [form, setForm] = useState({
    billingStatus: client.billingStatus,
    monthlyFee: String(client.monthlyFee),
    dueDate: dateInputValue(client.dueDate),
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { busy, error, submit } = useSubmit(async () => {
    await api(`/api/platform/clients/${client.id}`, { method: 'PATCH', body: form });
    onSaved();
  });

  return (
    <Modal title={`Billing: ${client.name}`} onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Payment status">
          <Select value={form.billingStatus} onChange={set('billingStatus')}>
            <option value="PAID">Paid</option>
            <option value="UNPAID">Unpaid</option>
          </Select>
        </Field>
        <Field label="Monthly fee"><Input type="number" min="0" step="1" value={form.monthlyFee} onChange={set('monthlyFee')} /></Field>
        <Field label="Next due date"><Input type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
        <p className="text-[13px] text-graphite">When a client pays, set the status to Paid and move the due date to the next billing date. Unpaid clients past their due date show as Overdue.</p>
        {error && <Alert>{error}</Alert>}
        <FormActions onCancel={onClose} busy={busy} label={busy ? 'Saving…' : 'Save billing'} />
      </Form>
    </Modal>
  );
}
