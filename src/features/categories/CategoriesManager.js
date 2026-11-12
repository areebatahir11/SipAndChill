'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, ConfirmDialog, DataTable, Field, Form, Input, Modal, PageHeader, Pill, Td } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';

function CategoryDialog({ category, onSaved, onClose }) {
  const editing = !!category;
  const [form, setForm] = useState({ name: category?.name || '', description: category?.description || '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await api(editing ? `/api/categories/${category.id}` : '/api/categories', { method: editing ? 'PATCH' : 'POST', body: form });
      onSaved(editing ? 'Category updated.' : 'Category added.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title={editing ? `Edit ${category.name}` : 'Add category'} onClose={onClose}>
      <Form onSubmit={submit}>
        <Field label="Name"><Input required value={form.name} onChange={set('name')} placeholder="e.g. Fresh Juices, Hot Coffee" /></Field>
        <Field label="Description"><Input value={form.description} onChange={set('description')} /></Field>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        </div>
      </Form>
    </Modal>
  );
}

export default function CategoriesManager({ initialRows = null }) {
  const { can } = useAuth();
  const canManage = can(P.CATEGORIES_MANAGE);
  const [rows, setRows] = useState(initialRows);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'form' | 'delete', category? }
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setRows(await api('/api/categories')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => { if (!initialRows) load(); }, [load, initialRows]);

  const close = () => { setDialog(null); setError(''); };
  const saved = async (msg) => { close(); setNotice(msg); await load(); };

  async function toggle(c) { await api(`/api/categories/${c.id}`, { method: 'PATCH', body: { isActive: !c.isActive } }); load(); }
  async function remove() {
    setBusy(true); setError('');
    try { await api(`/api/categories/${dialog.category.id}`, { method: 'DELETE' }); await saved('Category deleted.'); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Menu Sections" sub="Group your menu: juices, shakes, coffee, snacks…">
        {canManage && <Button variant="primary" onClick={() => setDialog({ type: 'form' })}>Add category</Button>}
      </PageHeader>
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <DataTable head={['Category', 'Description', 'Items', 'Status', '']} emptyText={!rows ? (loadError ? '' : 'Loading…') : rows.length === 0 ? 'No categories yet.' : null}>
        {rows?.map((c) => (
          <tr key={c.id}>
            <Td className="whitespace-nowrap font-medium">{c.name}</Td>
            <Td>{c.description || '—'}</Td>
            <Td><Pill>{c.productCount} items</Pill></Td>
            <Td><Pill tone={c.isActive ? 'ok' : 'off'}>{c.isActive ? 'Active' : 'Hidden'}</Pill></Td>
            <Td>
              {canManage && (
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => toggle(c)}>{c.isActive ? 'Hide' : 'Show'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'form', category: c })}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDialog({ type: 'delete', category: c })}>Delete</Button>
                </div>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>

      {dialog?.type === 'form' && <CategoryDialog category={dialog.category} onSaved={saved} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Delete ${dialog.category.name}?`} confirmLabel="Delete" danger busy={busy} error={error} onConfirm={remove} onClose={close}>
          {dialog.category.productCount > 0 ? `${dialog.category.productCount} menu items will become uncategorised (they are not deleted).` : 'This category has no items.'}
        </ConfirmDialog>
      )}
    </>
  );
}
