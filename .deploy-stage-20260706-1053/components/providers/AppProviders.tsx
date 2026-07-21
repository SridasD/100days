'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Wraps the app tree in client-side providers. Currently just the
 * NextAuth SessionProvider so any client component can call useSession()
 * to read the logged-in user's name / designation / role / sec_id.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
