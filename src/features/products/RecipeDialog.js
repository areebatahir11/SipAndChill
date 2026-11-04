'use client';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Modal, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';

/** Recipe = stock used by ONE serving. Editable only with recipes.manage. */
export default function RecipeDialog({ product, canEdit, onSaved, onClose }) {
  const [lines, setLines] = useState(null);
  const [ingredients, setIngredients] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api(`/api/products/${product.id}/recipe`), api('/api/ingredients')])
      .then(([recipe, items]) => {
        setIngredients(items.filter((i) => i.isActive));
        setLines(recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })));
      })
      .catch((e) => setError(e.message));
  }, [product.id]);

  const byId = useMemo(() => Object.fromEntries(ingredients.map((i) => [i.id, i])), [ingredients]);
  const update = (idx, patch) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const cost = (lines || []).reduce((s, l) => s + (Number(l.quantity) || 0) * (byId[l.ingredientId]?.costPerUnit || 0), 0);
  const margin = product.price > 0 ? Math.round(((product.price - cost) / product.price) * 100) : 0;

  async function save() {
    setBusy(true); setError('');
    try {
      await api(`/api/products/${product.id}/recipe`, { method: 'PUT', body: { items: lines.filter((l) => l.ingredientId) } });
      onSaved('Recipe saved.');
    } catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <Modal title={`Recipe: ${product.name}`} onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-graphite">Stock used for one serving. It will be deducted automatically when the item is sold.</p>
        {!lines && !error && <p className="text-graphite">Loading…</p>}
        {lines?.length === 0 && <p className="text-graphite">No ingredients yet.</p>}
        {lines?.map((l, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_96px_auto] items-center gap-2">
            <Select disabled={!canEdit} value={l.ingredientId} onChange={(e) => update(idx, { ingredientId: e.target.value })}>
              <option value="">Select item…</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </Select>
            <Input type="number" min="0" step="any" disabled={!canEdit} value={l.quantity} onChange={(e) => update(idx, { quantity: e.target.value })} aria-label="Quantity" />
            {canEdit && <Button size="sm" variant="danger" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))}>Remove</Button>}
          </div>
        ))}
        {canEdit && lines && <Button variant="ghost" onClick={() => setLines((ls) => [...ls, { ingredientId: '', quantity: '' }])}>+ Add ingredient</Button>}
        {lines && (
          <p className="rounded-[10px] bg-blush px-3 py-2 text-sm">
            Cost per serving <b>{money(Math.round(cost * 100) / 100)}</b> · Price <b>{money(product.price)}</b> · Margin <b>{margin}%</b>
          </p>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>{canEdit ? 'Cancel' : 'Close'}</Button>
          {canEdit && lines && <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save recipe'}</Button>}
        </div>
      </div>
    </Modal>
  );
}
