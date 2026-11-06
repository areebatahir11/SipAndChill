'use client';
import { useRef, useState } from 'react';
import { Alert, Button, Card } from '@/components/ui';
import { api } from '@/lib/api-client';
import { LOGO_MAX_BYTES, LOGO_MAX_SIDE } from '@/lib/branding/logo.mjs';

/** Any PNG / JPG / WebP, any size: shrink to LOGO_MAX_SIDE in the browser so nobody meets a "file too big" wall. */
async function shrink(file) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('The logo must be a PNG, JPG or WebP picture.'); }
  const scale = Math.min(1, LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const toBlob = (type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/png'); // PNG keeps a transparent background
  if (!blob || blob.size > LOGO_MAX_BYTES) blob = await toBlob('image/webp', 0.85);
  if (!blob || blob.size > LOGO_MAX_BYTES) throw new Error('This logo is too detailed. Please choose a simpler picture.');
  return blob;
}

/**
 * PearlSolutions sets the logo of one client (shown in that client's sidebar). Business owners cannot change it.
 * onChanged(message) lets the page reload the client so the new picture shows.
 */
export default function ClientLogoCard({ clientId, logoVersion, onChanged }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const url = `/api/platform/clients/${clientId}/logo`;

  async function run(job, message) {
    setBusy(true); setError('');
    try { await job(); onChanged(message); } catch (e) { setError(e.message || 'Something went wrong.'); }
    setBusy(false);
  }

  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still triggers onChange
    if (!file) return;
    run(async () => {
      const form = new FormData();
      form.append('logo', await shrink(file), 'logo');
      await api(url, { method: 'POST', body: form });
    }, 'Logo saved. It now shows in this client’s menu.');
  };
  const remove = () => run(() => api(url, { method: 'DELETE' }), 'Logo removed.');

  return (
    <Card>
      <h3 className="mb-3 text-[17px] font-semibold">Business logo</h3>
      <div className="flex items-center gap-4">
        <span className="grid size-20 flex-none place-items-center overflow-hidden rounded-2xl border border-peach bg-white p-1.5">
          {logoVersion
            ? <img src={`${url}?v=${logoVersion}`} alt="Current logo" className="max-h-full max-w-full object-contain" />
            : <span className="text-center text-xs text-graphite">No logo yet</span>}
        </span>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Please wait…' : logoVersion ? 'Change logo' : 'Upload logo'}</Button>
            {logoVersion && <Button variant="danger" disabled={busy} onClick={remove}>Remove</Button>}
          </div>
          <small className="text-graphite">PNG, JPG or WebP. Big pictures are made smaller automatically. A square logo looks best.</small>
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
      {error && <Alert className="mt-3">{error}</Alert>}
    </Card>
  );
}
