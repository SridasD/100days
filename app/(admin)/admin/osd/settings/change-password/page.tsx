import type { Metadata } from 'next';
import { ChangePasswordCard } from '@/components/auth/ChangePasswordCard';

export const metadata: Metadata = {
    title: 'പാസ്‌വേഡ് മാറ്റുക | HDP Kerala',
};

// OSD Admin (role_id = 4) change-password screen.
//   URL: /admin/osd/settings/change-password
export default function OSDAdminChangePasswordPage() {
    return <ChangePasswordCard backHref="/admin/osd/dashboard" />;
}