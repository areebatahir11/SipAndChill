'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { LOGO_MAX_BYTES, LOGO_MAX_SIDE } from '@/lib/branding/logo.mjs';

/** Any PNG / JPG / WebP, any size: shrink to LOGO_MAX_SIDE in the browser so owners never meet a "file too big" wall. */
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

export default function LogoUploader() {
  const router = useRouter();
  const { tenant } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function run(job, message) {
    setBusy(true); setError(''); setDone('');
    try { await job(); setDone(message); router.refresh(); } catch (e) { setError(e.message || 'Something went wrong.'); }
    setBusy(false);
  }

  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still triggers onChange
    if (!file) return;
    run(async () => {
      const form = new FormData();
      form.append('logo', await shrink(file), 'logo');
      await api('/api/settings/logo', { method: 'POST', body: form });
    }, 'Logo saved. It now shows at the top of the menu.');
  };
  const remove = () => run(() => api('/api/settings/logo', { method: 'DELETE' }), 'Logo removed.');

  return (
    <Card className="mb-5 max-w-[520px]">
      <h2 className="mb-3 text-lg font-semibold">Business logo</h2>
      <div className="flex items-center gap-4">
        <span className="grid size-20 flex-none place-items-center overflow-hidden rounded-2xl border border-peach bg-white p-1.5">
          {tenant.logoVersion
            ? <img src={`/api/settings/logo?v=${tenant.logoVersion}`} alt="Current logo" className="max-h-full max-w-full object-contain" />
            : <span className="text-center text-xs text-graphite">No logo yet</span>}
        </span>
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Please wait…' : tenant.logoVersion ? 'Change logo' : 'Upload logo'}</Button>
            {tenant.logoVersion && <Button variant="danger" disabled={busy} onClick={remove}>Remove</Button>}
          </div>
          <small className="text-graphite">PNG, JPG or WebP. Big pictures are made smaller automatically. A square logo looks best.</small>
        </div>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
      {error && <Alert className="mt-3">{error}</Alert>}
      {done && <Alert tone="success" className="mt-3">{done}</Alert>}
    </Card>
  );
}
