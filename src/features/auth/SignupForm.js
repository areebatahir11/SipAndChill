'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Form, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { BUSINESS_TYPES, TRIAL_DAYS } from '@/lib/platform/constants.mjs';
import Turnstile, { TURNSTILE_SITE_KEY } from '@/components/security/Turnstile';
import AuthCard from './AuthCard';

/**
 * Public signup for a business owner, in up to three screens: the form, the emailed 6-digit code, and (when PearlSolutions
 * approves signups by hand) a "we'll email you" confirmation. The business is created only once the code is confirmed.
 */
export default function SignupForm() {
  const [form, setForm] = useState({ businessName: '', businessType: 'JUICE_COFFEE_SHOP', ownerName: '', email: '', password: '', confirm: '', website: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('form'); // 'form' | 'code' | 'pending'
  const [otp, setOtp] = useState('');
  const [info, setInfo] = useState('');
  const [token, setToken] = useState(null);   // Turnstile result; one-time use, so the widget is remounted (captchaKey) after each send
  const [captchaKey, setCaptchaKey] = useState(0);
  const needsCaptcha = Boolean(TURNSTILE_SITE_KEY);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Sends the code. Used by the form and by "Send a new code".
  async function sendCode(e) {
    e?.preventDefault(); setError(''); setInfo('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { confirm, ...body } = form;
      await api('/api/auth/signup', { method: 'POST', body: { ...body, turnstileToken: token } });
      setStage('code'); setOtp('');
      setInfo(`We sent a 6-digit code to ${form.email}.`);
    } catch (err) {
      setError(err.message === 'Request failed.' ? 'Unable to create your account.' : err.message);
    }
    setToken(null); setCaptchaKey((k) => k + 1); // get a fresh token for the next send
    setBusy(false);
  }

  async function verify(e) {
    e.preventDefault(); setError(''); setInfo(''); setBusy(true);
    try {
      const { status, redirectTo } = await api('/api/auth/signup/verify', { method: 'POST', body: { email: form.email, otp } });
      if (status === 'PENDING') { setStage('pending'); setBusy(false); return; }
      location.href = redirectTo || '/';
    } catch (err) {
      setError(err.message === 'Request failed.' ? 'Unable to verify the code.' : err.message);
      setBusy(false);
    }
  }

  if (stage === 'pending') {
    return (
      <AuthCard
        title="Request received"
        sub="Your email is verified."
        footer={<>Questions? Contact PearlSolutions. <Link href="/login" className="font-semibold underline">Back to sign in</Link></>}
      >
        <div className="mt-5 grid gap-4">
          <Alert tone="success">Thank you, {form.ownerName}. We will review <strong>{form.businessName}</strong> and email you at {form.email} as soon as it is approved. After that you can sign in.</Alert>
        </div>
      </AuthCard>
    );
  }

  if (stage === 'code') {
    return (
      <AuthCard
        title="Check your email"
        sub="Enter the 6-digit code to verify your email address."
        footer="The code expires in 10 minutes. Can't find it? Check your spam folder."
      >
        <Form className="mt-5" onSubmit={verify}>
          {info && <Alert tone="success">{info}</Alert>}
          <Field label="6-digit email code"><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" /></Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" variant="primary" size="lg" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</Button>
          <Turnstile key={captchaKey} onToken={setToken} />
          <Button type="button" variant="ghost" disabled={busy || (needsCaptcha && !token)} onClick={sendCode}>Send a new code</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setStage('form'); setError(''); setInfo(''); }}>Change my details</Button>
        </Form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your business account"
      sub={`Free for ${TRIAL_DAYS} days. Set up your menu, stock and team, then start taking orders.`}
      footer={<>You will be the owner of this business. You can add your managers and staff after signing in. By creating an account you agree to the <Link href="/terms" target="_blank" className="font-semibold underline">Terms &amp; Conditions</Link>.</>}
    >
      <Form className="mt-5" onSubmit={sendCode}>
        <Field label="Business name"><Input required value={form.businessName} onChange={set('businessName')} placeholder="e.g. Sip & Chill" /></Field>
        <Field label="Business type">
          <Select value={form.businessType} onChange={set('businessType')}>
            {Object.entries(BUSINESS_TYPES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Your name"><Input required autoComplete="name" value={form.ownerName} onChange={set('ownerName')} /></Field>
        <Field label="Email"><Input type="email" required autoComplete="username" value={form.email} onChange={set('email')} placeholder="you@example.com" /></Field>
        <Field label="Password"><Input type="password" required autoComplete="new-password" value={form.password} onChange={set('password')} placeholder="10+ characters, with a letter and a number" /></Field>
        <Field label="Confirm password"><Input type="password" required autoComplete="new-password" value={form.confirm} onChange={set('confirm')} /></Field>
        {/* Honeypot: hidden from people, bots fill it. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={set('website')} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        <Turnstile key={captchaKey} onToken={setToken} />
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={busy || (needsCaptcha && !token)}>{busy ? 'Sending code…' : 'Create account'}</Button>
      </Form>
      <p className="mt-4 text-center">Already have an account? <Link href="/login" className="font-semibold underline">Sign in</Link></p>
    </AuthCard>
  );
}
