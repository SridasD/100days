import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ProfilePage } from '@/components/public/ProfilePage';

export const metadata: Metadata = {
  title: 'പ്രൊഫൈൽ | HDP Kerala',
};

export default async function ProfileRoutePage() {
  const session = await auth();
  if (!session) {
    redirect('/login');
  }

  const roleId = Number((session.user as { roleId?: number } | undefined)?.roleId ?? 0);

  return <ProfilePage homeHref={resolveHomeHref(roleId)} />;
}

function resolveHomeHref(roleId: number): string {
  if (roleId === 4) return '/admin/osd/dashboard';
  if (roleId === 3) return '/admin/dashboard';
  if (roleId === 1) return '/verify/projects';
  if (roleId === 2 || roleId === 6) return '/officer/projects';
  return '/';
}