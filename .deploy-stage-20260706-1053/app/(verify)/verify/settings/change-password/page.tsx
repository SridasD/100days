import type { Metadata } from 'next';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

export const metadata: Metadata = {
  title: 'പാസ്‌വേഡ് മാറ്റുക | HDP Kerala',
};

// Verification Officer (role_id = 1) change-password screen.
//   URL: /verify/settings/change-password
export default function VerifyChangePasswordPage() {
  return <ChangePasswordCard backHref="/verify/projects" />;
}
