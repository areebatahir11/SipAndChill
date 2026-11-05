import Button from './Button';

/** Cancel + submit row at the bottom of a dialog form. */
export default function FormActions({ onCancel, busy, label, variant = 'primary' }) {
  return (
    <div className="mt-4 flex justify-end gap-2.5">
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button type="submit" variant={variant} disabled={busy}>{label}</Button>
    </div>
  );
}
