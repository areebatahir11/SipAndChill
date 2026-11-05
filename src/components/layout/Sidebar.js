'use client';
import { ROUTE_ACCESS } from '@/lib/permissions/codes.mjs';
import { Button } from '@/components/ui';
import { useAuth } from './AuthProvider';
import NavLink from './NavLink';
import { signOut } from './sign-out';

export default function Sidebar() {
  const { user, tenant, role, can } = useAuth();

  return (
    <aside className="flex flex-col gap-5 bg-night px-4 pb-5 pt-6 text-sand md:sticky md:top-0 md:h-screen">
      <div className="px-1.5">
        <div className="flex items-center gap-2.5 text-[22px] font-bold">
          <span className="size-[18px] flex-none -rotate-45 rounded-[50%_50%_50%_0] bg-rose" />
          {tenant.name}
        </div>
        <small className="ml-7 text-[13px] text-taupe">Shop manager</small>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-slate p-3">
        <div className="grid size-10 flex-none place-items-center rounded-full bg-taupe font-bold text-night">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="leading-tight">
          <b className="block text-blush">{user.name}</b>
          <small>{role.name}</small>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {ROUTE_ACCESS.filter((n) => n.menu !== false && can(n.any)).map((n) => (
          <NavLink key={n.href} href={n.href} hint={n.hint}>{n.label}</NavLink>
        ))}
        <NavLink href="/account" hint="Change your password">My Account</NavLink>
      </nav>

      <Button variant="sidebar" onClick={signOut}>Log out</Button>
    </aside>
  );
}
