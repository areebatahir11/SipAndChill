'use client';
import { Button } from '@/components/ui';
import NavLink from './NavLink';
import { signOut } from './sign-out';

/** Navigation shell for the PearlSolutions area. Same look as the business sidebar. */
export default function PlatformSidebar({ user }) {
  return (
    <aside className="flex flex-col gap-5 bg-night px-4 pb-5 pt-6 text-sand md:sticky md:top-0 md:h-screen">
      <div className="px-1.5 text-center">
        {/* Dark-background version of the PearlSolutions logo (transparent PNG). */}
        <img src="/brand/pearl-logo-dark.png" alt="PearlSolutions" width={720} height={484} className="mx-auto block h-auto w-[150px]" />
        <small className="text-[13px] text-taupe">Platform admin</small>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-slate p-3">
        <div className="grid size-10 flex-none place-items-center rounded-full bg-taupe font-bold text-night">
          {user.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 leading-tight">
          <b className="block truncate text-blush">{user.name}</b>
          <small>Super admin</small>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <NavLink href="/platform" hint="Earnings and who needs to pay">Overview</NavLink>
        <NavLink href="/platform/clients" exact={false} hint="Shops using your software">My Clients</NavLink>
        <NavLink href="/platform/account" hint="Change your password">My Account</NavLink>
      </nav>

      <Button variant="sidebar" onClick={signOut}>Log out</Button>
    </aside>
  );
}
