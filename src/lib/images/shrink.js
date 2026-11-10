/**
 * Browser-side: turns any photo (PNG / JPG / WebP, any size) into a small picture that fits `maxBytes`,
 * so owners never meet a "file too big" wall. Tries WebP then JPEG, lowers quality, then lowers the size.
 * Transparent areas become white (JPEG has no transparency).
 */
export async function shrinkImage(file, { maxSide, maxBytes }) {
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('The picture must be a PNG, JPG or WebP file.'); }
  const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));

  for (const factor of [1, 0.75, 0.5]) {
    const scale = Math.min(1, (maxSide * factor) / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const type of ['image/webp', 'image/jpeg']) {
      for (const quality of [0.85, 0.75, 0.65, 0.5]) {
        const blob = await toBlob(canvas, type, quality);
        if (blob && blob.type === type && blob.size <= maxBytes) return blob; // blob.type differs when the browser cannot encode this format
      }
    }
  }
  throw new Error('This picture is too detailed to shrink. Please choose a simpler one.');
}
