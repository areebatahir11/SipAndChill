import { redirect } from 'next/navigation';
import SignupForm from '@/features/auth/SignupForm';
import { getAuth } from '@/lib/auth/guard';
import { getPlatformAuth } from '@/lib/auth/platform-guard';
import { homeFor } from '@/lib/permissions/codes.mjs';

export default async function SignupPage() {
  if (await getPlatformAuth()) redirect('/platform');
  const auth = await getAuth();
  if (auth) redirect(homeFor(auth.permissions));
  return <SignupForm />;
}
