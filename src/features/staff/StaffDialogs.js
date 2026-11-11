'use client';
import { Alert, Button, Field, Form, Input, Modal, Select } from '@/components/ui';
import { ROLE_DEFAULTS } from '@/lib/permissions/codes.mjs';

function Actions({ onCancel, busy, label, variant = 'primary' }) {
  return (
    <div className="mt-4 flex justify-end gap-2.5">
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant={variant} disabled={busy}>{label}</Button>
    </div>
  );
}

function RoleSelect({ value, onChange, roles }) {
  return (
    <>
      <Field label="Role">
        <Select value={value} onChange={onChange}>
          {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </Select>
      </Field>
      <p className="text-graphite">{ROLE_DEFAULTS[value]?.description}</p>
    </>
  );
}

/** dialog: { type: 'add' | 'name' | 'role' | 'password' | 'status', member? } */
export default function StaffDialogs({ dialog, form, set, error, busy, roles, onClose, onSubmit }) {
  if (!dialog) return null;
  const m = dialog.member;
  const submit = (e) => { e.preventDefault(); onSubmit(); };

  if (dialog.type === 'add') {
    return (
      <Modal title="Add staff member" onClose={onClose}>
        <Form onSubmit={submit}>
          <Field label="Full name"><Input required value={form.name || ''} onChange={set('name')} /></Field>
          <Field label="Email"><Input type="email" required value={form.email || ''} onChange={set('email')} /></Field>
          <Field label="Temporary password">
            <Input type="password" autoComplete="new-password" required value={form.password || ''} onChange={set('password')} placeholder="10+ characters, with a letter and a number" />
          </Field>
          <p className="text-[13px] text-graphite">They will be asked to choose their own password the first time they log in.</p>
          <RoleSelect value={form.roleCode} onChange={set('roleCode')} roles={roles} />
          {error && <Alert>{error}</Alert>}
          <Actions onCancel={onClose} busy={busy} label={busy ? 'Creating…' : 'Create account'} />
        </Form>
      </Modal>
    );
  }

  if (dialog.type === 'name') {
    return (
      <Modal title={`Rename ${m.name}`} onClose={onClose}>
        <Form onSubmit={submit}>
          <Field label="Full name">
            <Input required minLength={2} maxLength={80} value={form.name || ''} onChange={set('name')} placeholder="For example: M. Usman" />
            <small className="font-normal text-graphite">Shown in the sidebar and as Cashier on new receipts. Receipts already printed keep the name they had.</small>
          </Field>
          {error && <Alert>{error}</Alert>}
          <Actions onCancel={onClose} busy={busy} label={busy ? 'Saving…' : 'Save name'} />
        </Form>
      </Modal>
    );
  }

  if (dialog.type === 'role') {
    return (
      <Modal title={`Change role: ${m.name}`} onClose={onClose}>
        <Form onSubmit={submit}>
          <RoleSelect value={form.roleCode} onChange={set('roleCode')} roles={roles} />
          {error && <Alert>{error}</Alert>}
          <Actions onCancel={onClose} busy={busy} label="Save role" />
        </Form>
      </Modal>
    );
  }

  if (dialog.type === 'password') {
    return (
      <Modal title={`Reset password: ${m.name}`} onClose={onClose}>
        <Form onSubmit={submit}>
          <Field label="New password">
            <Input type="password" autoComplete="new-password" required value={form.newPassword} onChange={set('newPassword')} placeholder="10+ characters, with a letter and a number" />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Actions onCancel={onClose} busy={busy} label="Set password" />
        </Form>
      </Modal>
    );
  }

  return (
    <Modal title={m.isActive ? `Deactivate ${m.name}?` : `Reactivate ${m.name}?`} onClose={onClose}>
      <Form onSubmit={submit}>
        <p>
          {m.isActive
            ? 'They will be signed out immediately and will not be able to log in. Their order history is kept.'
            : 'They will be able to log in again with their current password.'}
        </p>
        {error && <Alert>{error}</Alert>}
        <Actions onCancel={onClose} busy={busy} label={m.isActive ? 'Deactivate' : 'Reactivate'} variant={m.isActive ? 'dangerSolid' : 'primary'} />
      </Form>
    </Modal>
  );
}
