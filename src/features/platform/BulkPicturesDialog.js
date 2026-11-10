'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Modal, Pill, Select } from '@/components/ui';
import { api } from '@/lib/api-client';
import { shrinkImage } from '@/lib/images/shrink';
import { matchImage } from '@/lib/menu/match-images.mjs';
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_MAX_SIDE } from '@/lib/menu/product-image.mjs';
import ImportTarget from './ImportTarget';

const PARALLEL = 3;
let seq = 0;

/** Drop a folder of photos named after the menu items: they are matched automatically, anything unsure is shown for a quick check. */
export default function BulkPicturesDialog({ clientId, clientName, clientSlug, onChanged, onClose }) {
  const input = useRef(null);
  const rowsRef = useRef([]);
  const [products, setProducts] = useState(null);
  const [rows, setRows] = useState([]); // { id, file, url, productId, exact, state: 'idle' | 'uploading' | 'done' | 'failed', message }
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  rowsRef.current = rows;

  useEffect(() => {
    api(`/api/platform/clients/${clientId}/menu`).then(setProducts).catch((e) => setError(e.message));
    return () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.url));
  }, [clientId]);

  const byId = useMemo(() => new Map((products ?? []).map((p) => [p.id, p])), [products]);
  const sorted = useMemo(() => [...(products ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [products]);
  const patch = (id, change) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...change } : r)));

  function add(e) {
    const files = [...(e.target.files ?? [])].filter((f) => /^image\//.test(f.type));
    e.target.value = '';
    setRows((rs) => [...rs, ...files.map((file) => {
      const m = matchImage(file.name, products ?? []);
      return { id: ++seq, file, url: URL.createObjectURL(file), productId: m?.productId ?? '', exact: m?.exact ?? false, state: 'idle', message: '' };
    })]);
  }
  const remove = (r) => { URL.revokeObjectURL(r.url); setRows((rs) => rs.filter((x) => x.id !== r.id)); };

  const targets = rows.reduce((m, r) => (r.productId ? m.set(r.productId, (m.get(r.productId) ?? 0) + 1) : m), new Map());
  const todo = rows.filter((r) => r.productId && r.state !== 'done');
  const doneCount = rows.filter((r) => r.state === 'done').length;

  async function uploadAll() {
    setRunning(true); setError('');
    const queue = [...todo];
    const worker = async () => {
      for (let r = queue.shift(); r; r = queue.shift()) {
        patch(r.id, { state: 'uploading', message: '' });
        try {
          const form = new FormData();
          form.append('image', await shrinkImage(r.file, { maxSide: PRODUCT_IMAGE_MAX_SIDE, maxBytes: PRODUCT_IMAGE_MAX_BYTES }), 'picture');
          await api(`/api/platform/clients/${clientId}/products/${r.productId}/image`, { method: 'POST', body: form });
          patch(r.id, { state: 'done', message: '' });
        } catch (e) { patch(r.id, { state: 'failed', message: e.message }); }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, worker));
    setRunning(false);
    api(`/api/platform/clients/${clientId}/menu`).then(setProducts).catch(() => {});
    onChanged(`Pictures uploaded for ${clientName}.`);
  }

  function status(r) {
    if (r.state === 'uploading') return <Pill tone="neutral">Uploading…</Pill>;
    if (r.state === 'done') return <Pill tone="ok">Saved</Pill>;
    if (r.state === 'failed') return <span className="text-[13px] font-medium">Failed: {r.message}</span>;
    if (!r.productId) return <Pill tone="alert">Choose the item</Pill>;
    if (targets.get(r.productId) > 1) return <Pill tone="alert">Two pictures for one item</Pill>;
    if (!r.exact) return <Pill tone="alert">Check this match</Pill>;
    return <span className="text-[13px] text-graphite">{byId.get(r.productId)?.imageVersion ? 'Replaces current picture' : 'Ready'}</span>;
  }

  return (
    <Modal wide title="Upload pictures" onClose={onClose}>
      <ImportTarget clientName={clientName} clientSlug={clientSlug} />
      <p className="mt-0 text-graphite">Choose many photos at once. Name each file after its menu item (<b>cappuccino.jpg</b>, <b>Caramel Cappuccino.png</b>) and it is matched automatically. Big photos are made smaller for you.</p>
      {error && <Alert className="mb-3">{error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" disabled={!products || running} onClick={() => input.current?.click()}>{products ? 'Choose pictures' : 'Loading menu…'}</Button>
        {products && products.length === 0 && <span className="text-graphite">This client has no menu items yet. Import the menu first.</span>}
      </div>
      <input ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp" className="hidden" onChange={add} />

      {rows.length > 0 && (
        <>
          <ul className="mb-0 mt-4 grid max-h-[46vh] gap-2 overflow-auto p-0">
            {rows.map((r) => (
              <li key={r.id} className="grid list-none grid-cols-[56px_1fr] items-center gap-x-3 gap-y-1 rounded-xl border border-peach p-2 sm:grid-cols-[56px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <img src={r.url} alt="" className="size-14 rounded-lg object-cover" />
                <span className="min-w-0 truncate text-[13px] text-graphite" title={r.file.name}>{r.file.name}</span>
                <Select aria-label={`Menu item for ${r.file.name}`} disabled={running || r.state === 'done'} value={r.productId} onChange={(e) => patch(r.id, { productId: e.target.value, exact: true, state: 'idle', message: '' })}>
                  <option value="">— Choose item —</option>
                  {sorted.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
                <span className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1">
                  {status(r)}
                  {r.state !== 'done' && !running && <Button size="sm" variant="ghost" onClick={() => remove(r)}>Remove</Button>}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-graphite">{doneCount} saved · {todo.length} ready to upload · {rows.filter((r) => !r.productId).length} need an item</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>{doneCount ? 'Done' : 'Cancel'}</Button>
              <Button variant="accent" disabled={running || todo.length === 0} onClick={uploadAll}>{running ? 'Uploading…' : `Upload ${todo.length} picture${todo.length === 1 ? '' : 's'}`}</Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
