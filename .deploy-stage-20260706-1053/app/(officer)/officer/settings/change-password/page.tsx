import type { Metadata } from 'next';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

export const metadata: Metadata = {
  title: 'പാസ്‌വേഡ് മാറ്റുക | HDP Kerala',
};

// Nodal Officer (role_id = 2) change-password screen.
//   URL: /officer/settings/change-password
export default function OfficerChangePasswordPage() {
  return <ChangePasswordCard backHref="/officer/projects" />;
}
