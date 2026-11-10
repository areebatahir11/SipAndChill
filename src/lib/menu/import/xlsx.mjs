// Dependency-free .xlsx reader (an .xlsx is a zip of XML files). Reads the first sheet that has data and returns rows of strings.
// Server-side only (uses node:zlib). Hardened for uploads: size caps on every entry, entry-count cap, no external references followed.
import { inflateRawSync } from 'node:zlib';

const MAX_ENTRIES = 200;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024; // uncompressed, per file inside the workbook (zip-bomb guard)
const MAX_ROWS = 5000;
const MAX_COLS = 50;

function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  const count = buf.readUInt16LE(eocd + 10);
  if (count > MAX_ENTRIES) throw new Error('too many files in the workbook');
  const entries = new Map();
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n += 1) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('broken zip');
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    entries.set(buf.toString('utf8', p + 46, p + 46 + nameLen), { method: buf.readUInt16LE(p + 10), compSize: buf.readUInt32LE(p + 20), size: buf.readUInt32LE(p + 24), localOffset: buf.readUInt32LE(p + 42) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { buf, entries };
}

function entryText({ buf, entries }, name) {
  const e = entries.get(name);
  if (!e) return null;
  if (e.size > MAX_ENTRY_BYTES) throw new Error('workbook part too large');
  const lo = e.localOffset;
  if (lo + 30 > buf.length || buf.readUInt32LE(lo) !== 0x04034b50) throw new Error('broken zip');
  const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
  const data = buf.subarray(start, start + e.compSize);
  if (e.method === 0) return data.toString('utf8');
  if (e.method === 8) return inflateRawSync(data, { maxOutputLength: MAX_ENTRY_BYTES }).toString('utf8');
  throw new Error('unsupported compression');
}

const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:.-]+)="([^"]*)"/g)].map((m) => [m[1], decode(m[2])]));
const textOf = (xml) => [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join('');
const colIndex = (letters) => letters.split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

function sheetPaths(zip) {
  const wb = entryText(zip, 'xl/workbook.xml');
  if (wb === null) throw new Error('not a workbook');
  const rels = Object.fromEntries([...(entryText(zip, 'xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => { const a = attrs(m[0]); return [a.Id, a.Target]; }));
  return [...wb.matchAll(/<sheet\b[^>]*>/g)].map((m) => attrs(m[0])).filter((a) => a.state !== 'hidden' && a.state !== 'veryHidden')
    .map((a) => rels[a['r:id']]).filter(Boolean).map((t) => (t.startsWith('/') ? t.slice(1) : `xl/${t}`));
}

function parseSheet(xml, shared) {
  const rows = [];
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNo = Number(attrs(rm[1]).r);
    if (!rowNo || rowNo > MAX_ROWS || !rm[2]) continue;
    const cells = [];
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = attrs(cm[1]);
      const col = /^([A-Z]+)\d+$/.exec(a.r ?? '');
      if (!col || !cm[2]) continue;
      const ci = colIndex(col[1]);
      if (ci >= MAX_COLS) continue;
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(cm[2])?.[1];
      let value = '';
      if (a.t === 's') value = shared[Number(v)] ?? '';
      else if (a.t === 'inlineStr') value = textOf(cm[2]);
      else if (a.t === 'b') value = v === '1' ? 'TRUE' : 'FALSE';
      else if (a.t === 'e') value = '';
      else if (v !== undefined) value = decode(v);
      cells[ci] = value;
    }
    rows[rowNo - 1] = Array.from(cells, (c) => c ?? '');
  }
  return Array.from(rows, (r) => r ?? []); // row n of the result is row n of the sheet
}

/** Rows of strings from the first visible sheet that has any data. Throws Error('...') for anything that is not a readable workbook. */
export function readXlsx(bytes) {
  const zip = readZip(Buffer.from(bytes));
  const shared = [...(entryText(zip, 'xl/sharedStrings.xml') ?? '').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
  for (const path of sheetPaths(zip)) {
    const xml = entryText(zip, path);
    if (!xml) continue;
    const rows = parseSheet(xml, shared);
    if (rows.some((r) => r.some((c) => String(c).trim() !== ''))) return rows;
  }
  return [];
}
