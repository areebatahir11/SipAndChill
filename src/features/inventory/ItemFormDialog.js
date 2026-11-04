'use client';
import { useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { UNITS } from '@/lib/validation/inventory';

const blank = { name: '', kind: 'INGREDIENT', unit: 'kg', openingStock: '', minStock: '', costPerUnit: '', expiryDate: '', supplierId: '' };

/** Create (item = null) or edit an ingredient / material. Stock itself is changed through StockDialog. */
export default function ItemFormDialog({ item, suppliers, onSaved, onClose }) {
  const editing = !!item;
  const [form, setForm] = useState(editing ? { ...blank, ...item, supplierId: item.supplierId || '', expiryDate: item.expiryDate || '' } : blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const { name, kind, unit, minStock, costPerUnit, expiryDate, supplierId, openingStock } = form;
    const body = { name, kind, unit, minStock, costPerUnit, expiryDate, supplierId };
    try {
      if (editing) await api(`/api/ingredients/${item.id}`, { method: 'PATCH', body });
      else await api('/api/ingredients', { method: 'POST', body: { ...body, openingStock } });
      onSaved(editing ? 'Item updated.' : 'Item added.');
    } catch (err) {
      setError(err.message); setBusy(false);
    }
  }

  return (
    <Modal title={editing ? `Edit ${item.name}` : 'Add inventory item'} onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Name"><Input required value={form.name} onChange={set('name')} placeholder="e.g. Oranges, Paper cups 16oz" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={form.kind} onChange={set('kind')}>
              <option value="INGREDIENT">Ingredient</option>
              <option value="MATERIAL">Material (cups, straws…)</option>
            </Select>
          </Field>
          <Field label="Unit"><Select value={form.unit} onChange={set('unit')}>{UNITS.map((u) => <option key={u}>{u}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {!editing && <Field label="Opening stock"><Input type="number" min="0" step="any" value={form.openingStock} onChange={set('openingStock')} placeholder="0" /></Field>}
          <Field label="Reorder level"><Input type="number" min="0" step="any" value={form.minStock} onChange={set('minStock')} placeholder="0" /></Field>
          <Field label="Cost per unit (Rs)"><Input type="number" min="0" step="any" value={form.costPerUnit} onChange={set('costPerUnit')} placeholder="0" /></Field>
          <Field label="Expiry date"><Input type="date" value={form.expiryDate} onChange={set('expiryDate')} /></Field>
        </div>
        <Field label="Supplier">
          <Select value={form.supplierId} onChange={set('supplierId')}>
            <option value="">None</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
