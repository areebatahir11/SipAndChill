'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, DataTable, PageHeader, Pill, Td } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import { api } from '@/lib/api-client';
import { dateTime } from '@/lib/format';
import { PERMISSIONS as P, ROLE_DEFAULTS, ROLE_CODES, canManageRank } from '@/lib/permissions/codes.mjs';
import StaffDialogs from './StaffDialogs';

const ROLES = Object.entries(ROLE_DEFAULTS).map(([code, r]) => ({ code, ...r }));

export default function StaffManager({ initialStaff = null }) {
  const router = useRouter();
  const { user: me, role: myRole, can } = useAuth();
  const canManage = can(P.USERS_MANAGE);
  const assignable = ROLES.filter((r) => canManageRank(myRole.rank, r.rank)); // roles I may hand out

  const [staff, setStaff] = useState(initialStaff);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try { setStaff(await api('/api/staff')); setLoadError(''); } catch (e) { setLoadError(e.message); }
  }, []);
  useEffect(() => { if (!initialStaff) load(); }, [load, initialStaff]);

  const open = (type, member, initial = {}) => { setDialog({ type, member }); setForm(initial); setError(''); };
  const close = () => setDialog(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // What each dialog sends when submitted.
  const actions = {
    add: () => [api('/api/staff', { method: 'POST', body: form }), 'Staff account created.'],
    name: (m) => [api(`/api/staff/${m.userId}`, { method: 'PATCH', body: { name: form.name } }), 'Name updated.'],
    role: (m) => [api(`/api/staff/${m.userId}`, { method: 'PATCH', body: { roleCode: form.roleCode } }), 'Role updated.'],
    password: (m) => [api(`/api/staff/${m.userId}/password`, { method: 'POST', body: { newPassword: form.newPassword } }), 'Password reset. They were signed out everywhere.'],
    status: (m) => [api(`/api/staff/${m.userId}`, { method: 'PATCH', body: { isActive: !m.isActive } }), m.isActive ? 'Account deactivated.' : 'Account reactivated.'],
  };

  async function submit() {
    setBusy(true); setError('');
    try {
      const [request, success] = actions[dialog.type](dialog.member);
      await request; await load(); close(); setNotice(success);
      if (dialog.type === 'name' && dialog.member.userId === me.id) router.refresh(); // the sidebar shows my own name
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const defaultRole = assignable.find((r) => r.code === ROLE_CODES.CASHIER)?.code || assignable[0]?.code;

  return (
    <>
      <PageHeader title="My Team" sub="Give your managers and staff their own logins.">
        {canManage && assignable.length > 0 && <Button variant="primary" onClick={() => open('add', null, { roleCode: defaultRole })}>Add staff</Button>}
      </PageHeader>
      {notice && <Alert tone="success" className="mb-4">{notice}</Alert>}
      {loadError && <Alert className="mb-4">{loadError}</Alert>}

      <DataTable head={['Name', 'Email', 'Role', 'Status', 'Last sign-in', '']} emptyText={!staff ? (loadError ? '' : 'Loading…') : null}>
        {staff?.map((s) => {
          const self = s.userId === me.id;
          const mine = canManage && !self && canManageRank(myRole.rank, s.role.rank); // hierarchy: only lower ranks
          return (
            <tr key={s.userId}>
              <Td className="whitespace-nowrap">{s.name}{self ? ' (you)' : ''}</Td>
              <Td className="whitespace-nowrap">{s.email}</Td>
              <Td><Pill>{s.role.name}</Pill></Td>
              <Td><Pill tone={s.isActive ? 'ok' : 'off'}>{s.isActive ? 'Active' : 'Deactivated'}</Pill></Td>
              <Td>{s.lastLoginAt ? dateTime(s.lastLoginAt) : 'Never'}</Td>
              <Td className="text-right">
                {(mine || (self && canManage)) && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => open('name', s, { name: s.name })}>Rename</Button>
                    {mine && <Button size="sm" variant="ghost" onClick={() => open('role', s, { roleCode: s.role.code })}>Change role</Button>}
                    {mine && <Button size="sm" variant="ghost" onClick={() => open('password', s, { newPassword: '' })}>Reset password</Button>}
                    {mine && <Button size="sm" variant={s.isActive ? 'danger' : 'accent'} onClick={() => open('status', s)}>{s.isActive ? 'Deactivate' : 'Reactivate'}</Button>}
                  </div>
                )}
              </Td>
            </tr>
          );
        })}
      </DataTable>

      <h2 className="mb-3.5 mt-9 text-xl font-semibold">What each person can do</h2>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {ROLES.map((r) => (
          <Card key={r.code}>
            <h3 className="mb-2.5 text-[17px] font-semibold">{r.name}</h3>
            <p className="text-graphite">{r.description}</p>
            <p className="mt-2 text-[13px]">{r.permissions.length} permissions</p>
          </Card>
        ))}
      </div>

      <StaffDialogs dialog={dialog} form={form} set={set} error={error} busy={busy} roles={assignable} onClose={close} onSubmit={submit} />
    </>
  );
}
