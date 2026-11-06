'use client';
import { useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { api } from '@/lib/api-client';
import { TERMS_VERSION } from '@/lib/legal/terms.mjs';
import { signOut } from '@/components/layout/sign-out';
import TermsDocument from './TermsDocument';

/** Shown to a Business Owner instead of the app until they accept the current Terms & Conditions. */
export default function TermsGate() {
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function accept() {
    setError(''); setBusy(true);
    try {
      await api('/api/terms/accept', { method: 'POST', body: { version: TERMS_VERSION, agree: true } });
      location.href = '/'; // the server then sends the owner to their first page
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Card className="grid gap-4">
      <div>
        <h1 className="text-[26px] font-semibold tracking-tight">Before you start</h1>
        <p className="text-graphite">Please read and accept the Terms & Conditions to open your business account.</p>
      </div>
      <div className="max-h-[52vh] overflow-y-auto rounded-[10px] border border-peach bg-blush/40 p-4" tabIndex={0} aria-label="Terms and Conditions">
        <TermsDocument />
      </div>
      <label className="flex items-start gap-2.5 text-sm font-medium text-slate">
        <input type="checkbox" className="mt-0.5 size-4" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        I have read the Terms & Conditions and agree to them on behalf of my business.
      </label>
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="ghost" onClick={signOut}>Sign out</Button>
        <Button variant="primary" size="lg" disabled={!agree || busy} onClick={accept}>{busy ? 'Saving…' : 'Agree and continue'}</Button>
      </div>
    </Card>
  );
}
