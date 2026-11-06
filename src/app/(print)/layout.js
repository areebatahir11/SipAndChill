import { redirect } from 'next/navigation';
import { requirePage } from '@/lib/auth/guard';

/**
 * Print pages have no sidebar. They still require a signed-in user; each page adds its own permission check.
 * A user who still has a temporary password is sent back to "/", where the dashboard layout asks for a new one
 * (the APIs already refuse them; this closes the same gap for these pages). The same goes for an owner who has not
 * accepted the Terms & Conditions yet.
 */
export default async function PrintLayout({ children }) {
  const auth = await requirePage();
  if (auth.mustChangePassword || auth.termsRequired) redirect('/');
  return children;
}
