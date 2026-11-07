'use client';
// Direct receipt printing from the cashier's browser to a thermal printer (ESC/POS).
//
// WHY THE BROWSER: the app runs on a server in the cloud; it cannot reach a printer sitting on the shop counter.
// The cashier's own PC/tablet is next to the printer, so the browser sends the bytes:
//   USB     -> WebUSB   (Chrome / Edge, printer must NOT be claimed by a Windows printer driver, see PrinterPanel)
//   Serial  -> Web Serial (USB-serial and Bluetooth printers that appear as a COM port)
//   Browser -> normal print dialog (any installed printer driver; the old behaviour, always available)
// Needs HTTPS (or localhost). The permission is asked once per device; after that printing is silent.

import { chunk, drawerOnly, receiptToEscPos, testSlip } from '@/lib/printing/escpos.mjs';
import { api } from '@/lib/api-client';
import { pictureFromText } from './raster';
import { reportPrint } from './print-report';

const KEY = 'sipchill.printer.v1';
export const BAUD_RATES = [9600, 19200, 38400, 57600, 115200];

export const DEFAULTS = Object.freeze({
  mode: 'none',          // 'usb' | 'serial' | 'browser' | 'none'
  usb: null,             // { vendorId, productId, serialNumber, name }
  serial: null,          // { usbVendorId, usbProductId }
  baudRate: 9600,
  paper: 'shop',         // 'shop' = use Shop Settings, or 58 / 80
  copies: 1,
  cut: true,
  cutStyle: 'feed',     // 'feed' (standard) | 'partial' | 'full': see EscPos.cut(); change only if the standard cut does nothing
  drawer: false,
  autoPrint: true,
  pictures: true,        // print Urdu / non-Latin names as pictures instead of "?"
});

const isBrowser = typeof window !== 'undefined';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function load() {
  if (!isBrowser) return { ...DEFAULTS };
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}

// link = can the browser really use the saved USB printer? 'unknown' | 'checking' | 'ok' | 'blocked' (Windows driver owns it) | 'missing' | 'error'
let snapshot = { config: { ...DEFAULTS }, status: { state: 'idle', message: '' }, link: 'unknown', hydrated: false };
const listeners = new Set();
const emit = () => { snapshot = { ...snapshot }; listeners.forEach((l) => l()); };

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getSnapshot = () => snapshot;
const SERVER_SNAPSHOT = Object.freeze({ config: DEFAULTS, status: Object.freeze({ state: 'idle', message: '' }), link: 'unknown', hydrated: false });
export const getServerSnapshot = () => SERVER_SNAPSHOT; // must be the same object every time

/** Called once on the client: reads saved settings (server render used the defaults). */
export function hydrate() {
  if (!isBrowser || snapshot.hydrated) return;
  snapshot = { ...snapshot, config: load(), hydrated: true };
  emit();
  if (snapshot.config.mode === 'usb') probe(); // "Connected" must mean the printer really answers, not only that Chrome remembers it
}

export function updateConfig(patch) {
  snapshot.config = { ...snapshot.config, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(snapshot.config)); } catch { /* private mode: keep in memory */ }
  emit();
}

function setStatus(state, message) { snapshot.status = { state, message, at: Date.now() }; emit(); }
function setLink(link) { if (snapshot.link !== link) { snapshot.link = link; emit(); } }

export function support() {
  if (!isBrowser) return { usb: false, serial: false, secure: false };
  return { usb: !!navigator.usb, serial: !!navigator.serial, secure: window.isSecureContext };
}

export const isDirect = (config = snapshot.config) => config.mode === 'usb' || config.mode === 'serial';

/** Plain-language explanation of the errors a shop owner will actually meet. */
const isClaimError = (err) => err?.name === 'SecurityError' || /access denied|unable to claim|claimInterface/i.test(String(err?.message || err || ''));

export function explain(err) {
  const msg = String(err?.message || err || '');
  if (err?.name === 'NotFoundError' && /no device selected|no port selected/i.test(msg)) return 'No printer was selected.';
  if (isClaimError(err)) {
    return 'Windows is holding this printer with its own driver, so the browser cannot send to it directly. Either print with the browser print window (works right now), or install the WinUSB driver for this printer with Zadig (then receipts print and cut by themselves).';
  }
  if (err?.name === 'NetworkError' || /disconnected|transfer|device unavailable/i.test(msg)) return 'The printer stopped answering. Check that it is on, has paper and the cable is connected, then try again.';
  if (err?.code === 'NOT_FOUND') return err.message;
  return msg || 'Printing failed.';
}

class PrinterError extends Error { constructor(message, code) { super(message); this.code = code; } }

