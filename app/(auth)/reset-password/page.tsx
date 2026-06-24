import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default function ResetPasswordPage() {
  return (
    <PagePlaceholder
      title="Reset Password"
      route="/reset-password"
      section="Section 5.2 — Password Reset Flow A"
      description="Token + new password form. Validate token (exists, not used, not expired), bcrypt(12) hash, mark token used, blocklist existing JWTs."
    />
  );
}
