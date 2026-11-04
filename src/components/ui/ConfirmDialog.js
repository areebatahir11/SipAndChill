'use client';
import Alert from './Alert';
import Button from './Button';
import Modal from './Modal';

export default function ConfirmDialog({ title, children, confirmLabel = 'Confirm', danger, busy, error, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="grid gap-4">
        <p>{children}</p>
        {error && <Alert>{error}</Alert>}
        <div className="flex justify-end gap-2.5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'dangerSolid' : 'primary'} disabled={busy} onClick={onConfirm}>{busy ? 'Please wait…' : confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}
