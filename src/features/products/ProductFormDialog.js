'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';

export default function ProductFormDialog({ product, categories, onSaved, onClose }) {
  const editing = !!product;
  const [form, setForm] = useState({ name: product?.name || '', categoryId: product?.categoryId || '', price: product?.price ?? '', description: product?.description || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(editing ? `/api/products/${product.id}` : '/api/products', { method: editing ? 'PATCH' : 'POST', body: form });
      onSaved(editing ? 'Menu item updated.' : 'Menu item added. You can now set its recipe.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title={editing ? `Edit ${product.name}` : 'Add menu item'} onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Name"><Input required value={form.name} onChange={set('name')} placeholder="e.g. Fresh Orange Juice" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Price (Rs)"><Input type="number" min="0" step="any" required value={form.price} onChange={set('price')} /></Field>
          <Field label="Category">
            <Select value={form.categoryId} onChange={set('categoryId')}>
              <option value="">Uncategorised</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description (optional)"><Input value={form.description} onChange={set('description')} /></Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
