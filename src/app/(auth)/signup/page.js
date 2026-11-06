import { redirect } from 'next/navigation';
import SignupForm from '@/features/auth/SignupForm';
import { getAuth } from '@/lib/auth/guard';
import { getPlatformAuth } from '@/lib/auth/platform-guard';
import { homeFor } from '@/lib/permissions/codes.mjs';
import { SIGNUP_MODES, getSignupMode } from '@/lib/auth/signup-policy.mjs';

export default async function SignupPage() {
  if (getSignupMode() === SIGNUP_MODES.INVITE_ONLY) redirect('/login'); // public signup is closed
  if (await getPlatformAuth()) redirect('/platform');
  const auth = await getAuth();
  if (auth) redirect(homeFor(auth.permissions));
  return <SignupForm />;
}
