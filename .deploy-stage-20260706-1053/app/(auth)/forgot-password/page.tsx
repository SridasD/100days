import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default function ForgotPasswordPage() {
  return (
    <PagePlaceholder
      title="Forgot Password"
      route="/forgot-password"
      section="Section 7.2 — Forgot Password (Flow A self-service)"
      description="Login Name + Registered Mobile. On match: generate token, store in password_reset_tokens, SMS the token. Token entry + new password (complexity rules)."
    />
  );
}
