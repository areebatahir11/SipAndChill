'use client';
import { useState } from 'react';

/**
 * Busy + error state for a dialog form.
 *   const { busy, error, submit } = useSubmit(async () => { await api(...); onSaved(); });
 *   <Form onSubmit={submit}>
 * A thrown Error shows its message in `error`; success is whatever `action` does next.
 */
export function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e?.preventDefault();
    setBusy(true); setError('');
    try { await action(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return { busy, error, submit };
}
