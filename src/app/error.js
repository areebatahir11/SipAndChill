'use client';
import { Button } from '@/components/ui';

/** Shown when a page crashes unexpectedly. Technical details are only in the server log, never on screen. */
export default function ErrorPage({ reset }) {
  return (
    <main className="mx-auto grid min-h-screen max-w-[480px] place-content-center gap-3 p-6 text-center">
      <h1 className="text-[26px] font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-graphite">The page could not be loaded. Your data is safe. Please try again, and contact support if it keeps happening.</p>
      <div className="flex justify-center gap-2">
        <Button variant="primary" onClick={() => reset()}>Try again</Button>
        <Button onClick={() => { window.location.href = '/'; }}>Go to home</Button>
      </div>
    </main>
  );
}
