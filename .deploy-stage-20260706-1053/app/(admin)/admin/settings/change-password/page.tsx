import type { Metadata } from 'next';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

export const metadata: Metadata = {
  title: 'പാസ്‌വേഡ് മാറ്റുക | HDP Kerala',
};

// Admin (role_id = 3) change-password screen.
//   URL: /admin/settings/change-password
export default function AdminChangePasswordPage() {
  return <ChangePasswordCard backHref="/admin/dashboard" />;
}
