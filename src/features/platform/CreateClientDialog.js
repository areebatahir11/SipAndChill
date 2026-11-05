'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, FormActions, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useSubmit } from '@/lib/use-submit';
import { BUSINESS_TYPES } from '@/lib/platform/constants.mjs';
import { generatePassword } from '@/lib/platform/password-generator.mjs';

const EMPTY = {
  businessName: '', businessType: 'JUICE_COFFEE_SHOP', monthlyFee: '', dueDate: '',
  ownerName: '', ownerEmail: '', ownerPassword: '',
};

/** Creates a business plus its first owner login. After saving, shows the credentials to hand over. */
export default function CreateClientDialog({ onCreated, onClose }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ownerPassword: generatePassword() }));
  const [created, setCreated] = useState(null); // { name, email, password } once saved
  const [copied, setCopied] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const { busy, error, submit } = useSubmit(async () => {
    const client = await api('/api/platform/clients', {
      method: 'POST',
      body: {
        businessName: form.businessName,
        businessType: form.businessType,
        monthlyFee: form.monthlyFee,
        dueDate: form.dueDate,
        owner: { name: form.ownerName, email: form.ownerEmail, password: form.ownerPassword },
      },
    });
    setCreated({ name: client.name, email: form.ownerEmail, password: form.ownerPassword });
  });

  if (created) {
    const loginUrl = `${location.origin}/login`;
    const details = `${created.name}\nLogin: ${loginUrl}\nEmail: ${created.email}\nPassword: ${created.password}`;
    const copy = async () => {
      try { await navigator.clipboard.writeText(details); setCopied(true); } catch { setCopied(false); }
    };
    return (
      <Modal title="Client created" onClose={onCreated}>
        <div className="grid gap-4">
          <Alert tone="success">{created.name} is ready. Share these login details with the owner.</Alert>
          <pre className="whitespace-pre-wrap break-all rounded-[10px] bg-blush p-3.5 text-sm">{details}</pre>
          <p className="text-[13px] text-graphite">The password is not shown again after you close this window. You can set a new one later from the client page.</p>
          <div className="flex justify-end gap-2.5">
            <Button variant="ghost" onClick={copy}>{copied ? 'Copied' : 'Copy details'}</Button>
            <Button variant="primary" onClick={onCreated}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add client" onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Business name"><Input required value={form.businessName} onChange={set('businessName')} placeholder="e.g. Sip & Chill" /></Field>
        <Field label="Business type">
          <Select value={form.businessType} onChange={set('businessType')}>
            {Object.entries(BUSINESS_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly fee"><Input type="number" min="0" step="1" value={form.monthlyFee} onChange={set('monthlyFee')} placeholder="0" /></Field>
          <Field label="First due date"><Input type="date" value={form.dueDate} onChange={set('dueDate')} /></Field>
        </div>

        <h4 className="mt-1 text-[15px] font-semibold">Owner login</h4>
        <Field label="Owner name"><Input required value={form.ownerName} onChange={set('ownerName')} /></Field>
        <Field label="Owner email"><Input type="email" required value={form.ownerEmail} onChange={set('ownerEmail')} /></Field>
        <Field label="Temporary password">
          <div className="flex gap-2">
            <Input required minLength={10} autoComplete="off" value={form.ownerPassword} onChange={set('ownerPassword')} />
            <Button variant="ghost" onClick={() => setForm((f) => ({ ...f, ownerPassword: generatePassword() }))}>Generate</Button>
          </div>
        </Field>

        {error && <Alert>{error}</Alert>}
        <FormActions onCancel={onClose} busy={busy} label={busy ? 'Creating…' : 'Create client'} />
      </Form>
    </Modal>
  );
}
