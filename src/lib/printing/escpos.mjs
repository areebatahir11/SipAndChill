// ESC/POS receipt encoder: turns the receipt model (src/lib/orders/receipt.mjs) into the raw bytes a
// thermal receipt printer understands (Epson-compatible: Xprinter, Rongta, GPrinter, POS-58/80, ...).
// Pure ES module (no browser or Node APIs) so it is unit-tested in tests/escpos.test.mjs.

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const PAPER_WIDTHS = [58, 80];
/** Characters per line in Font A (12 dots wide): 384 dots on 58 mm paper, 576 dots on 80 mm paper. */
export const COLS = { 58: 32, 80: 48 };
export const DOTS = { 58: 384, 80: 576 };
const DOTS_PER_MM = 8;     // 203 dpi heads
const LINE_DOTS = 30;      // default line height of Font A (24 dots) + spacing
/** Typical roll length used for the "receipts per roll" estimate (58x40 roll ~30 m, 80x80 roll ~70 m). */
export const ROLL_METERS = { 58: 30, 80: 70 };

export const normalizePaper = (w) => (PAPER_WIDTHS.includes(Number(w)) ? Number(w) : 80);

// Characters the printer's default code page (CP437/ASCII) can print as text. Anything else is either drawn
// as a small picture (Urdu, Arabic, emoji ...) when a rasterizer is available, or replaced by "?".
const SIMPLE = { '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\u00a0': ' ', '\u2022': '*', '\u00d7': 'x' };
const normalizeChar = (ch) => SIMPLE[ch] ?? ch;
export const isPrintable = (ch) => { const c = ch.charCodeAt(0); return c >= 0x20 && c <= 0x7e; };

/** Cleans a string for ASCII printing. Returns { text, lossy } where lossy means characters were replaced. */
export function toAscii(value) {
  let lossy = false;
  const text = [...String(value ?? '')].map((raw) => {
    const ch = normalizeChar(raw);
    if (ch.length === 1 && isPrintable(ch)) return ch;
    if (ch.length > 1) return [...ch].map((c) => (isPrintable(c) ? c : '?')).join('');
    lossy = true;
    return '?';
  }).join('');
  return { text, lossy };
}

export const needsPicture = (value) => [...String(value ?? '')].some((raw) => {
  const ch = normalizeChar(raw);
  return !(ch.length >= 1 && [...ch].every(isPrintable)) && raw !== '\n' && raw !== '\r' && raw !== '\t';
});

