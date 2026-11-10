'use client';
import { useRef, useState } from 'react';
import { Alert, Button, Modal } from '@/components/ui';
import { api } from '@/lib/api-client';
import { shrinkImage } from '@/lib/images/shrink';
import { PRODUCT_IMAGE_MAX_BYTES, PRODUCT_IMAGE_MAX_SIDE } from '@/lib/menu/product-image.mjs';
import ProductThumb from './ProductThumb';

/** Add, change or remove one menu item's picture. `onChanged` lets the page reload its list; the dialog stays open so the owner sees the result. */
export default function ProductPictureDialog({ product, onChanged, onClose }) {
  const input = useRef(null);
  const [version, setVersion] = useState(product.imageVersion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function run(job, message) {
    setBusy(true); setError(''); setDone('');
    try { setVersion((await job()).imageVersion); setDone(message); onChanged(); } catch (e) { setError(e.message || 'Something went wrong.'); }
    setBusy(false);
  }
  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // so choosing the same file again still triggers onChange
    if (!file) return;
    run(async () => {
      const form = new FormData();
      form.append('image', await shrinkImage(file, { maxSide: PRODUCT_IMAGE_MAX_SIDE, maxBytes: PRODUCT_IMAGE_MAX_BYTES }), 'picture');
      return api(`/api/products/${product.id}/image`, { method: 'POST', body: form });
    }, 'Picture saved. It now shows on the Take Orders screen.');
  };
  const remove = () => run(() => api(`/api/products/${product.id}/image`, { method: 'DELETE' }), 'Picture removed.');

  return (
    <Modal title={`Picture for ${product.name}`} onClose={onClose}>
      <ProductThumb id={product.id} name={product.name} version={version} className="aspect-[4/3] w-full rounded-2xl border border-peach" />
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Please wait…' : version ? 'Change picture' : 'Choose picture'}</Button>
        {version && <Button variant="danger" disabled={busy} onClick={remove}>Remove</Button>}
      </div>
      <small className="mt-2 block text-graphite">PNG, JPG or WebP. Any size: big photos are made smaller automatically. A clear, close-up photo of the drink works best.</small>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upload} />
      {error && <Alert className="mt-3">{error}</Alert>}
      {done && <Alert tone="success" className="mt-3">{done}</Alert>}
    </Modal>
  );
}
