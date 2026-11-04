'use client';
import { useEffect, useState } from 'react';
import { Alert, Modal, Pill } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateTime } from '@/lib/format';

const LABEL = { OPENING: 'Opening', PURCHASE: 'Stock in', ADJUSTMENT: 'Count', WASTAGE: 'Wastage', USAGE: 'Used in order' };

export default function MovementsDialog({ item, onClose }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/ingredients/${item.id}/movements`).then(setRows).catch((e) => setError(e.message)); }, [item.id]);

  return (
    <Modal title={`History: ${item.name}`} onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      {!rows && !error && <p className="text-graphite">Loading…</p>}
      {rows?.length === 0 && <p className="text-graphite">No movements yet.</p>}
      <ul className="grid gap-2">
        {rows?.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 border-b border-blush pb-2 text-sm">
            <div>
              <Pill tone={m.quantity >= 0 ? 'ok' : 'off'}>{LABEL[m.type] || m.type}</Pill>
              <div className="mt-1 text-graphite">{dateTime(m.createdAt)}{m.userName ? ` · ${m.userName}` : ''}{m.note ? ` · ${m.note}` : ''}</div>
            </div>
            <b>{m.quantity > 0 ? '+' : ''}{m.quantity} {item.unit}</b>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