/** Word-wraps to `cols` characters; words longer than a line are cut. Always returns at least one line. */
export function wrap(value, cols) {
  const words = String(value ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (let word of words) {
    while (word.length > cols) {
      if (line) { lines.push(line); line = ''; }
      lines.push(word.slice(0, cols));
      word = word.slice(cols);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= cols) line += ' ' + word;
    else { lines.push(line); line = word; }
  }
  if (line || !lines.length) lines.push(line);
  return lines;
}

/** Splits bytes into pieces of at most `size` bytes (printers have small receive buffers). */
export function chunk(bytes, size) {
  const out = [];
  for (let i = 0; i < bytes.length; i += size) out.push(bytes.subarray(i, Math.min(i + size, bytes.length)));
  return out;
}

export class EscPos {
  constructor({ cols = 32 } = {}) {
    this.cols = cols;
    this.buf = [];
    this.dots = 0;       // paper used so far, in printer dots
    this.hMul = 1;       // current character height multiplier
  }

  raw(...bytes) { for (const b of bytes) this.buf.push(b & 0xff); return this; }
  init() { return this.raw(ESC, 0x40).raw(ESC, 0x74, 0x00); }               // reset, code page 0 = CP437
  align(a) { return this.raw(ESC, 0x61, { left: 0, center: 1, right: 2 }[a] ?? 0); }
  bold(on) { return this.raw(ESC, 0x45, on ? 1 : 0); }
  /** w and h are 1..2 (normal or double). */
  size(w = 1, h = 1) {
    const W = Math.min(Math.max(w, 1), 2); const H = Math.min(Math.max(h, 1), 2);
    this.hMul = H;
    return this.raw(GS, 0x21, ((W - 1) << 4) | (H - 1));
  }
  text(value) { const { text } = toAscii(value); for (const ch of text) this.buf.push(ch.charCodeAt(0)); return this; }
  line(value = '') { this.text(value); this.buf.push(LF); this.dots += LINE_DOTS * this.hMul; return this; }
  hr(ch = '-') { return this.line(ch.repeat(this.cols)); }
  /** Left text and right text on one line (right side always kept whole; the left side is cut to fit). */
  row(left, right) {
    const r = toAscii(right).text;
    const l = toAscii(left).text;
    const space = Math.max(this.cols - r.length - 1, 0);
    return this.line(l.slice(0, space).padEnd(this.cols - r.length) + r);
  }
  feed(n = 1) { this.dots += LINE_DOTS * n; return this.raw(ESC, 0x64, Math.min(Math.max(n, 0), 255)); }
  /**
   * Cut. Printers without a cutter simply ignore it. Three styles, because cheap printers differ in what they understand:
   *   'feed'    GS V 66 0  feeds to the cutter by itself, then partial cut (standard; most printers).
   *   'partial' GS V 1     older printers: cuts where the paper is, so feed enough lines BEFORE it (see CUT_FEED_LINES).
   *   'full'    GS V 0     same as 'partial' but cuts all the way through.
   */
  cut(style = 'feed') {
    if (style === 'partial') return this.raw(GS, 0x56, 0x01);
    if (style === 'full') return this.raw(GS, 0x56, 0x00);
    return this.raw(GS, 0x56, 0x42, 0x00);
  }
  /** Opens the cash drawer connected to the printer (pin 2, 100 ms on / 500 ms off). */
  drawer() { return this.raw(ESC, 0x70, 0x00, 0x32, 0xfa); }
  /** 1-bit picture: GS v 0. `data` = rows of ceil(width/8) bytes, 1 = black dot. */
  picture({ widthBytes, height, data }) {
    this.raw(GS, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, height & 0xff, (height >> 8) & 0xff);
    for (const b of data) this.buf.push(b);
    this.dots += height;
    return this;
  }
  lengthMm() { return Math.round((this.dots / DOTS_PER_MM) * 10) / 10; }
  bytes() { return Uint8Array.from(this.buf); }
}

const pad2 = (n) => String(n).padStart(2, '0');
/** "05/11/2026 02:30 PM" in Pakistan time, independent of the cashier PC's time zone. */
export function formatDate(iso, timeZone = 'Asia/Karachi') {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
  const h = Number(parts.hour) % 24;
  return `${parts.day}/${parts.month}/${parts.year} ${pad2(h % 12 || 12)}:${parts.minute} ${h >= 12 ? 'PM' : 'AM'}`;
}

const STATUS = { PAID: 'PAID', PARTIAL: 'PARTIALLY PAID', UNPAID: 'UNPAID' };

/**
 * Builds the print job for one receipt.
 * @param model   result of buildReceipt()
 * @param opts    { paper: 58|80, cut, cutStyle: 'feed'|'partial'|'full', drawer, copies, feedLines, picture(text, {bold, dots}) -> picture | null }
 * @returns { bytes, lengthMm, receiptsPerRoll, copies }
 *          Every copy is a complete receipt (with its own cut), so copies=2 gives two tear-off slips.
 */
export const CUT_STYLES = Object.freeze(['feed', 'partial', 'full']);
/** Blank lines pushed out before the cut: 'feed' feeds to the cutter itself; the older styles need the paper moved first (~22 mm clears the blade). */
export const feedBeforeCut = (style) => (style === 'partial' || style === 'full' ? 6 : 4);
const cutStyleOf = (v) => (CUT_STYLES.includes(v) ? v : 'feed');

export function receiptToEscPos(model, opts = {}) {
  const paper = normalizePaper(opts.paper);
  const cols = COLS[paper];
  const copies = Math.min(Math.max(Number(opts.copies) || 1, 1), 5);
  const cutStyle = cutStyleOf(opts.cutStyle);
  const feedLines = Number.isFinite(opts.feedLines) ? opts.feedLines : feedBeforeCut(cutStyle);
  const makePicture = typeof opts.picture === 'function' ? opts.picture : null;

  const out = [];
  let lengthMm = 0;

  for (let copy = 0; copy < copies; copy++) {
    const p = new EscPos({ cols }).init();

    /** One logical line; non-Latin text becomes a small picture when possible, else "?" is printed. */
    const put = (value, { bold = false, align = 'left', size = 1 } = {}) => {
      const text = String(value ?? '');
      if (makePicture && needsPicture(text)) {
        const pic = makePicture(text, { bold, dots: DOTS[paper], align });
        if (pic) { p.align('left').picture(pic); return; }
      }
      p.align(align).bold(bold);
      const per = Math.floor(cols / size);
      for (const l of wrap(toAscii(text).text, per)) p.size(size, size === 2 ? 2 : 1).line(l);
      p.size(1, 1).bold(false);
    };

    // header
    put(model.businessName, { bold: true, align: 'center', size: model.businessName && model.businessName.length <= cols / 2 ? 2 : 1 });
    if (model.address) put(model.address, { align: 'center' });
    if (model.phone) put(`Tel: ${model.phone}`, { align: 'center' });
    p.align('left').hr();
    if (model.cancelled) { put('*** CANCELLED ***', { bold: true, align: 'center' }); }

    // order info
    p.align('left');
    p.row('Order #', String(model.orderNo));
    p.row('Date', formatDate(model.createdAt));
    p.row('Cashier', String(model.cashierName ?? ''));
    p.hr();

    // items: name on its own line(s), then "qty x price .... total"
    for (const l of model.lines) {
      put(l.name, { bold: true });
      p.align('left').row(`${l.quantity} x ${l.unitPrice}`, l.lineTotal);
    }
    p.hr();

    // totals
    p.row('Subtotal', model.subtotal);
    if (model.discount) p.row('Discount', `- ${model.discount}`);
    p.bold(true).size(1, 2).row('TOTAL', model.total).size(1, 1).bold(false);
    p.row('Amount Received', model.received);
    p.row('Change Returned', model.change);
    if (model.hasOutstanding && !model.cancelled) p.bold(true).row('Outstanding', model.outstanding).bold(false);
    p.row('Payment Status', STATUS[model.paymentStatus] ?? String(model.paymentStatus));
    p.hr();

    if (model.footer) put(model.footer, { align: 'center' });

    p.align('left').feed(feedLines);
    if (opts.cut !== false) p.cut(cutStyle);
    // The drawer opens once, on the first slip, and only for a sale that was actually paid.
    if (opts.drawer && copy === 0 && !model.cancelled && model.paymentStatus !== 'UNPAID') p.drawer();

    out.push(p.bytes());
    lengthMm += p.lengthMm();
  }

  const total = out.reduce((n, b) => n + b.length, 0);
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const b of out) { bytes.set(b, at); at += b.length; }
  const perReceipt = lengthMm / copies;
  return { bytes, lengthMm: Math.round(lengthMm * 10) / 10, receiptsPerRoll: receiptsPerRoll(perReceipt, paper), copies };
}

