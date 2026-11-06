'use client';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Field, Pill, Select } from '@/components/ui';
import { buildReceipt } from '@/lib/orders/receipt.mjs';
import { receiptToEscPos, ROLL_METERS } from '@/lib/printing/escpos.mjs';
import { BAUD_RATES, deviceLabel } from './printer';
import usePrinter from './usePrinter';
import PrinterIcon from './PrinterIcon';

// A typical small cafe bill, used only to estimate how much paper a receipt needs.
const SAMPLE = buildReceipt({
  orderNo: 1, createdAt: new Date().toISOString(), cashierName: 'Cashier', status: 'COMPLETED', paymentStatus: 'PAID',
  subtotal: '1150', discount: '0', total: '1150', amountPaid: '1150',
  items: [
    { name: 'Cold Coffee', quantity: 2, unitPrice: '350', lineTotal: '700' },
    { name: 'Chocolate Shake', quantity: 1, unitPrice: '300', lineTotal: '300' },
    { name: 'Fries', quantity: 1, unitPrice: '150', lineTotal: '150' },
  ],
  payments: [{ amountReceived: '1200', changeReturned: '50' }],
}, { businessName: 'Sample Shop', phone: '0300-0000000', address: 'Your address', receiptFooter: 'Thank you! Visit again.', currency: 'Rs' });

const Check = ({ checked, onChange, children, hint }) => (
  <label className="flex items-start gap-2.5">
    <input type="checkbox" className="mt-1 size-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{children}{hint && <small className="block text-graphite">{hint}</small>}</span>
  </label>
);

/** Collapsible block: keeps the rare options out of sight so the first screen has one obvious button. */
const More = ({ title, children }) => (
  <details className="rounded-2xl border border-peach px-4 py-3">
    <summary className="cursor-pointer font-medium">{title}</summary>
    <div className="mt-3 grid gap-3">{children}</div>
  </details>
);

/**
 * Everything about the counter's receipt printer, in the order a shop owner needs it:
 * 1) is it connected  2) connect it (one button)  3) test  4) auto-print  5) rare options (collapsed).
 * Used inside a dialog (Take Orders / Orders & Receipts) and on the /printer page.
 * All behaviour comes from usePrinter / printer.js (unchanged); this file is layout and wording only.
 */
