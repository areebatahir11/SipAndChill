'use client';
import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import BulkPicturesDialog from './BulkPicturesDialog';
import MenuImportDialog from './MenuImportDialog';

/** PearlSolutions onboarding tools for one client's menu. Business owners keep editing single items and pictures in Menu & Prices. */
export default function MenuSetupCard({ clientId, clientName, clientSlug, onChanged }) {
  const target = { clientName, clientSlug };
  const [open, setOpen] = useState(null); // 'import' | 'pictures'
  return (
    <Card>
      <h3 className="mb-1 text-[17px] font-semibold">Menu setup</h3>
      <p className="mb-3.5 mt-0 text-graphite">Set up this client&apos;s whole menu in minutes: first their price list, then their photos.</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => setOpen('import')}>Import menu (Excel)</Button>
        <Button variant="secondary" onClick={() => setOpen('pictures')}>Upload pictures</Button>
      </div>
      {open === 'import' && <MenuImportDialog clientId={clientId} {...target} onImported={onChanged} onClose={() => setOpen(null)} />}
      {open === 'pictures' && <BulkPicturesDialog clientId={clientId} {...target} onChanged={onChanged} onClose={() => setOpen(null)} />}
    </Card>
  );
}
