'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Field, Form, Input } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';

/**
 * "My name" on My Account. Owners and managers (people who can manage the team) can correct their own name, for example "M. Usman".
 * Everyone else sees their name and asks their manager: a cashier's name is stamped on receipts, so it stays under the manager's control.
 */
export default function ProfileNameCard() {
  const router = useRouter();
  const { user, can } = useAuth();
  const [name, setName] = useState(user.name);
  const [state, setState] = useState({ busy: false, error: '', ok: false });

  if (!can(P.USERS_MANAGE)) {
    return (
      <Card className="mb-4 max-w-[460px]">
        <h3 className="mb-1 text-[17px] font-semibold">My name</h3>
        <p className="m-0">{user.name}</p>
        <p className="mt-1 text-sm text-graphite">To change how your name is written, ask your manager (My Team → Rename).</p>
      </Card>
    );
  }

  async function save(e) {
    e.preventDefault();
    setState({ busy: true, error: '', ok: false });
    try {
      await api(`/api/staff/${user.id}`, { method: 'PATCH', body: { name } });
      setState({ busy: false, error: '', ok: true });
      router.refresh(); // the sidebar shows the new name
    } catch (err) { setState({ busy: false, error: err.message, ok: false }); }
  }

  return (
    <Card className="mb-4 max-w-[460px]">
      <h3 className="mb-2.5 text-[17px] font-semibold">My name</h3>
      <Form onSubmit={save}>
        <Field label="Full name">
          <Input required minLength={2} maxLength={80} value={name} onChange={(e) => { setName(e.target.value); setState((s) => ({ ...s, ok: false })); }} placeholder="For example: M. Usman" />
          <small className="font-normal text-graphite">Shown in the sidebar and as Cashier on new receipts. Receipts already printed keep the name they had.</small>
        </Field>
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert tone="success">Name updated.</Alert>}
        <Button type="submit" variant="primary" disabled={state.busy || name.trim() === user.name}>{state.busy ? 'Saving…' : 'Save name'}</Button>
      </Form>
    </Card>
  );
}