/* ---------------------------------------------------------------- pairing */

export async function pairUsb() {
  if (!navigator.usb) throw new PrinterError('This browser cannot use USB printers. Use Chrome or Edge.', 'UNSUPPORTED');
  const dev = await navigator.usb.requestDevice({ filters: [] });
  updateConfig({ mode: 'usb', usb: { vendorId: dev.vendorId, productId: dev.productId, serialNumber: dev.serialNumber || null, name: dev.productName || 'USB printer' } });
  await probe();
  return dev;
}

export async function pairSerial() {
  if (!navigator.serial) throw new PrinterError('This browser cannot use serial / Bluetooth printers. Use Chrome or Edge.', 'UNSUPPORTED');
  const port = await navigator.serial.requestPort();
  const info = port.getInfo();
  updateConfig({ mode: 'serial', serial: { usbVendorId: info.usbVendorId ?? null, usbProductId: info.usbProductId ?? null } });
  return port;
}

export async function forget() {
  const { config } = snapshot;
  try {
    if (config.usb && navigator.usb) { const d = await findUsb(config.usb); if (d?.forget) await d.forget(); }
    if (config.serial && navigator.serial) { const p = await findSerial(config.serial); if (p?.forget) await p.forget(); }
  } catch { /* the permission may already be gone */ }
  updateConfig({ mode: 'none', usb: null, serial: null });
  setLink('unknown');
  setStatus('idle', '');
}

export function deviceLabel(config = snapshot.config) {
  if (config.mode === 'usb') return config.usb?.name || 'USB printer';
  if (config.mode === 'serial') return config.serial?.usbVendorId ? `Serial / Bluetooth printer (${config.serial.usbVendorId.toString(16)}:${(config.serial.usbProductId ?? 0).toString(16)})` : 'Serial / Bluetooth printer';
  if (config.mode === 'browser') return 'Browser print dialog';
  return 'No printer connected';
}

/* ---------------------------------------------------------------- transports */

async function findUsb(saved) {
  const list = await navigator.usb.getDevices();
  return list.find((d) => d.vendorId === saved.vendorId && d.productId === saved.productId && (!saved.serialNumber || d.serialNumber === saved.serialNumber)) || null;
}

async function findSerial(saved) {
  const ports = await navigator.serial.getPorts();
  return ports.find((p) => { const i = p.getInfo(); return i.usbVendorId === saved.usbVendorId && i.usbProductId === saved.usbProductId; }) || (saved.usbVendorId == null ? ports[0] : null) || null;
}

/** Opens the saved USB printer, claims its printer interface, runs use(dev, best), and always lets go again. */
async function withUsb(saved, use) {
  const dev = await findUsb(saved);
  if (!dev) throw new PrinterError('Printer not found. Check that it is switched on and plugged in, or connect it again.', 'NOT_FOUND');
  await dev.open();
  let claimed = null;
  try {
    if (dev.configuration === null) await dev.selectConfiguration(1);
    let best = null;
    for (const iface of dev.configuration.interfaces) {
      for (const alt of iface.alternates) {
        const ep = alt.endpoints.find((e) => e.direction === 'out' && e.type === 'bulk');
        if (!ep) continue;
        const score = alt.interfaceClass === 7 ? 2 : 1; // 7 = printer class
        if (!best || score > best.score) best = { iface: iface.interfaceNumber, alt: alt.alternateSetting, ep: ep.endpointNumber, score };
      }
    }
    if (!best) throw new PrinterError('This USB device has no printer output. Is it really a receipt printer?', 'NO_ENDPOINT');
    await dev.claimInterface(best.iface);
    claimed = best.iface;
    if (best.alt) await dev.selectAlternateInterface(best.iface, best.alt);
    return await use(dev, best);
  } finally {
    try { if (claimed !== null) await dev.releaseInterface(claimed); } catch { /* ignore */ }
    try { await dev.close(); } catch { /* ignore */ }
  }
}

const sendUsb = (bytes, saved) => withUsb(saved, async (dev, best) => {
  for (const part of chunk(bytes, 4096)) {
    const res = await dev.transferOut(best.ep, part);
    if (res.status !== 'ok') throw new Error(`USB transfer ${res.status}`);
  }
  await sleep(150); // let the printer take the last bytes before the port closes
});

async function sendSerial(bytes, saved, baudRate) {
  const port = await findSerial(saved);
  if (!port) throw new PrinterError('Printer not found. Check that it is switched on and paired, or connect it again.', 'NOT_FOUND');
  await port.open({ baudRate, bufferSize: 4096 });
  try {
    const writer = port.writable.getWriter();
    try {
      const pace = Math.ceil((256 * 10 * 1000) / baudRate * 0.9); // ms the wire needs for one 256-byte piece
      for (const part of chunk(bytes, 256)) { await writer.write(part); if (baudRate <= 38400) await sleep(pace); }
    } finally { writer.releaseLock(); }
    await sleep(150);
  } finally {
    try { await port.close(); } catch { /* ignore */ }
  }
}

