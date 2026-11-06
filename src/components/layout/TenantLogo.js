'use client';
import { useState } from 'react';

/** The business's own logo, or the pink drop when it has none (or the picture fails to load). */
export default function TenantLogo({ tenant }) {
  const [failed, setFailed] = useState(false);
  if (!tenant.logoVersion || failed) return <span className="size-[18px] flex-none -rotate-45 rounded-[50%_50%_50%_0] bg-rose" />;
  return (
    // No background: a transparent PNG stays transparent on the dark sidebar.
    <span className="grid size-10 flex-none place-items-center overflow-hidden">
      <img src={`/api/settings/logo?v=${tenant.logoVersion}`} alt={`${tenant.name} logo`} onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
    </span>
  );
}
