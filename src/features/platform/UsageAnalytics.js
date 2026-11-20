'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Card, DataTable, PageHeader, Pill, StatCard, Td } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateTime } from '@/lib/format';
import { DEFAULT_USAGE_DAYS } from '@/lib/platform/usage.mjs';
import { DailyBars, RangeTabs, UseBar } from './UsageParts';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** PearlSolutions: which clients sign in and which features they use. Counts only; never a client's sales, prices or customers. */
export default function UsageAnalytics() {
  const [days, setDays] = useState(DEFAULT_USAGE_DAYS);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true; // ignore the answer of an older period if the user switched quickly
    setError('');
    api(`/api/platform/usage?days=${days}`).then((d) => current && setData(d)).catch((e) => current && setError(e.message));
    return () => { current = false; };
  }, [days]);

  const t = data?.totals;
  const topFeature = data ? Math.max(...data.features.map((f) => f.count), 0) : 0;
  const silent = data?.clients.filter((c) => c.logins === 0) ?? [];

  return (
    <>
      <PageHeader title="Usage Analytics" sub="Who is using your software, how often they sign in and which features they use. Counts only: never a client's sales, prices or customers.">
        <RangeTabs days={days} onChange={setDays} />
      </PageHeader>
      {error && <Alert className="mb-4">{error}</Alert>}
      {!data && !error && <p className="text-graphite">Loading…</p>}

      {data && (
        <div className={error ? 'opacity-60' : undefined}>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
            <StatCard label="Sign-ins" value={t.logins.toLocaleString('en-PK')} hint={`${plural(t.activeUsers, 'person')} signed in`} />
            <StatCard label="Clients using it" value={`${t.loggedIn} of ${t.clients}`} hint={t.silent ? `${t.silent} did not sign in` : 'every client signed in'} />
            <StatCard label="Orders rung up" value={t.orders.toLocaleString('en-PK')} hint="at the counter" />
            <StatCard label="Things done in the app" value={t.actions.toLocaleString('en-PK')} hint="orders, expenses, stock, team…" />
          </div>
          {data.suspended > 0 && <p className="mt-3 text-[13px] text-graphite">{plural(data.suspended, 'suspended client')} not included (they cannot sign in).</p>}

          <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            <DailyBars title="Sign-ins per day" points={data.daily} field="logins" noun="sign-ins" />
            <DailyBars title="Orders per day" points={data.daily} field="orders" noun="orders" />
          </div>

          <h2 className="mb-3.5 mt-9 text-xl font-semibold">Which features are used most</h2>
          <DataTable head={['Feature', 'Used by', 'Times used']} emptyText={data.features.length === 0 ? 'No features yet.' : null}>
            {data.features.map((f) => (
              <tr key={f.key}>
                <Td><b className="block">{f.label}</b><small className="text-graphite">{f.hint}</small></Td>
                <Td className="whitespace-nowrap">{f.clients} of {t.clients} clients <small className="text-graphite">({f.adoption}%)</small></Td>
                <Td><UseBar value={f.count} max={topFeature} /></Td>
              </tr>
            ))}
          </DataTable>

          <h2 className="mb-3.5 mt-9 text-xl font-semibold">Clients, most active first</h2>
          <DataTable
            head={['Client', 'Status', 'Sign-ins', 'People', 'Last sign-in', 'Orders', 'Most used', 'Total actions']}
            emptyText={data.clients.length === 0 ? 'No running clients yet.' : null}
          >
            {data.clients.map((c) => (
              <tr key={c.id}>
                <Td className="whitespace-nowrap"><Link href={`/platform/clients/${c.id}`} className="font-medium underline-offset-2 hover:underline">{c.name}</Link></Td>
                <Td><Pill tone={c.activity.tone}>{c.activity.label}</Pill></Td>
                <Td className="tabular-nums">{c.logins}</Td>
                <Td className="whitespace-nowrap tabular-nums">{c.activeUsers} of {c.users}<small className="block text-graphite">signed in</small></Td>
                <Td className="whitespace-nowrap">{c.lastLoginAt ? dateTime(c.lastLoginAt) : 'Never'}</Td>
                <Td className="tabular-nums">{c.orders.toLocaleString('en-PK')}</Td>
                <Td className="whitespace-nowrap">{c.topFeature ? <>{c.topFeature.label}<small className="block text-graphite">{c.topFeature.count.toLocaleString('en-PK')} times</small></> : '—'}</Td>
                <Td className="tabular-nums">{c.actions.toLocaleString('en-PK')}</Td>
              </tr>
            ))}
          </DataTable>

          {silent.length > 0 && (
            <Card className="mt-4">
              <h3 className="mb-1 text-[17px] font-semibold">No sign-in in the last {data.range.days} days</h3>
              <p className="mb-2 text-graphite">These clients may need a call: a shop that stops signing in often stops paying.</p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {silent.map((c) => (
                  <li key={c.id}><Link href={`/platform/clients/${c.id}`} className="inline-block rounded-full bg-peach px-3 py-1 text-[13px] font-medium underline-offset-2 hover:underline">{c.name}</Link></li>
                ))}
              </ul>
            </Card>
          )}
          <p className="mt-6 text-[13px] text-graphite">Period: {data.range.from} to {data.range.to} (Pakistan time). Features show what staff did in the app (for example orders taken), not which screens they only looked at.</p>
        </div>
      )}
    </>
  );
}
