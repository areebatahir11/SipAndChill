'use client';
import { useState } from 'react';

/**
 * The business's own logo, shown whole on a soft light card (most logos are dark/coloured and vanish on the dark sidebar, and
 * the little taglines under a logo must stay readable). With no logo, or if the picture fails to load, the name is shown as text.
 */
export default function TenantLogo({ tenant }) {
  const [failed, setFailed] = useState(false);
  if (!tenant.logoVersion || failed) {
    return (
      <div className="flex items-center gap-2.5 text-[22px] font-bold tracking-tight">
        <span className="size-[18px] flex-none -rotate-45 rounded-[50%_50%_50%_0] bg-rose" />
        {tenant.name}
      </div>
    );
  }
  return (
    <div className="grid place-items-center rounded-2xl bg-blush px-4 py-3 shadow-inner">
      <img src={`/api/settings/logo?v=${tenant.logoVersion}`} alt={`${tenant.name} logo`} onError={() => setFailed(true)} className="h-auto max-h-24 w-full object-contain" />
    </div>
  );
}
