import { Alert } from '@/components/ui';

/** Says, in every import dialog, WHICH client the file is going into. Similar names ("Sip & Chill" / "Sip And Chill") are easy to mix up. */
export default function ImportTarget({ clientName, clientSlug }) {
  return (
    <Alert tone="success" className="mb-3">
      <b>Importing into: {clientName}</b>
      <span className="text-graphite"> · {clientSlug}</span>
      <span className="block text-[13px]">Only this client&apos;s menu changes. Other clients are never touched. Wrong client? Close this and open the right one.</span>
    </Alert>
  );
}
