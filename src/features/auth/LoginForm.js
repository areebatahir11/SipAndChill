'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input } from '@/components/ui';
import { api } from '@/lib/api-client';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      await api('/api/auth/login', { method: 'POST', body: { email, password } });
      location.href = '/'; // server sends each role to its own first page
    } catch (err) {
      setError(err.message === 'Request failed.' ? 'Unable to sign in.' : err.message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-[linear-gradient(135deg,var(--color-night)_0%,var(--color-slate)_45%,var(--color-blush)_45%,var(--color-peach)_100%)] p-6">
      <div className="w-full max-w-[440px] rounded-[20px] bg-white p-8 shadow-2xl">
        <div className="mb-4 flex items-center gap-2.5 text-[22px] font-bold">
          <span className="size-[18px] -rotate-45 rounded-[50%_50%_50%_0] bg-rose" />
          Sip&amp;Chill
        </div>
        <h1 className="text-[28px] font-semibold tracking-tight">Welcome back</h1>
        <p className="text-graphite">Sign in to continue.</p>
        <Form className="mt-5" onSubmit={submit}>
          <Field label="Email">
            <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </Form>
        <p className="mt-5 text-[13px] text-graphite">Forgot your password? Ask your manager or owner to reset it.</p>
      </div>
    </div>
  );
}
