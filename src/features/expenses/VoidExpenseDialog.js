'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal } from '@/components/ui';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';

/** A mistake is voided, not deleted: the entry stays in the history, greyed out and excluded from totals. */
export default function VoidExpenseDialog({ expense, onSaved, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(`/api/expenses/${expense.id}/void`, { method: 'POST', body: { reason } });
      onSaved('Expense voided.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title="Void this expense?" onClose={onClose}>
      <Form onSubmit={submit}>
        <p>{expense.categoryName}: <b>{money(expense.amount)}</b>{expense.note ? ` (${expense.note})` : ''}</p>
        <p className="text-graphite">It will stay in the list as voided and will not be counted in any total. If the amount was wrong, void it and add it again.</p>
        <Field label="Why are you voiding it?"><Input required minLength={3} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Entered twice, wrong amount…" /></Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="dangerSolid" disabled={busy}>{busy ? 'Please wait…' : 'Void expense'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
