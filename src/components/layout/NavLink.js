'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/** Sidebar link. `hint` is a small plain-words line under the label. `exact` (default) highlights only the exact path. */
export default function NavLink({ href, children, hint, exact = true }) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`flex flex-col rounded-xl px-3.5 py-2 leading-tight transition-colors ${
        active ? 'bg-sand font-semibold text-night' : 'text-sand hover:bg-slate'
      }`}
    >
      {children}
      {hint && <small className={`font-normal ${active ? 'text-slate' : 'text-taupe'}`}>{hint}</small>}
    </Link>
  );
}
