'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Field, Form, Input, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { BUSINESS_TYPES, TRIAL_DAYS } from '@/lib/platform/constants.mjs';
import AuthCard from './AuthCard';

/** Public signup for a business owner. Creates the business, signs the owner in and lands them on their dashboard. */
export default function SignupForm() {
  const [form, setForm] = useState({ businessName: '', businessType: 'JUICE_COFFEE_SHOP', ownerName: '', email: '', password: '', confirm: '', website: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      const { confirm, ...body } = form;
      const { redirectTo } = await api('/api/auth/signup', { method: 'POST', body });
      location.href = redirectTo || '/';
    } catch (err) {
      setError(err.message === 'Request failed.' ? 'Unable to create your account.' : err.message);
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Create your business account"
      sub={`Free for ${TRIAL_DAYS} days. Set up your menu, stock and team, then start taking orders.`}
      footer="You will be the owner of this business. You can add your managers and staff after signing in."
    >
      <Form className="mt-5" onSubmit={submit}>
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
        {error && <Alert>{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" disabled={busy}>{busy ? 'Creating your account…' : 'Create account'}</Button>
      </Form>
      <p className="mt-4 text-center">Already have an account? <Link href="/login" className="font-semibold underline">Sign in</Link></p>
    </AuthCard>
  );
}