export default function PrinterSetup({ shopPaper }) {
  const { config, status, direct, link, api: printer } = usePrinter();
  const [error, setError] = useState('');
  // Browser capabilities are only known on the client; reading them during the server render would not match.
  const [sup, setSup] = useState(null);
  useEffect(() => { setSup(printer.support()); }, [printer]);
  const can = sup || { usb: false, serial: false, secure: true };
  // A print error is already shown by the status line (e.shown): showing it here as well made every error appear twice.
  const act = (fn) => async () => { setError(''); try { await fn(); } catch (e) { if (e?.name !== 'NotFoundError' && !e?.shown) setError(e.message || String(e)); } };

  const paper = config.paper === 'shop' ? shopPaper : Number(config.paper);
  const estimate = useMemo(() => receiptToEscPos(SAMPLE, { paper }), [paper]);
  const busy = status.state === 'printing';

  const usb = config.mode === 'usb';
  const blocked = direct && usb && link === 'blocked';   // Chrome remembers the printer, but a Windows driver owns it
  const missing = direct && usb && link === 'missing';   // remembered, but not plugged in / switched off
  const checking = direct && usb && link === 'checking';
  const working = direct && !blocked && !missing && !checking;
  const headline = blocked ? 'Printer found, but Windows is blocking it'
    : missing ? 'Printer not found'
    : checking ? 'Checking the printer…'
    : direct ? 'Printer is ready'
    : config.mode === 'browser' ? 'Using the browser print window' : 'No printer connected yet';
  const explain = direct ? 'Receipts go straight to this printer.'
    : config.mode === 'browser'
      ? 'A print window opens for every receipt. Connect a printer below to skip it.'
      : 'Connect it once on this counter. After that receipts print by themselves.';

  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-blush p-4">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-slate text-blush"><PrinterIcon className="size-5" /></span>
        <div className="min-w-0 flex-1 leading-snug">
          <b className="block">{headline}</b>
          <small className="block text-graphite">{direct ? deviceLabel(config) : explain}</small>
        </div>
        <Pill tone={working ? 'ok' : blocked || missing ? 'alert' : 'off'}>{working ? 'Connected' : blocked ? 'Blocked' : missing ? 'Not found' : checking ? 'Checking' : 'Not connected'}</Pill>
      </div>

      {sup && !sup.secure && <Alert>Direct printing needs a secure page (https://). Open the app from its https address.</Alert>}
      {sup && sup.secure && !sup.usb && !sup.serial && <Alert>This browser cannot talk to printers directly. Use Google Chrome or Microsoft Edge (PC or Android), or use the print window option below.</Alert>}

      {!direct && (
        <div className="grid gap-3">
          <div>
            <Button variant="primary" size="lg" className="w-full" disabled={!can.usb || !can.secure} onClick={act(printer.pairUsb)}>Connect printer</Button>
            <small className="mt-1.5 block text-graphite">Plug the printer in with its USB cable and switch it on. Click the button, then pick your printer in the window that opens (look for its model name, e.g. “SP-200U”, “POS-80”, “XP-58”).</small>
          </div>
          <More title="My printer is Bluetooth, or it does not connect">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" disabled={!can.serial || !can.secure} onClick={act(printer.pairSerial)}>Connect Bluetooth / COM-port printer</Button>
                <Select aria-label="Baud rate" className="max-w-[130px]" value={config.baudRate} onChange={(e) => printer.updateConfig({ baudRate: Number(e.target.value) })}>
                  {BAUD_RATES.map((b) => <option key={b} value={b}>{b} baud</option>)}
                </Select>
              </div>
              <small className="mt-1 block text-graphite">For printers that show up as a COM port (many Bluetooth printers after pairing in Windows). Default speed is 9600; the printer’s self-test slip shows its speed.</small>
            </div>
            <div>
              <Button variant="ghost" onClick={() => printer.updateConfig({ mode: 'browser', usb: null, serial: null })}>Use the browser print window instead</Button>
              <small className="mt-1 block text-graphite">Works with any printer that has a Windows/Android driver. Needs one click in the print window for every receipt.</small>
            </div>
          </More>
        </div>
      )}

      {blocked && (
        <div className="grid gap-3 rounded-2xl border border-peach p-4">
          <p className="m-0"><b>Why:</b> the Windows printer driver of this printer has taken the USB port, so the browser may not use it. Nothing is wrong with the printer or the software. Pick one:</p>
          <div>
            <Button variant="primary" onClick={act(async () => printer.updateConfig({ mode: 'browser', usb: null, serial: null }))}>Use the browser print window (works now)</Button>
            <small className="mt-1.5 block text-graphite">A print window opens for each receipt. The paper is cut by the printer driver’s own setting (see “Paper roll and help”).</small>
          </div>
          <div>
            <b>Or print and cut automatically (one-time setup on this PC)</b>
            <ol className="mt-1 grid list-decimal gap-1 pl-5 text-graphite">
              <li>Download <b>Zadig</b> (zadig.akeo.ie) and open it.</li>
              <li>Menu <b>Options → List All Devices</b>. Choose the printer in the list (it is called “{deviceLabel(config)}” or “USB Printing Support”).</li>
              <li>Pick <b>WinUSB</b> as the driver on the right, press <b>Replace Driver</b>, wait for “success”.</li>
              <li>Unplug and replug the printer, then press <b>Check again</b> below.</li>
            </ol>
            <small className="mt-1 block text-graphite">After this, Windows no longer lists the printer for normal programs. Receipts go only through this app, which is what you want at the counter.</small>
          </div>
          <div><Button variant="secondary" onClick={act(printer.probe)}>Check again</Button></div>
        </div>
      )}

      {missing && (
        <div className="grid gap-2">
          <Alert>The printer is not answering. Switch it on, check the USB cable, then try again.</Alert>
          <div><Button variant="secondary" onClick={act(printer.probe)}>Check again</Button></div>
        </div>
      )}

      {working && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={busy} onClick={act(() => printer.testPrint(shopPaper))}>{busy ? 'Printing…' : 'Print test slip'}</Button>
            <Button variant="secondary" disabled={busy} onClick={act(printer.openDrawer)}>Open cash drawer</Button>
          </div>
          <small className="text-graphite">The test slip prints a ruler. If its lines wrap or are cut off, change the paper width under “More options”.</small>
        </div>
      )}

      {status.message && !(blocked && status.state === 'error') && <Alert tone={status.state === 'error' ? 'error' : 'success'}>{status.message}</Alert>}
      {error && <Alert>{error}</Alert>}

      {working && (
        <div className="rounded-2xl border border-peach p-4">
          <Check checked={config.autoPrint} onChange={(v) => printer.updateConfig({ autoPrint: v })} hint="The receipt comes out the moment you tap Confirm order. You can still print again from Orders & Receipts.">
            <b>Print the receipt automatically after each order</b>
          </Check>
        </div>
      )}

      <More title="More options">
        <Field label="Paper width">
          <Select value={config.paper} onChange={(e) => printer.updateConfig({ paper: e.target.value === 'shop' ? 'shop' : Number(e.target.value) })}>
            <option value="shop">Same as Shop Settings ({shopPaper} mm)</option>
            <option value={58}>58 mm</option>
            <option value={80}>80 mm</option>
          </Select>
        </Field>
        <Field label="Copies per receipt">
          <Select value={config.copies} onChange={(e) => printer.updateConfig({ copies: Number(e.target.value) })}>
            {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
          </Select>
        </Field>
        <Check checked={config.cut} onChange={(v) => printer.updateConfig({ cut: v })} hint="Printers without a cutter just ignore this.">Cut the paper after each receipt</Check>
        {config.cut && (
          <Field label="Cut style">
            <Select value={config.cutStyle} onChange={(e) => printer.updateConfig({ cutStyle: e.target.value })}>
              <option value="feed">Standard (recommended)</option>
              <option value="partial">Older printer: feed, then partial cut</option>
              <option value="full">Older printer: feed, then full cut</option>
            </Select>
            <small className="mt-1 block text-graphite">Leave on Standard. If the test slip prints but the paper is not cut, pick “Older printer”, press Print test slip again.</small>
          </Field>
        )}
        <Check checked={config.drawer} onChange={(v) => printer.updateConfig({ drawer: v })} hint="Needs a cash drawer plugged into the printer’s RJ11 socket.">Open the cash drawer with paid receipts</Check>
        <Check checked={config.pictures} onChange={(v) => printer.updateConfig({ pictures: v })} hint="Item names in Urdu or other scripts are printed as small pictures. Without this they print as “?”.">Print Urdu / non-English names</Check>
        <p className="text-[13px] text-graphite">These options are saved in this browser, so each counter can have its own printer.</p>
        {config.mode !== 'none' && <div><Button variant="danger" size="sm" onClick={act(printer.forget)}>Disconnect this printer</Button></div>}
      </More>

      <More title="Paper roll and help">
        <p>The software has <b>no limit</b>: it prints as long as the printer has paper. A typical bill of 3 items on {paper} mm paper uses about <b>{(estimate.lengthMm / 10).toFixed(1)} cm</b>, so a standard {ROLL_METERS[paper]} m roll gives roughly <b>{estimate.receiptsPerRoll.toLocaleString()}</b> receipts. Use thermal paper; the printer needs no ink.</p>
        <ul className="grid list-disc gap-1.5 pl-5">
          <li><b>“Printer is being used by another program”</b> (Windows): Windows has claimed the USB printer with its own driver. Use the Bluetooth / COM-port option, or the browser print window, or install the WinUSB driver for the printer with the free Zadig tool, then connect again.</li>
          <li><b>Paper is not cut (print window / Windows driver)</b>: the cut then comes from the printer driver, not from this app. Windows → Settings → Printers &amp; scanners → your printer → Printing preferences, and set the paper cutter to cut after each page or document (the wording differs per driver). A paper jam in the cutter also stops it: open the lid, remove the jammed strip, reload the roll.</li>
          <li><b>Print without the dialog (Windows, driver installed)</b>: in the print window choose the printer’s <b>80 mm</b> paper size, margins “None”, scale 100%. To skip the window, start Chrome with <code>--kiosk-printing</code> (add it to the end of the Chrome shortcut’s Target) and set this printer as the Windows default printer.</li>
          <li><b>Printer not in the list</b>: switch it on, use a data cable (not a charge-only cable), try another USB port. Use Chrome or Edge.</li>
          <li><b>Garbled text</b>: the printer may not speak ESC/POS (rare). Use the browser print window.</li>
          <li><b>Network (LAN / Wi-Fi) printers</b> cannot be reached directly by a web page. Connect them by USB, or use the browser print window with the printer installed on the PC.</li>
          <li><b>iPhone / iPad</b> do not allow direct printing from the browser. Use the print window (AirPrint printers) or a Windows / Android counter device.</li>
        </ul>
      </More>
    </div>
  );
}
