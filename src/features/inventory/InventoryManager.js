'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, ConfirmDialog, DataTable, Input, PageHeader, Pill, Td } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import ItemFormDialog from './ItemFormDialog';
import StockDialog from './StockDialog';
import MovementsDialog from './MovementsDialog';

const TABS = [['ALL', 'All'], ['INGREDIENT', 'Ingredients'], ['MATERIAL', 'Materials'], ['LOW', 'Low stock']];
const daysLeft = (d) => (d ? Math.ceil((new Date(d) - new Date()) / 864e5) : null);

export default function InventoryManager() {
  const { can } = useAuth();
  const canManage = can(P.INGREDIENTS_MANAGE);
  const canAdjust = can(P.INVENTORY_ADJUST);
  const canHistory = can(P.INVENTORY_VIEW);

  const [items, setItems] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('ALL');
  const [q, setQ] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'form' | 'stock' | 'history' | 'delete', item? }
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await api('/api/ingredients')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => {
    load();
    if (can(P.SUPPLIERS_VIEW)) api('/api/suppliers').then(setSuppliers).catch(() => {}); // dropdown only
  }, [load, can]);

  const rows = useMemo(() => (items || []).filter((i) =>
    (tab === 'ALL' || (tab === 'LOW' ? i.lowStock && i.isActive : i.kind === tab)) &&
    i.name.toLowerCase().includes(q.toLowerCase())), [items, tab, q]);

  const active = (items || []).filter((i) => i.isActive);
  const lowCount = active.filter((i) => i.lowStock).length;
  const expiringCount = active.filter((i) => { const d = daysLeft(i.expiryDate); return d !== null && d <= 3; }).length;

  const close = () => { setDialog(null); setError(''); };
  const saved = async (msg) => { close(); setNotice(msg); await load(); };

  async function remove() {
    setBusy(true); setError('');
    try {
      const { archived } = await api(`/api/ingredients/${dialog.item.id}`, { method: 'DELETE' });
      await saved(archived ? 'Item has stock history, so it was archived instead of deleted.' : 'Item deleted.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <>
      <PageHeader title="Stock" sub="Ingredients and materials, stock levels and reorder alerts.">
        <Input className="w-56" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
        {canManage && <Button variant="primary" onClick={() => setDialog({ type: 'form' })}>Add item</Button>}
      </PageHeader>

      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <div className="mb-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        <Card><span className="text-sm text-graphite">Active items</span><b className="mt-1 block text-3xl">{active.length}</b></Card>
        <Card><span className="text-sm text-graphite">Need reordering</span><b className="mt-1 block text-3xl">{lowCount}</b></Card>
        <Card><span className="text-sm text-graphite">Expiring in 3 days</span><b className="mt-1 block text-3xl">{expiringCount}</b></Card>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map(([key, label]) => (
          <Button key={key} size="sm" variant={tab === key ? 'primary' : 'ghost'} onClick={() => setTab(key)}>{label}</Button>
        ))}
      </div>

      <DataTable
        head={['Item', 'Type', 'Stock', 'Reorder at', 'Cost', 'Expiry', 'Supplier', '']}
        emptyText={!items ? (loadError ? '' : 'Loading…') : rows.length === 0 ? 'No items found.' : null}
      >
        {rows.map((i) => {
          const d = daysLeft(i.expiryDate);
          return (
            <tr key={i.id} className={i.isActive ? '' : 'opacity-60'}>
              <Td className="whitespace-nowrap font-medium">{i.name}{!i.isActive && <span className="ml-2 text-xs text-graphite">(archived)</span>}</Td>
              <Td><Pill>{i.kind === 'MATERIAL' ? 'Material' : 'Ingredient'}</Pill></Td>
              <Td className="whitespace-nowrap">
                {i.stock} {i.unit} {i.isActive && i.lowStock && <Pill tone="off">Low</Pill>}
              </Td>
              <Td className="whitespace-nowrap">{i.minStock} {i.unit}</Td>
              <Td className="whitespace-nowrap">{money(i.costPerUnit)}</Td>
              <Td className="whitespace-nowrap">
                {i.expiryDate ? <>{i.expiryDate}{i.isActive && d !== null && d <= 3 && <> <Pill tone="off">{d < 0 ? 'Expired' : `${d}d`}</Pill></>}</> : '—'}
              </Td>
              <Td className="whitespace-nowrap">{i.supplierName || '—'}</Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {canAdjust && i.isActive && <Button size="sm" variant="accent" onClick={() => setDialog({ type: 'stock', item: i })}>Update stock</Button>}
                  {canHistory && <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'history', item: i })}>History</Button>}
                  {canManage && <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'form', item: i })}>Edit</Button>}
                  {canManage && i.isActive && <Button size="sm" variant="danger" onClick={() => setDialog({ type: 'delete', item: i })}>Delete</Button>}
                  {canManage && !i.isActive && <Button size="sm" variant="ghost" onClick={async () => { await api(`/api/ingredients/${i.id}`, { method: 'PATCH', body: { isActive: true } }); saved('Item restored.'); }}>Restore</Button>}
                </div>
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {dialog?.type === 'form' && <ItemFormDialog item={dialog.item} suppliers={suppliers} onSaved={saved} onClose={close} />}
      {dialog?.type === 'stock' && <StockDialog item={dialog.item} onSaved={saved} onClose={close} />}
      {dialog?.type === 'history' && <MovementsDialog item={dialog.item} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Delete ${dialog.item.name}?`} confirmLabel="Delete" danger busy={busy} error={error} onConfirm={remove} onClose={close}>
          Items that already have purchases, wastage or sales history are archived instead of deleted, so reports stay correct.
        </ConfirmDialog>
      )}
    </>
  );
}
