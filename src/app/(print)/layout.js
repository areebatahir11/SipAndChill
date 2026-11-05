import { requirePage } from '@/lib/auth/guard';

/** Print pages have no sidebar. They still require a signed-in user; each page adds its own permission check. */
export default async function PrintLayout({ children }) {
  await requirePage();
  return children;
}
