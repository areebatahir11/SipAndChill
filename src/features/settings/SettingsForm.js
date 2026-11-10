'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, Field, Form, Input, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api-client';

export default function SettingsForm() {
  const router = useRouter();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/settings')
      .then((d) => setForm({ ...d, phone: d.phone || '', address: d.address || '' }))
      .catch((e) => setError(e.message));
  }, []);

  const set = (k) => (e) => { setSaved(false); setForm((f) => ({ ...f, [k]: e.target.value })); };

  async function submit(e) {
    e.preventDefault(); setError(''); setSaved(false); setBusy(true);
    const { businessName, phone, address, receiptWidthMm, receiptFooter } = form;
    try {
      await api('/api/settings', { method: 'PATCH', body: { businessName, phone, address, receiptFooter, receiptWidthMm: Number(receiptWidthMm) } });
      setSaved(true);
      router.refresh(); // sidebar shows the new business name
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Shop Settings" sub="Shown on receipts and across the app." />
      {!form && !error && <p className="text-graphite">Loading…</p>}
      {error && <Alert className="mb-4">{error}</Alert>}
      {form && (
        <Card className="max-w-[520px]">
          <Form onSubmit={submit}>
            <Field label="Business name">
              <Input required minLength={2} maxLength={80} value={form.businessName} onChange={set('businessName')} />
              <small className="font-normal text-graphite">Your real shop name. It shows on every receipt and at the top of the menu. Only the Business Owner can change it.</small>
            </Field>
            <Field label="Phone (on receipt)"><Input value={form.phone} onChange={set('phone')} placeholder="0300-0000000" /></Field>
            <Field label="Address (on receipt)"><Input value={form.address} onChange={set('address')} /></Field>
            <Field label="Receipt paper width">
              <Select value={form.receiptWidthMm} onChange={set('receiptWidthMm')}>
                <option value={58}>58 mm</option>
                <option value={80}>80 mm</option>
              </Select>
            </Field>
            <Field label="Receipt footer message"><Input required value={form.receiptFooter} onChange={set('receiptFooter')} /></Field>
            <p className="text-graphite">Currency: {form.currency}</p>
            {saved && <Alert tone="success">Settings saved.</Alert>}
            <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
          </Form>
        </Card>
      )}
    </>
  );
}
