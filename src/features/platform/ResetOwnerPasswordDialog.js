'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, FormActions, Input, Modal } from '@/components/ui';
import { api } from '@/lib/api-client';
import { useSubmit } from '@/lib/use-submit';
import { generatePassword } from '@/lib/platform/password-generator.mjs';

export default function ResetOwnerPasswordDialog({ clientId, owner, onSaved, onClose }) {
  const [password, setPassword] = useState(() => generatePassword());

  const { busy, error, submit } = useSubmit(async () => {
    await api(`/api/platform/clients/${clientId}/owner-password`, { method: 'POST', body: { userId: owner.userId, newPassword: password } });
    onSaved();
  });

  return (
    <Modal title={`Reset password: ${owner.name}`} onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="New password">
          <div className="flex gap-2">
            <Input required minLength={10} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="ghost" onClick={() => setPassword(generatePassword())}>Generate</Button>
          </div>
        </Field>
        <p className="text-[13px] text-graphite">Copy this password before saving and send it to {owner.email}. They will be signed out on every device.</p>
        {error && <Alert>{error}</Alert>}
        <FormActions onCancel={onClose} busy={busy} label={busy ? 'Saving…' : 'Set password'} />
      </Form>
    </Modal>
  );
}
