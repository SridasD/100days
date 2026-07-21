import type { Metadata } from 'next';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

export const metadata: Metadata = {
  title: 'പാസ്‌വേഡ് മാറ്റുക | HDP Kerala',
};

// Secretary (role_id = 5) change-password screen.
//   URL: /secretary/settings/change-password
export default function SecretaryChangePasswordPage() {
  return <ChangePasswordCard backHref="/secretary/dashboard" />;
}