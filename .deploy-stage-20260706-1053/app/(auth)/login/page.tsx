import Link from 'next/link';
import { Suspense } from 'react';
import { Home } from 'lucide-react';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { LoginForm } from '@/components/forms/LoginForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Section 7.1 / Appendix B.1 — login screen. Shares KeralaHeader + SiteFooter
// with /officer/projects so the brand chrome stays consistent.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
        right={
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white outline-none ring-1 ring-white/15 transition-colors duration-200 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white"
          >
            <Home className="h-4 w-4" />
            HOME
          </Link>
        }
      />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border-t-4 border-t-[#2E7D32] shadow-md">
          <CardHeader className="space-y-2 text-center">
            <CardTitle className="text-2xl text-kerala-blue">
              Official Login
            </CardTitle>
            <CardDescription>
              <span className="block font-malayalam text-sm">
                ഔദ്യോഗിക ലോഗിൻ
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Sign in with your assigned officer credentials
              </span>
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Trouble signing in? Contact your department administrator.
            </p>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
