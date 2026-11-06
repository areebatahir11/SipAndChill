import Link from 'next/link';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-[480px] place-content-center gap-3 p-6 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight">Page not found</h1>
      <p className="text-graphite">This page does not exist, or you do not have access to it.</p>
      <Link href="/" className="font-medium underline">Go to home</Link>
    </main>
  );
}
