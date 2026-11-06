'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, ConfirmDialog, DataTable, Input, PageHeader, Pill, Select, Td } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import { PERMISSIONS as P } from '@/lib/permissions/codes.mjs';
import ProductFormDialog from './ProductFormDialog';
import RecipeDialog from './RecipeDialog';
import PromoBanner from '@/features/promotions/PromoBanner';
import usePromotion from '@/features/promotions/usePromotion';
import { toMinor, fromMinor } from '@/lib/money.mjs';

export default function ProductsManager({ promotion = null }) {
  const { can } = useAuth();
  const promo = usePromotion(promotion);
  const canManage = can(P.PRODUCTS_MANAGE);
  const canSeeRecipe = can(P.RECIPES_VIEW);
  const canEditRecipe = can(P.RECIPES_MANAGE);

  const [items, setItems] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'form' | 'recipe' | 'delete', product? }
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setItems(await api('/api/products')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => {
    load();
    if (can(P.CATEGORIES_VIEW)) api('/api/categories').then(setCategories).catch(() => {});
  }, [load, can]);

  const rows = useMemo(() => (items || []).filter((p) =>
    p.name.toLowerCase().includes(q.toLowerCase()) && (!cat || (cat === 'none' ? !p.categoryId : p.categoryId === cat))), [items, q, cat]);

  const close = () => { setDialog(null); setError(''); };
  const saved = async (msg) => { close(); setNotice(msg); await load(); };

  async function toggle(p) { await api(`/api/products/${p.id}`, { method: 'PATCH', body: { isActive: !p.isActive } }); load(); }
  async function remove() {
    setBusy(true); setError('');
    try { const r = await api(`/api/products/${dialog.product.id}`, { method: 'DELETE' }); await saved(r.archived ? 'This item is on past orders, so it was hidden from the counter instead of deleted.' : 'Menu item deleted.'); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  const head = ['Item', 'Category', 'Price', ...(canSeeRecipe ? ['Cost', 'Margin'] : []), 'Status', ''];

  return (
    <>
      <PageHeader title="Menu & Prices" sub="What you sell, its price, and the stock each serving uses.">
        <Input className="w-48" placeholder="Search menu" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-44" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Filter by category">
          <option value="">All categories</option>
          <option value="none">Uncategorised</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        {canManage && <Button variant="primary" onClick={() => setDialog({ type: 'form' })}>Add item</Button>}
      </PageHeader>
      <PromoBanner promotion={promo.promotion} upcoming={promo.upcoming} className="mb-4" />
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <DataTable head={head} emptyText={!items ? (loadError ? '' : 'Loading…') : rows.length === 0 ? 'No menu items found.' : null}>
        {rows.map((p) => {
          const margin = p.price > 0 && p.recipeLines > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
          return (
            <tr key={p.id} className={p.isActive ? '' : 'opacity-60'}>
              <Td className="whitespace-nowrap font-medium">{p.name}</Td>
              <Td className="whitespace-nowrap">{p.categoryName || '—'}</Td>
              <Td className="whitespace-nowrap">
                {promo.percent ? (
                  <span className="inline-flex items-baseline gap-2">
                    <b>{money(fromMinor(promo.salePrice(toMinor(p.price))))}</b>
                    <s className="text-[13px] text-graphite" aria-label="regular price">{money(p.price)}</s>
                  </span>
                ) : money(p.price)}
              </Td>
              {canSeeRecipe && <Td className="whitespace-nowrap">{p.recipeLines > 0 ? money(p.cost) : <Pill tone="off">No recipe</Pill>}</Td>}
              {canSeeRecipe && <Td>{margin !== null ? `${margin}%` : '—'}</Td>}
              <Td><Pill tone={p.isActive ? 'ok' : 'off'}>{p.isActive ? 'On menu' : 'Hidden'}</Pill></Td>
              <Td>
                <div className="flex flex-wrap justify-end gap-1.5">
                  {canSeeRecipe && <Button size="sm" variant="accent" onClick={() => setDialog({ type: 'recipe', product: p })}>Recipe</Button>}
                  {canManage && <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.isActive ? 'Hide' : 'Show'}</Button>}
                  {canManage && <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'form', product: p })}>Edit</Button>}
                  {canManage && <Button size="sm" variant="danger" onClick={() => setDialog({ type: 'delete', product: p })}>Delete</Button>}
                </div>
              </Td>
            </tr>
          );
        })}
      </DataTable>

      {dialog?.type === 'form' && <ProductFormDialog product={dialog.product} categories={categories} onSaved={saved} onClose={close} />}
      {dialog?.type === 'recipe' && <RecipeDialog product={dialog.product} canEdit={canEditRecipe} onSaved={saved} onClose={close} />}
      {dialog?.type === 'delete' && (
        <ConfirmDialog title={`Delete ${dialog.product.name}?`} confirmLabel="Delete" danger busy={busy} error={error} onConfirm={remove} onClose={close}>
          This removes the item and its recipe. To just stop selling it, use Hide instead.
        </ConfirmDialog>
      )}
    </>
  );
}
