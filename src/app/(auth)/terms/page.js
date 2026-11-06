import Link from 'next/link';
import TermsDocument from '@/features/legal/TermsDocument';
import { TERMS_TITLE } from '@/lib/legal/terms.mjs';

export const metadata = { title: `${TERMS_TITLE} · PearlSolutions` };

/** Public, read-only copy of the Terms & Conditions (linked from the signup page). */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-[760px] p-6 py-10">
      <img src="/brand/pearl-logo-light.png" alt="PearlSolutions" width={720} height={484} className="mb-4 block h-auto w-[150px]" style={{ width: 150, height: 'auto' }} />
      <div className="rounded-[20px] bg-white p-6 shadow-xl md:p-8"><TermsDocument /></div>
      <p className="mt-4 text-center"><Link href="/login" className="font-semibold underline">Back to sign in</Link></p>
    </main>
  );
}