/* One job at a time: two quick sales must never interleave their bytes on the same printer. */
let chain = Promise.resolve();
const enqueue = (job) => { const run = chain.then(job, job); chain = run.catch(() => {}); return run; };

async function sendBytes(bytes) {
  const { config } = snapshot;
  if (!isDirect(config)) throw new PrinterError('No receipt printer is connected on this device.', 'NO_PRINTER');
  const once = () => (config.mode === 'usb' ? sendUsb(bytes, config.usb) : sendSerial(bytes, config.serial, config.baudRate));
  try { await once(); } catch (e) {
    if (e?.code === 'NOT_FOUND' || e?.code === 'NO_ENDPOINT') throw e;
    await sleep(600);
    await once(); // one retry covers a printer that was busy or just woke up
  }
}

/**
 * Checks, without printing anything, that the saved USB printer can really be used (opened and claimed).
 * This is what "Connected" means in the screen: Chrome remembering a permission is not enough, because a Windows printer
 * driver can still own the device and then every print fails.
 */
export async function probe() {
  const { config } = snapshot;
  if (config.mode !== 'usb' || !config.usb || !navigator.usb) { setLink('unknown'); return snapshot.link; }
  setLink('checking');
  let last = null;
  // Two tries: another tab of this app checking the same printer at the same instant also looks like "blocked" for a moment.
  for (let attempt = 1; attempt <= 2; attempt++) {
    try { await enqueue(() => withUsb(config.usb, async () => {})); setLink('ok'); return 'ok'; }
    catch (e) { last = e; if (!isClaimError(e)) break; await sleep(700); }
  }
  setLink(last?.code === 'NOT_FOUND' ? 'missing' : isClaimError(last) ? 'blocked' : 'error');
  return snapshot.link;
}

/** `orderId` (optional): the result is also saved on that order, so a failure is still visible after the dialog is closed. */
async function run(label, build, orderId = null) {
  setStatus('printing', `${label}…`);
  try {
    const result = await enqueue(async () => { const job = build(); await sendBytes(job.bytes); return job; });
    if (snapshot.config.mode === 'usb') setLink('ok');
    setStatus('ok', `${label}: sent to the printer.`);
    reportPrint(orderId, 'sent'); // the printer accepted the data (it cannot report paper-out, so this is "sent", not "printed OK")
    return result;
  } catch (e) {
    if (snapshot.config.mode === 'usb') setLink(e?.code === 'NOT_FOUND' ? 'missing' : isClaimError(e) ? 'blocked' : snapshot.link);
    const message = explain(e);
    setStatus('error', message);
    reportPrint(orderId, 'failed');
    const shown = new Error(message);
    shown.shown = true; // the status line already shows it: callers must not show it a second time
    throw shown;
  }
}

/* ---------------------------------------------------------------- public actions */

const paperFor = (config, shopPaper) => (config.paper === 'shop' ? shopPaper : Number(config.paper));

/** Prints a receipt model (see buildReceipt). Resolves with { lengthMm, receiptsPerRoll }. */
export function printModel(model, shopPaper = 80, orderId = null) {
  const { config } = snapshot;
  return run('Receipt', () => receiptToEscPos(model, {
    paper: paperFor(config, shopPaper), cut: config.cut, cutStyle: config.cutStyle, drawer: config.drawer, copies: config.copies,
    picture: config.pictures ? pictureFromText : null,
  }), orderId);
}

/** Loads the saved order's receipt from the server and prints it. */
export async function printOrder(orderId) {
  let data;
  try { data = await api(`/api/orders/${orderId}/receipt`); } catch (e) {
    // Before this, a receipt that could not even be loaded failed silently. Now it is shown and recorded.
    const message = `Could not load the receipt (${e?.message || 'network error'}). Check the internet connection and press Print again.`;
    setStatus('error', message);
    reportPrint(orderId, 'failed');
    const shown = new Error(message);
    shown.shown = true;
    throw shown;
  }
  return printModel(data.model, data.paper, orderId);
}

export const testPrint = (shopPaper = 80) => {
  const { config } = snapshot;
  return run('Test slip', () => testSlip({ paper: paperFor(config, shopPaper), cut: config.cut, cutStyle: config.cutStyle }));
};

export const openDrawer = () => run('Cash drawer', () => ({ bytes: drawerOnly() }));
