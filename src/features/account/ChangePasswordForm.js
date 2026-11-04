'use client';
import { useState } from 'react';
import { Alert, Button, Card, Field, Form, Input, PageHeader } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';

export default function ChangePasswordForm() {
  const { user, role } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setError(''); setOk('');
    if (form.newPassword !== form.confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setOk('Password updated. Other devices were signed out.');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="My account" sub={`Signed in as ${user.email} (${role.name})`} />
      <Card className="max-w-[460px]">
        <h3 className="mb-2.5 text-[17px] font-semibold">Change password</h3>
        <Form onSubmit={submit}>
          <Field label="Current password"><Input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" required value={form.newPassword} onChange={set('newPassword')} placeholder="10+ characters, with a letter and a number" /></Field>
          <Field label="Confirm new password"><Input type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} /></Field>
          {error && <Alert>{error}</Alert>}
          {ok && <Alert tone="success">{ok}</Alert>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</Button>
        </Form>
      </Card>
    </>
  );
}
