'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Form, Input } from '@/components/ui';
import { api } from '@/lib/api-client';
import AuthCard from './AuthCard';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [stage, setStage] = useState('email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function requestCode(e) {
    e.preventDefault(); setError(''); setMessage(''); setBusy(true);
    try {
      const result = await api('/api/auth/password/forgot', { method: 'POST', body: { email } });
      setMessage(result.message);
      setStage('reset');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  async function resetPassword(e) {
    e.preventDefault(); setError(''); setMessage('');
    if (newPassword !== confirm) return setError('New passwords do not match.');
    setBusy(true);
    try {
      await api('/api/auth/password/reset', { method: 'POST', body: { email, otp, newPassword } });
      setStage('done');
      setMessage('Your password has been reset successfully. All previous sessions have been signed out. You can now sign in with your new password.');
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  return (
    <AuthCard title={stage === 'done' ? 'Password updated' : 'Reset your password'} sub={stage === 'email' ? 'Enter the email address linked to your account.' : stage === 'reset' ? 'Enter the 6-digit code from your email and choose a new password.' : 'Your account is secure with its new password.'} footer={<>Remembered your password? <Link href="/login" className="font-semibold underline">Back to sign in</Link></>}>
      {stage === 'email' && <Form className="mt-5" onSubmit={requestCode}>
        <Field label="Account email"><Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></Field>
        {error && <Alert>{error}</Alert>}
        {message && <Alert tone="success">{message}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={busy}>{busy ? 'Sending code…' : 'Send recovery code'}</Button>
      </Form>}
      {stage === 'reset' && <Form className="mt-5" onSubmit={resetPassword}>
        {message && <Alert tone="success">{message}</Alert>}
        <p className="text-sm text-graphite">Recovery code sent to <strong>{email}</strong>. It expires in 10 minutes.</p>
        <Field label="6-digit email code"><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></Field>
        <Field label="New password"><Input type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="10+ characters, with a letter and a number" /></Field>
        <Field label="Confirm new password"><Input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></Field>
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={busy}>{busy ? 'Updating password…' : 'Verify code and reset password'}</Button>
        <Button type="button" variant="ghost" onClick={() => { setStage('email'); setOtp(''); setNewPassword(''); setConfirm(''); setError(''); setMessage(''); }}>Use a different email / request another code</Button>
      </Form>}
      {stage === 'done' && <div className="mt-5 grid gap-4"><Alert tone="success">{message}</Alert><Link href="/login" className="inline-flex justify-center rounded-[10px] border border-slate bg-slate px-4 py-3 font-medium text-blush">Go to sign in</Link></div>}
    </AuthCard>
  );
}
