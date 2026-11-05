'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, ButtonLink, DataTable, PageHeader, StatCard, Td } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateOnly, money } from '@/lib/format';
import { BillingPill } from './ClientPills';

const ClientLink = ({ client }) => (
  <Link href={`/platform/clients/${client.id}`} className="font-medium underline-offset-2 hover:underline">{client.name}</Link>
);

export default function PlatformDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/platform/stats').then(setData).catch((e) => setError(e.message));
  }, []);

  const s = data?.summary;

  return (
    <>
      <PageHeader title="Overview" sub="Your clients, what they pay you, and who needs a reminder.">
        <ButtonLink href="/platform/clients" variant="primary">See all clients</ButtonLink>
      </PageHeader>
      {error && <Alert className="mb-4">{error}</Alert>}
      {!data && !error && <p className="text-graphite">Loading…</p>}

      {s && (
        <>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard label="Total clients" value={s.total} hint={`${s.active} running`} />
            <StatCard label="Paid" value={s.paid} hint="clients who paid" />
            <StatCard label="Not paid" value={s.unpaid} hint={s.overdue ? `${s.overdue} late` : 'none late'} />
            <StatCard label="Suspended" value={s.suspended} hint="cannot log in" />
            <StatCard label="Money received" value={money(s.monthlyRevenue)} hint="monthly fees paid" />
            <StatCard label="Money still to receive" value={money(s.outstanding)} hint="monthly fees not paid yet" />
          </div>

          <h2 className="mb-3.5 mt-9 text-xl font-semibold">Clients who have not paid</h2>
          <DataTable
            head={['Client', 'Owner', 'Monthly fee', 'Pay by', 'Status']}
            emptyText={data.attention.length === 0 ? 'Every client has paid.' : null}
          >
            {data.attention.map((c) => (
              <tr key={c.id}>
                <Td className="whitespace-nowrap"><ClientLink client={c} /></Td>
                <Td className="whitespace-nowrap">{c.owner?.email || '—'}</Td>
                <Td className="whitespace-nowrap">{money(c.monthlyFee)}</Td>
                <Td className="whitespace-nowrap">{c.dueDate ? dateOnly(c.dueDate) : '—'}</Td>
                <Td><BillingPill client={c} /></Td>
              </tr>
            ))}
          </DataTable>

          <h2 className="mb-3.5 mt-9 text-xl font-semibold">Suspended clients</h2>
          <DataTable
            head={['Client', 'Owner', 'Monthly fee', 'Billing']}
            emptyText={data.suspended.length === 0 ? 'No client is suspended.' : null}
          >
            {data.suspended.map((c) => (
              <tr key={c.id}>
                <Td className="whitespace-nowrap"><ClientLink client={c} /></Td>
                <Td className="whitespace-nowrap">{c.owner?.email || '—'}</Td>
                <Td className="whitespace-nowrap">{money(c.monthlyFee)}</Td>
                <Td><BillingPill client={c} /></Td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </>
  );
}
