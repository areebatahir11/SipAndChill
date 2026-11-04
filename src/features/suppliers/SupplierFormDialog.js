'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal } from '@/components/ui';
import { api } from '@/lib/api-client';

const blank = { name: '', phone: '', email: '', address: '', notes: '' };

export default function SupplierFormDialog({ supplier, onSaved, onClose }) {
  const editing = !!supplier;
  const [form, setForm] = useState(editing ? { name: supplier.name, phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '', notes: supplier.notes || '' } : blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(editing ? `/api/suppliers/${supplier.id}` : '/api/suppliers', { method: editing ? 'PATCH' : 'POST', body: form });
      onSaved(editing ? 'Supplier updated.' : 'Supplier added.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title={editing ? `Edit ${supplier.name}` : 'Add supplier'} onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Supplier name"><Input required value={form.name} onChange={set('name')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone"><Input value={form.phone} onChange={set('phone')} placeholder="0300-0000000" /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={set('email')} /></Field>
        </div>
        <Field label="Address"><Input value={form.address} onChange={set('address')} /></Field>
        <Field label="Notes"><Input value={form.notes} onChange={set('notes')} placeholder="What they supply, delivery days…" /></Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
