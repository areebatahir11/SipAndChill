'use client';
import { useState } from 'react';
import { Alert, Button, Input, Modal, Pill } from '@/components/ui';
import { api } from '@/lib/api-client';

/** Add your own categories (e.g. "Gas cylinder") or hide ones you never use. Hidden ones keep their old entries. */
export default function CategoriesDialog({ categories, onChanged, onClose }) {
  const [list, setList] = useState(categories);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn) {
    setBusy(true); setError('');
    try { await fn(); onChanged(); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  const add = (e) => { e.preventDefault(); run(async () => { const c = await api('/api/expense-categories', { method: 'POST', body: { name } }); setList((l) => [...l, c]); setName(''); }); };
  const toggle = (c) => run(async () => { const u = await api(`/api/expense-categories/${c.id}`, { method: 'PATCH', body: { isActive: !c.isActive } }); setList((l) => l.map((x) => (x.id === u.id ? u : x))); });

  return (
    <Modal title="Expense categories" onClose={onClose}>
      <div className="grid gap-4">
        <form onSubmit={add} className="flex gap-2">
          <Input required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Gas cylinder" />
          <Button type="submit" variant="primary" disabled={busy}>Add</Button>
        </form>
        {error && <Alert>{error}</Alert>}
        <ul className="grid gap-1.5">
          {list.map((c) => (
            <li key={c.id} className={`flex items-center justify-between gap-3 border-b border-blush pb-1.5 last:border-0 ${c.isActive ? '' : 'opacity-60'}`}>
              <span>{c.name} {c.isSystem && <Pill>Used by Stock</Pill>}</span>
              {!c.isSystem && <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(c)}>{c.isActive ? 'Hide' : 'Show'}</Button>}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
