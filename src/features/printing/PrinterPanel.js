'use client';
import { Card, PageHeader } from '@/components/ui';
import PrinterSetup from './PrinterSetup';

/** The /printer page (no sidebar link any more; the same setup opens from the Printer button on Take Orders and Orders & Receipts). */
export default function PrinterPanel({ shopPaper }) {
  return (
    <>
      <PageHeader title="Receipt Printer" sub="Connect the thermal printer on this counter once. After that every receipt prints with one tap, or by itself after each sale." />
      <Card className="max-w-[620px]"><PrinterSetup shopPaper={shopPaper} /></Card>
    </>
  );
}