/** How many receipts of this length one typical roll gives. */
export function receiptsPerRoll(lengthMm, paper = 80) {
  if (!(lengthMm > 0)) return 0;
  return Math.floor((ROLL_METERS[normalizePaper(paper)] * 1000) / lengthMm);
}

/** A short test slip: paper width ruler, cut and (optionally) the drawer, so staff can check the setup. */
export function testSlip(opts = {}) {
  const paper = normalizePaper(opts.paper);
  const cutStyle = cutStyleOf(opts.cutStyle);
  const cols = COLS[paper];
  const p = new EscPos({ cols }).init();
  p.align('center').bold(true).size(2, 2).line('PRINTER OK').size(1, 1).bold(false);
  p.line(`${paper} mm paper, ${cols} characters per line`);
  p.align('left').hr('=');
  p.line('0123456789'.repeat(5).slice(0, cols));
  p.line('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'.padEnd(cols, 'x').slice(0, cols));
  p.row('Left text', 'Right text');
  p.hr('=').align('center').line(formatDate(new Date().toISOString())).align('left').feed(opts.feedLines ?? feedBeforeCut(cutStyle));
  if (opts.cut !== false) p.cut(cutStyle);
  return { bytes: p.bytes(), lengthMm: p.lengthMm() };
}

/** Only opens the cash drawer. */
export const drawerOnly = () => new EscPos().init().drawer().bytes();
