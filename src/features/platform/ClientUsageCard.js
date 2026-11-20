'use client';
import { useEffect, useState } from 'react';
import { Alert, Card, Pill, StatCard } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateTime } from '@/lib/format';
import { DEFAULT_USAGE_DAYS } from '@/lib/platform/usage.mjs';
import { DailyBars, RangeTabs, UseBar } from './UsageParts';

/** "Usage" section of one client's page: how often they sign in and which features they use (counts only). */
export default function ClientUsageCard({ clientId }) {
  const [days, setDays] = useState(DEFAULT_USAGE_DAYS);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setError('');
    api(`/api/platform/clients/${clientId}/usage?days=${days}`).then((d) => current && setData(d)).catch((e) => current && setError(e.message));
    return () => { current = false; };
  }, [clientId, days]);

  const c = data?.client;
  const used = data ? data.features.filter((f) => f.count > 0) : [];
  const top = used[0]?.count ?? 0;

  return (
    <section aria-label="Usage">
      <div className="mb-3.5 mt-9 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Usage</h2>
        <RangeTabs days={days} onChange={setDays} />
      </div>
      {error && <Alert className="mb-4">{error}</Alert>}
      {!data && !error && <p className="text-graphite">Loading…</p>}
      {c && (
        <>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
            <StatCard label="Sign-ins" value={c.logins.toLocaleString('en-PK')} hint={`${c.activeUsers} of ${c.users} logins used`} />
            <StatCard label="Orders rung up" value={c.orders.toLocaleString('en-PK')} />
            <StatCard label="Things done in the app" value={c.actions.toLocaleString('en-PK')} />
            <Card>
              <p className="text-[13px] font-medium text-graphite">Status</p>
              <p className="mt-2"><Pill tone={c.activity.tone}>{c.activity.label}</Pill></p>
              <p className="mt-2 text-[13px] text-graphite">Last sign-in: {c.lastLoginAt ? dateTime(c.lastLoginAt) : 'never'}</p>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
            <DailyBars title="Sign-ins per day" points={data.daily} field="logins" noun="sign-ins" />
            <Card>
              <h3 className="mb-3 text-[17px] font-semibold">Features used</h3>
              {used.length === 0 ? (
                <p className="text-graphite">Nothing done in this period.</p>
              ) : (
                <ul className="m-0 grid list-none gap-3 p-0">
                  {used.map((f) => (
                    <li key={f.key} className="grid gap-1">
                      <span className="font-medium">{f.label}</span>
                      <UseBar value={f.count} max={top} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
}
