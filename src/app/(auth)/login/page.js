import { redirect } from 'next/navigation';
import LoginForm from '@/features/auth/LoginForm';
import { getAuth } from '@/lib/auth/guard';
import { homeFor } from '@/lib/permissions/codes.mjs';

export default async function LoginPage() {
  const auth = await getAuth();
  if (auth) redirect(homeFor(auth.permissions));
  return <LoginForm />;
}
