'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Form, Input } from '@/components/ui';
import { api } from '@/lib/api-client';
import AuthCard from './AuthCard';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const { redirectTo } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      location.href = redirectTo || '/'; // platform admins go to /platform; business users to their first page
    } catch (err) {
      setError(err.message === 'Request failed.' ? 'Unable to sign in.' : err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      sub="Sign in to continue."
      footer={<>Staff: ask your owner or manager to reset your password. <Link href="/forgot-password" className="font-semibold underline">Forgot your password?</Link></>}
    >
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
      <p className="mt-4 text-center">New here? <Link href="/signup" className="font-semibold underline">Create your business account</Link></p>
    </AuthCard>
  );
}
