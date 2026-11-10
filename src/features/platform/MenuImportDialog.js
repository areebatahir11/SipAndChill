'use client';
import { useRef, useState } from 'react';
import { Alert, Button, Modal, Pill } from '@/components/ui';
import { api } from '@/lib/api-client';
import { money } from '@/lib/format';
import ImportTarget from './ImportTarget';

const send = (clientId, clientSlug, file, apply) => {
  const form = new FormData();
  form.append('file', file);
  form.append('client', clientSlug);
  form.append('apply', String(apply));
  return api(`/api/platform/clients/${clientId}/menu-import`, { method: 'POST', body: form });
};

function change(r) {
  if (r.status === 'new') return <Pill tone="ok">New</Pill>;
  if (r.status === 'same') return <Pill tone="off">No change</Pill>;
  const parts = [];
  if (r.oldPrice !== r.price) parts.push(`Price ${money(r.oldPrice)} → ${money(r.price)}`);
  if (r.category && r.oldCategory !== r.category) parts.push(`Section ${r.oldCategory ?? 'none'} → ${r.category}`);
  return <span className="text-[13px]">{parts.join(' · ')}</span>;
}

/** Step 1: choose the client's Excel/CSV. Step 2: see exactly what will happen (nothing is saved yet). Step 3: confirm. */
export default function MenuImportDialog({ clientId, clientName, clientSlug, onImported, onClose }) {
  const input = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function choose(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true); setError(''); setPreview(null); setFile(f);
    try { setPreview(await send(clientId, clientSlug, f, false)); } catch (err) { setError(err.message); }
    setBusy(false);
  }
  async function apply() {
    setBusy(true); setError('');
    try {
      const r = await send(clientId, clientSlug, file, true);
      setResult(r);
      onImported(`Menu imported into ${clientName}: ${r.created} new item${r.created === 1 ? '' : 's'}, ${r.updated} updated, ${r.categoriesCreated} new section${r.categoriesCreated === 1 ? '' : 's'}.`);
    } catch (err) { setError(err.message); }
    setBusy(false);
  }

  const c = preview?.counts;
  const nothing = c && c.newItems + c.updates === 0;
  return (
    <Modal wide title="Import menu from Excel" onClose={onClose}>
      {result ? (
        <>
          <Alert tone="success">Done. {result.created} new item{result.created === 1 ? '' : 's'} added, {result.updated} updated, {result.categoriesCreated} new section{result.categoriesCreated === 1 ? '' : 's'}. Next, upload their pictures.</Alert>
          <div className="mt-4 flex justify-end"><Button variant="primary" onClick={onClose}>Done</Button></div>
        </>
      ) : (
        <>
          <ImportTarget clientName={clientName} clientSlug={clientSlug} />
          <p className="mt-0 text-graphite">Choose the client&apos;s menu file (.xlsx or .csv) with Category, Item and Price columns. <a className="font-medium underline" href="/templates/menu-import-template.xlsx" download>Download the template</a>. Nothing is saved until you confirm.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant={preview ? 'secondary' : 'primary'} disabled={busy} onClick={() => input.current?.click()}>{busy && !preview ? 'Reading…' : file ? 'Choose another file' : 'Choose file'}</Button>
            {file && <span className="text-graphite">{file.name}</span>}
          </div>
          <input ref={input} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={choose} />
          {error && <Alert className="mt-3">{error}</Alert>}

          {preview && (
            <>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                <Pill tone="ok">{c.newItems} new item{c.newItems === 1 ? '' : 's'}</Pill>
                <Pill tone="neutral">{c.updates} to update</Pill>
                <Pill tone="off">{c.unchanged} unchanged</Pill>
                <Pill tone="ok">{c.newCategories} new section{c.newCategories === 1 ? '' : 's'}</Pill>
                {c.problems > 0 && <Pill tone="alert">{c.problems} problem{c.problems === 1 ? '' : 's'}</Pill>}
              </div>
              {preview.errors.length > 0 && (
                <Alert className="mt-3">
                  <b>Fix these rows in the file, then choose it again:</b>
                  <ul className="mb-0 mt-1.5 list-disc pl-5">{preview.errors.map((e) => <li key={e.row}>Row {e.row}: {e.message}</li>)}</ul>
                </Alert>
              )}
              <div className="mt-3 max-h-[40vh] overflow-auto rounded-xl border border-peach">
                <table className="w-full border-collapse text-sm">
                  <thead className="sticky top-0 bg-blush text-left"><tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Section</th><th className="px-3 py-2">Item</th><th className="px-3 py-2">Price</th><th className="px-3 py-2">What happens</th></tr></thead>
                  <tbody>{preview.rows.map((r) => (
                    <tr key={r.row} className="border-t border-blush">
                      <td className="px-3 py-1.5 text-graphite">{r.row}</td><td className="px-3 py-1.5">{r.category ?? '—'}</td><td className="px-3 py-1.5 font-medium">{r.name}</td><td className="whitespace-nowrap px-3 py-1.5">{money(r.price)}</td><td className="px-3 py-1.5">{change(r)}</td>
                    </tr>))}</tbody>
                </table>
              </div>
              <p className="mb-0 mt-2 text-[13px] text-graphite">Importing only adds items and updates prices of items with the same name. It never deletes or hides anything.</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="accent" disabled={busy || preview.errors.length > 0 || nothing} onClick={apply}>{busy ? 'Importing…' : nothing ? 'Nothing to import' : `Import ${c.newItems + c.updates} item${c.newItems + c.updates === 1 ? '' : 's'} into ${clientName}`}</Button>
              </div>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
