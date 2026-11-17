'use client';
import { useState } from 'react';

/** Small "Copy" button for account numbers: one tap instead of retyping a 24-character IBAN. */
export default function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard blocked: the number is still on screen */ }
  };
  return (
    <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="cursor-pointer rounded-lg border border-peach px-2.5 py-0.5 text-[12.5px] font-medium text-night transition-colors hover:bg-blush">
      {done ? 'Copied ✓' : 'Copy'}
    </button>
  );
}
