'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Field, Form, Input, PageHeader } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { signOut } from '@/components/layout/sign-out';

/**
 * Business users use the defaults. The platform area passes its own endpoint and identity line,
 * because it has no business session context. `forced` is the first-login screen: a temporary
 * password must be replaced before anything else can be used.
 */
export default function ChangePasswordForm({ endpoint = '/api/auth/password', identity, forced = false }) {
  const auth = useAuth();
  const signedInAs = identity ?? `${auth.user.email} (${auth.role.name})`;
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
      await api(endpoint, { method: 'POST', body: { currentPassword: form.currentPassword, newPassword: form.newPassword } });
      if (forced) { location.href = '/'; return; } // reload: the server now lets this user in
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
      setOk('Password updated. Other devices were signed out.');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader
        title={forced ? 'Choose your own password' : 'My Account'}
        sub={forced ? 'You are using a temporary password. Set your own to continue.' : `Signed in as ${signedInAs}`}
      />
      <Card className="max-w-[460px]">
        <h3 className="mb-2.5 text-[17px] font-semibold">{forced ? 'Current (temporary) password' : 'Change password'}</h3>
        <Form onSubmit={submit}>
          <Field label={forced ? 'Temporary password you were given' : 'Current password'}><Input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} /></Field>
          <Field label="New password"><Input type="password" autoComplete="new-password" required value={form.newPassword} onChange={set('newPassword')} placeholder="10+ characters, with a letter and a number" /></Field>
          <Field label="Confirm new password"><Input type="password" autoComplete="new-password" required value={form.confirm} onChange={set('confirm')} /></Field>
          {error && <Alert>{error}</Alert>}
          {ok && <Alert tone="success">{ok}</Alert>}
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : forced ? 'Save and continue' : 'Update password'}</Button>
          {!forced && (identity || auth?.role?.code === 'OWNER') && <p className="text-sm text-graphite">Forgot your current password? <Link href="/forgot-password" className="font-semibold underline">Reset it using your email</Link>.</p>}
          {forced && <Button type="button" variant="ghost" onClick={signOut}>Log out</Button>}
        </Form>
      </Card>
    </>
  );
}
