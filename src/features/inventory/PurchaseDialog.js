'use client';
import { useMemo, useState } from 'react';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { fromMinor } from '@/lib/money.mjs';
import { lineTotalMinor, purchaseTotals } from '@/lib/expenses.mjs';
import { localDateString } from '@/lib/orders/dates.mjs';
import { METHOD_LABEL, PAYMENT_METHODS } from '@/lib/payments.mjs';

const blank = () => ({ ingredientId: '', quantity: '', unitCost: '' });

/**
 * One shopping trip: several items bought together (milk, chocolate, sugar...) and paid in one go.
 * Stock goes up for every line and ONE expense is recorded for what was paid. The server re-checks everything.
 */
export default function PurchaseDialog({ items, suppliers, onSaved, onClose }) {
  const today = localDateString(new Date());
  const [lines, setLines] = useState([blank()]);
  const [meta, setMeta] = useState({ supplierId: '', invoiceNo: '', businessDate: today, method: 'CASH' });
  const [paid, setPaid] = useState(null); // null = "exactly the total"; a string once the person types their own amount
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const setLine = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const pick = (idx, id) => setLine(idx, { ingredientId: id, unitCost: byId[id] && byId[id].costPerUnit > 0 ? String(byId[id].costPerUnit) : '' }); // last known cost, editable

  const filled = lines.filter((l) => l.ingredientId && Number(l.quantity) > 0);
  const lineMinor = (l) => { try { return Number(l.quantity) > 0 ? lineTotalMinor(l.quantity, l.unitCost || 0) : 0; } catch { return 0; } };
  let totalMinor = 0;
  try { totalMinor = purchaseTotals(filled.map((l) => ({ quantity: l.quantity, unitCost: l.unitCost || 0 }))).totalMinor; } catch { /* the server reports it */ }
  const total = fromMinor(totalMinor);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const { amountPaid } = await api('/api/purchases', {
        method: 'POST',
        body: { ...meta, ...(paid !== null && paid !== '' ? { amountPaid: paid } : {}), items: filled.map((l) => ({ ingredientId: l.ingredientId, quantity: l.quantity, unitCost: l.unitCost })) },
      });
      onSaved(`Purchase recorded: stock added and ${money(amountPaid)} saved in Expenses.`);
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title="Record purchase" onClose={onClose} wide>
      <Form onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          {suppliers.length > 0 && (
            <Field label="Supplier (optional)">
              <Select value={meta.supplierId} onChange={(e) => setMeta((m) => ({ ...m, supplierId: e.target.value }))}>
                <option value="">None</option>
                {suppliers.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Invoice no. (optional)"><Input maxLength={60} value={meta.invoiceNo} onChange={(e) => setMeta((m) => ({ ...m, invoiceNo: e.target.value }))} /></Field>
          <Field label="Date"><Input type="date" max={today} required value={meta.businessDate} onChange={(e) => setMeta((m) => ({ ...m, businessDate: e.target.value }))} /></Field>
        </div>

        <div className="grid gap-2">
          {lines.map((l, idx) => {
            const item = byId[l.ingredientId];
            const taken = new Set(lines.filter((_, i) => i !== idx).map((x) => x.ingredientId));
            return (
              <div key={idx} className="grid items-end gap-2 sm:grid-cols-[2fr_1fr_1fr_auto_auto]">
                <Field label={idx === 0 ? 'Item' : ''}>
                  <Select value={l.ingredientId} onChange={(e) => pick(idx, e.target.value)} aria-label="Item">
                    <option value="">Choose item…</option>
                    {items.filter((i) => !taken.has(i.id)).map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </Select>
                </Field>
                <Field label={idx === 0 ? `Quantity${item ? ` (${item.unit})` : ''}` : ''}><Input type="number" min="0" step="any" value={l.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} aria-label="Quantity" /></Field>
                <Field label={idx === 0 ? 'Cost per unit (Rs)' : ''}><Input type="number" min="0" step="any" value={l.unitCost} onChange={(e) => setLine(idx, { unitCost: e.target.value })} aria-label="Cost per unit" /></Field>
                <span className="pb-2.5 text-right text-sm text-graphite sm:min-w-24">{lineMinor(l) ? money(fromMinor(lineMinor(l))) : ''}</span>
                <Button variant="ghost" size="sm" className="mb-1" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} aria-label="Remove line">✕</Button>
              </div>
            );
          })}
          <div><Button size="sm" variant="ghost" disabled={lines.length >= 40 || lines.length >= items.length} onClick={() => setLines((ls) => [...ls, blank()])}>+ Add another item</Button></div>
        </div>

        <div className="grid items-end gap-4 border-t border-blush pt-4 sm:grid-cols-3">
          <div><p className="text-[13px] text-graphite">Total of the items</p><b className="text-2xl">{money(total)}</b></div>
          <Field label="Amount paid (Rs)">
            <Input type="number" inputMode="decimal" min="0.01" step="0.01" value={paid ?? total} onChange={(e) => setPaid(e.target.value)} />
          </Field>
          <Field label="Paid by">
            <Select value={meta.method} onChange={(e) => setMeta((m) => ({ ...m, method: e.target.value }))}>{PAYMENT_METHODS.map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}</Select>
          </Field>
        </div>
        <p className="-mt-2 text-[13px] text-graphite">Change the amount if the supplier gave a discount or you paid delivery. It is saved once in Expenses; stock goes up for every item above.</p>

        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={busy || filled.length === 0}>{busy ? 'Saving…' : 'Save purchase'}</Button>
        </div>
      </Form>
    </Modal>
  );
}
