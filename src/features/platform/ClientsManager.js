'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, ButtonLink, DataTable, Input, PageHeader, Select, Td } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateOnly, money } from '@/lib/format';
import { businessTypeLabel } from '@/lib/platform/constants.mjs';
import { AccessPill, BillingPill } from './ClientPills';
import CreateClientDialog from './CreateClientDialog';

const BILLING_FILTERS = [['', 'All billing'], ['PAID', 'Paid'], ['UNPAID', 'Unpaid (incl. overdue)']];
const ACCESS_FILTERS = [['', 'All access'], ['active', 'Active'], ['suspended', 'Suspended']];

export default function ClientsManager() {
  const [clients, setClients] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [q, setQ] = useState('');
  const [billing, setBilling] = useState('');
  const [access, setAccess] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { setClients(await api('/api/platform/clients')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (clients || []).filter((c) =>
      (!needle || `${c.name} ${c.slug} ${c.owner?.email || ''} ${c.owner?.name || ''}`.toLowerCase().includes(needle)) &&
      (!billing || c.billingStatus === billing) &&
      (!access || (access === 'active') === c.isActive));
  }, [clients, q, billing, access]);

  return (
    <>
      <PageHeader title="My Clients" sub="Every shop using your software.">
        <Button variant="primary" onClick={() => setCreating(true)}>Add client</Button>
      </PageHeader>
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <div className="mb-4 flex flex-wrap gap-2.5">
        <Input className="w-64" placeholder="Search name, owner or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select className="w-auto!" aria-label="Billing filter" value={billing} onChange={(e) => setBilling(e.target.value)}>
          {BILLING_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select className="w-auto!" aria-label="Access filter" value={access} onChange={(e) => setAccess(e.target.value)}>
          {ACCESS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      <DataTable
        head={['Client', 'Owner', 'Monthly fee', 'Due date', 'Billing', 'Access', '']}
        emptyText={!clients ? (loadError ? '' : 'Loading…') : shown.length === 0 ? 'No clients found.' : null}
      >
        {shown.map((c) => (
          <tr key={c.id}>
            <Td className="whitespace-nowrap">
              <Link href={`/platform/clients/${c.id}`} className="font-medium underline-offset-2 hover:underline">{c.name}</Link>
              <small className="block text-graphite">{businessTypeLabel(c.businessType)} · {c.staffCount} {c.staffCount === 1 ? 'user' : 'users'}</small>
            </Td>
            <Td className="whitespace-nowrap">
              {c.owner ? <>{c.owner.name}<small className="block text-graphite">{c.owner.email}</small></> : '—'}
            </Td>
            <Td className="whitespace-nowrap">{money(c.monthlyFee)}</Td>
            <Td className="whitespace-nowrap">{c.dueDate ? dateOnly(c.dueDate) : '—'}</Td>
            <Td><BillingPill client={c} /></Td>
            <Td><AccessPill client={c} /></Td>
            <Td className="text-right"><ButtonLink size="sm" variant="ghost" href={`/platform/clients/${c.id}`}>Manage</ButtonLink></Td>
          </tr>
        ))}
      </DataTable>

      {creating && <CreateClientDialog onCreated={() => { setCreating(false); load(); }} onClose={() => setCreating(false)} />}
    </>
  );
}
