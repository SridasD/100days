'use client';

/**
 * Visual shell around <ChangePasswordForm /> so each role's page is a
 * one-liner. Card title, lock icon, subtitle and "back to settings" link
 * live here; the role's settings URL is the only thing each page passes.
 */
import Link from 'next/link';
import { ArrowLeft, KeyRound } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ChangePasswordForm } from './ChangePasswordForm';

export function ChangePasswordCard({
  /** Where the "back to settings" link should point for this role. */
  backHref,
}: {
  backHref: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8 sm:py-12">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-[#2D6A4F] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="font-malayalam">ക്രമീകരണങ്ങളിലേക്ക് മടങ്ങുക</span>
      </Link>

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#D8F3DC] text-[#2D6A4F]">
              <KeyRound className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <CardTitle className="font-malayalam text-base">
                പാസ്‌വേഡ് മാറ്റുക
              </CardTitle>
              <CardDescription className="font-malayalam text-xs">
                സുരക്ഷക്കായി ശക്തമായ പാസ്‌വേഡ് ഉപയോഗിക്കുക
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
