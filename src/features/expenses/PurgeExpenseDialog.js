'use client';
import { useState } from 'react';
import { Alert, Field, Form, FormActions, Input, Modal } from '@/components/ui';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { PURGE_CONFIRM_PHRASE } from '@/lib/expenses.mjs';
import { useSubmit } from '@/lib/use-submit';

/** Permanent delete of a voided expense. Needs a written reason AND the typed word; the server checks both again. */
export default function PurgeExpenseDialog({ expense, onSaved, onClose }) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const ready = reason.trim().length >= 10 && confirm.trim() === PURGE_CONFIRM_PHRASE;

  const { busy, error, submit } = useSubmit(async () => {
    await api(`/api/expenses/${expense.id}/purge`, { method: 'POST', body: { reason, confirm } });
    onSaved('Expense permanently deleted.');
  });

  return (
    <Modal title="Permanently delete this expense?" onClose={onClose}>
      <Form onSubmit={submit}>
        <p>{expense.categoryName}: <b>{money(expense.amount)}</b>{expense.note ? ` (${expense.note})` : ''}</p>
        <p className="text-graphite">It was voided: “{expense.voidReason}”.</p>
        <Alert>This cannot be undone. The expense disappears from your history for good. A record of the deletion (who, when, why and what was deleted) is kept in the audit log.</Alert>
        <Field label="Why must it be deleted?">
          <Input required minLength={10} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Entered by mistake while testing…" />
        </Field>
        <Field label={`Type ${PURGE_CONFIRM_PHRASE} to confirm`}>
          <Input required autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        {error && <Alert>{error}</Alert>}
        <FormActions variant="dangerSolid" onCancel={onClose} busy={busy || !ready} label={busy ? 'Deleting…' : 'Delete permanently'} />
      </Form>
    </Modal>
  );
}
