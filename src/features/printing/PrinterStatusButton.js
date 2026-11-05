'use client';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import usePrinter from './usePrinter';
import PrinterSetup from './PrinterSetup';
import PrinterIcon from './PrinterIcon';

/**
 * "Printer" button for the page header of Take Orders and Orders & Receipts.
 * Shows the state at a glance and opens the setup dialog, so printer setup is part of the selling flow
 * instead of a separate page the owner has to find.
 */
export default function PrinterStatusButton({ shopPaper }) {
  const { direct, config, hydrated } = usePrinter();
  const [open, setOpen] = useState(false);

  // Before the saved settings are read (first paint) show a neutral label, not a false "not connected".
  const label = !hydrated ? 'Printer' : direct ? 'Printer ready' : config.mode === 'browser' ? 'Print window' : 'Connect printer';
  const variant = hydrated && config.mode === 'none' ? 'accent' : 'secondary';

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <PrinterIcon className="mr-2 size-4" />
        {hydrated && direct && <span aria-hidden="true" className="mr-1 font-bold">✓</span>}
        {label}
      </Button>
      {open && <Modal title="Receipt printer" onClose={() => setOpen(false)}><PrinterSetup shopPaper={shopPaper} /></Modal>}
    </>
  );
}
