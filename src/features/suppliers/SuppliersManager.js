'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ConfirmDialog, DataTable, Input, PageHeader, Pill, Td } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import SupplierFormDialog from './SupplierFormDialog';

export default function SuppliersManager() {
  const { can } = useAuth();
  const canManage = can(P.SUPPLIERS_MANAGE);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'form' | 'delete', supplier? }
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setRows(await api('/api/suppliers')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => (rows || []).filter((s) => `${s.name} ${s.phone || ''}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const close = () => { setDialog(null); setError(''); };
  const saved = async (msg) => { close(); setNotice(msg); await load(); };

  async function remove() {
    setBusy(true); setError('');
    try { await api(`/api/suppliers/${dialog.supplier.id}`, { method: 'DELETE' }); await saved('Supplier deleted.'); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Suppliers" sub="Who you buy ingredients and materials from.">
        <Input className="w-56" placeholder="Search suppliers" value={q} onChange={(e) => setQ(e.target.value)} />
        {canManage && <Button variant="primary" onClick={() => setDialog({ type: 'form' })}>Add supplier</Button>}
      </PageHeader>
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <DataTable head={['Supplier', 'Phone', 'Email', 'Items', 'Notes', '']} emptyText={!rows ? (loadError ? '' : 'Loading…') : shown.length === 0 ? 'No suppliers found.' : null}>
        {shown.map((s) => (
          <tr key={s.id}>
            <Td className="whitespace-nowrap font-medium">{s.name}</Td>
            <Td className="whitespace-nowrap">{s.phone || '—'}</Td>
            <Td className="whitespace-nowrap">{s.email || '—'}</Td>
            <Td><Pill>{s.itemCount} items</Pill></Td>
            <Td className="max-w-[260px] truncate">{s.notes || '—'}</Td>
            <Td>
              {canManage && (
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'form', supplier: s })}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => setDialog({ type: 'delete', supplier: s })}>Delete</Button>
                </div>
              )}
            </Td>
          </tr>
        ))}
      </DataTable>

      {dialog?.type === 'form' && <SupplierFormDialog supplier={dialog.supplier} onSaved={saved} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Delete ${dialog.supplier.name}?`} confirmLabel="Delete" danger busy={busy} error={error} onConfirm={remove} onClose={close}>
          {dialog.supplier.itemCount > 0 ? `${dialog.supplier.itemCount} inventory items use this supplier; they will simply show no supplier.` : 'This supplier has no linked items.'}
        </ConfirmDialog>
      )}
    </>
  );
}
