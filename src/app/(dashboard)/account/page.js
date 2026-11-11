import { requirePage } from '@/lib/auth/guard';
import ChangePasswordForm from '@/features/account/ChangePasswordForm';
import ProfileNameCard from '@/features/account/ProfileNameCard';

export default async function AccountPage() {
  await requirePage(); // any signed-in user
  return <ChangePasswordForm before={<ProfileNameCard />} />;
}
