'use client';
import { useState } from 'react';
import { Alert, Field, Form, FormActions, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useSubmit } from '@/lib/use-submit';
import { BUSINESS_TYPES } from '@/lib/platform/constants.mjs';

export default function EditClientDialog({ client, onSaved, onClose }) {
  const [form, setForm] = useState({ businessName: client.name, businessType: client.businessType, internalNote: client.internalNote || '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { busy, error, submit } = useSubmit(async () => {
    await api(`/api/platform/clients/${client.id}`, { method: 'PATCH', body: form });
    onSaved();
  });

  return (
    <Modal title="Edit client details" onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Business name"><Input required value={form.businessName} onChange={set('businessName')} /></Field>
        <Field label="Business type">
          <Select value={form.businessType} onChange={set('businessType')}>
            {Object.entries(BUSINESS_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Internal note (only PearlSolutions sees this)">
          <Input value={form.internalNote} onChange={set('internalNote')} maxLength={500} placeholder="e.g. pays by bank transfer on the 5th" />
        </Field>
        {error && <Alert>{error}</Alert>}
        <FormActions onCancel={onClose} busy={busy} label={busy ? 'Saving…' : 'Save'} />
      </Form>
    </Modal>
  );
}
