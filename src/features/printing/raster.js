/** Draws text that a thermal printer cannot print as characters (Urdu, Arabic, emoji ...) onto a canvas and
 *  converts it to a 1-bit picture for the ESC/POS "GS v 0" command. Browser only. */

const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const FONT = '"Noto Nastaliq Urdu","Noto Naskh Arabic","Segoe UI",Tahoma,Arial,sans-serif';

export function pictureFromText(text, { bold = false, dots = 384, align = 'left' } = {}) {
  if (typeof document === 'undefined') return null;
  const size = 26;
  const lineHeight = 40;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;

  // word wrap by measured width
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (line && probe.measureText(test).width > dots - 8) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  if (!lines.length) return null;

  const height = lines.length * lineHeight + 6;
  const canvas = document.createElement('canvas');
  canvas.width = dots;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, dots, height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'middle';
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
  lines.forEach((l, i) => {
    const rtl = RTL.test(l);
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.textAlign = align === 'center' ? 'center' : rtl ? 'right' : 'left';
    const x = align === 'center' ? dots / 2 : rtl ? dots - 4 : 4;
    ctx.fillText(l, x, i * lineHeight + lineHeight / 2 + 3);
  });

  const widthBytes = Math.ceil(dots / 8);
  const rgba = ctx.getImageData(0, 0, dots, height).data;
  const data = new Uint8Array(widthBytes * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < dots; x++) {
      const i = (y * dots + x) * 4;
      const luminance = rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114;
      if (rgba[i + 3] > 40 && luminance < 150) data[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return { widthBytes, height, data };
}
