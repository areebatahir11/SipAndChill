'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, ConfirmDialog, DataTable, PageHeader, Pill, Td } from '@/components/ui';
import { api } from '@/lib/api-client';
import { dateOnly, dateTime, money } from '@/lib/format';
import { businessTypeLabel } from '@/lib/platform/constants.mjs';
import { useSubmit } from '@/lib/use-submit';
import { AccessPill, BillingPill } from './ClientPills';
import BillingDialog from './BillingDialog';
import ClientLogoCard from './ClientLogoCard';
import MenuSetupCard from './MenuSetupCard';
import EditClientDialog from './EditClientDialog';
import ResetOwnerPasswordDialog from './ResetOwnerPasswordDialog';

function Facts({ title, rows }) {
  return (
    <Card>
      <h3 className="mb-3 text-[17px] font-semibold">{title}</h3>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-graphite">{label}</dt>
            <dd className="min-w-0 break-words font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export default function ClientDetail({ id }) {
  const [client, setClient] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState(null); // { type: 'edit' | 'billing' | 'suspend' | 'approve' | 'reject' | 'password', owner? }
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setClient(await api(`/api/platform/clients/${id}`)); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const close = () => setDialog(null);
  const saved = (msg) => { close(); setNotice(msg); load(); };

  const toggleAccess = useSubmit(async () => {
    await api(`/api/platform/clients/${id}`, { method: 'PATCH', body: { isActive: !client.isActive } });
    saved(client.isActive ? 'Client suspended. Everyone was signed out.' : 'Client reactivated.');
  });

  const decide = useSubmit(async () => {
    const approve = dialog.type === 'approve';
    await api(`/api/platform/clients/${id}/approval`, { method: 'POST', body: { decision: approve ? 'approve' : 'reject' } });
    saved(approve ? 'Approved. The owner was emailed and can sign in now.' : 'Signup rejected. The owner was emailed.');
  });

  if (!client) {
    return (
      <>
        <PageHeader title="Client" />
        {loadError ? <Alert>{loadError}</Alert> : <p className="text-graphite">Loading…</p>}
        <Link href="/platform/clients" className="mt-4 inline-block underline">Back to clients</Link>
      </>
    );
  }

  return (
    <>
      <Link href="/platform/clients" className="mb-2 inline-block text-graphite underline-offset-2 hover:underline">← All my clients</Link>
      <PageHeader title={client.name} sub={`${businessTypeLabel(client.businessType)} · ${client.slug}`}>
        <BillingPill client={client} />
        <AccessPill client={client} />
        <Button variant="ghost" onClick={() => setDialog({ type: 'edit' })}>Edit details</Button>
        <Button variant="primary" onClick={() => setDialog({ type: 'billing' })}>Update billing</Button>
        {client.status === 'PENDING' && <Button variant="danger" onClick={() => setDialog({ type: 'reject' })}>Reject</Button>}
        {client.status !== 'ACTIVE' ? (
          <Button variant="accent" onClick={() => setDialog({ type: 'approve' })}>Approve signup</Button>
        ) : (
          <Button variant={client.isActive ? 'danger' : 'accent'} onClick={() => setDialog({ type: 'suspend' })}>
            {client.isActive ? 'Suspend' : 'Reactivate'}
          </Button>
        )}
      </PageHeader>
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Facts
          title="Billing"
          rows={[
            ['Status', <BillingPill key="s" client={client} />],
            ['Monthly fee', money(client.monthlyFee)],
            ['Due date', client.dueDate ? dateOnly(client.dueDate) : '—'],
            ['Last paid', client.lastPaidAt ? dateTime(client.lastPaidAt) : 'Never'],
            ['Internal note', client.internalNote || '—'],
          ]}
        />
        <Facts
          title="Account"
          rows={[
            ['Joined on', dateOnly(client.createdAt)],
            ['Logins (owner, managers, staff)', client.staffCount],
            ['Currency', client.currency],
          ]}
        />
        <ClientLogoCard clientId={id} logoVersion={client.logoVersion} onChanged={saved} />
        <MenuSetupCard clientId={id} clientName={client.name} clientSlug={client.slug} onChanged={setNotice} />
      </div>

      <h2 className="mb-3.5 mt-9 text-xl font-semibold">Owner login</h2>
      <DataTable head={['Name', 'Email', 'Status', 'Last sign-in', '']} emptyText={client.owners.length === 0 ? 'This client has no owner account.' : null}>
        {client.owners.map((o) => (
          <tr key={o.userId}>
            <Td className="whitespace-nowrap">{o.name}</Td>
            <Td className="whitespace-nowrap">{o.email}</Td>
            <Td><Pill tone={o.isActive ? 'ok' : 'off'}>{o.isActive ? 'Active' : 'Deactivated'}</Pill></Td>
            <Td>{o.lastLoginAt ? dateTime(o.lastLoginAt) : 'Never'}</Td>
            <Td className="text-right">
              <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'password', owner: o })}>Reset password</Button>
            </Td>
          </tr>
        ))}
      </DataTable>

      {dialog?.type === 'edit' && <EditClientDialog client={client} onSaved={() => saved('Details saved.')} onClose={close} />}
      {dialog?.type === 'billing' && <BillingDialog client={client} onSaved={() => saved('Billing updated.')} onClose={close} />}
      {dialog?.type === 'password' && (
        <ResetOwnerPasswordDialog clientId={id} owner={dialog.owner} onSaved={() => saved(`Password reset for ${dialog.owner.name}. They were signed out everywhere.`)} onClose={close} />
      )}
      {(dialog?.type === 'approve' || dialog?.type === 'reject') && (
        <ConfirmDialog
          title={dialog.type === 'approve' ? `Approve ${client.name}?` : `Reject ${client.name}?`}
          confirmLabel={dialog.type === 'approve' ? 'Approve' : 'Reject'}
          danger={dialog.type === 'reject'}
          busy={decide.busy}
          error={decide.error}
          onConfirm={decide.submit}
          onClose={close}
        >
          {dialog.type === 'approve'
            ? 'The owner can sign in right away and their free trial starts today. They will get an email, and must accept the Terms & Conditions on first sign-in.'
            : 'The owner will not be able to sign in and will get an email saying the signup was not approved. You can still approve it later.'}
        </ConfirmDialog>
      )}
      {dialog?.type === 'suspend' && (
        <ConfirmDialog
          title={client.isActive ? `Suspend ${client.name}?` : `Reactivate ${client.name}?`}
          confirmLabel={client.isActive ? 'Suspend' : 'Reactivate'}
          danger={client.isActive}
          busy={toggleAccess.busy}
          error={toggleAccess.error}
          onConfirm={toggleAccess.submit}
          onClose={close}
        >
          {client.isActive
            ? 'Nobody from this business will be able to sign in, and everyone is signed out immediately. Their data is kept.'
            : 'Their owner, managers and staff will be able to sign in again.'}
        </ConfirmDialog>
      )}
    </>
  );
}
