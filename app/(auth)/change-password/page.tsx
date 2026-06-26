import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { ROLE } from '@/lib/auth/session';

// The pre-existing /change-password placeholder used to be the only
// change-password URL. It now routes the user to their role-scoped page
// so anyone with a bookmarked link still lands in the right place.
export default async function LegacyRedirect() {
  const session = await auth();
  const roleId = (session?.user as { roleId?: number } | undefined)?.roleId;

  if (roleId === ROLE.VERIFICATION_OFFICER) {
    redirect('/verify/settings/change-password');
  }
  if (roleId === ROLE.ADMIN) {
    redirect('/admin/settings/change-password');
  }
  if (roleId === 5) {
    redirect('/secretary/settings/change-password');
  }
  // Nodal officer (role 2) or unknown — default to officer.
  redirect('/officer/settings/change-password');
}
