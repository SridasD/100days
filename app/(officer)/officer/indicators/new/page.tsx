'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IndicatorForm } from '@/components/forms/IndicatorForm';

// Section 7.4 / Appendix C.2 — Nodal Officer "Add New Indicator" form.
// URL: /officer/indicators/new?projectId=<n>
// Reached from IndicatorTable's empty state and the "Add New Indicator" CTA.

function OfficerNewIndicatorPageContent() {
  const params = useSearchParams();
  const projectId = String(params.get('projectId') ?? '').trim();
  const valid = projectId.length > 0;

  // TODO: derive from session
  const roleLabel = 'Nodal Officer';
  const departmentLabel = 'Animal Husbandry';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
        homeHref="/officer/projects"
        right={
          <OfficerUserMenu
            roleLabel={roleLabel}
            departmentLabel={departmentLabel}
          />
        }
      />

      <main className="container mx-auto flex-1 px-4 py-8">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mb-6 cursor-pointer rounded-full border-[#2E7D32] text-[#2E7D32] transition-colors duration-200 hover:bg-[#2E7D32] hover:text-white"
        >
          <Link
            href={
              valid
                ? `/officer/projects/${projectId}/indicators`
                : '/officer/projects'
            }
            aria-label="Back to indicators"
          >
            <ArrowLeft className="h-4 w-4" />
            {valid ? 'Back to Indicator Details' : 'Back to Projects'}
          </Link>
        </Button>

        <div className="mb-6 border-l-4 border-[#2E7D32] pl-4">
          <h1 className="text-2xl font-bold uppercase tracking-wide text-foreground">
            Add New Indicator
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define a measurable indicator under this project. You can record
            progress and upload evidence after saving.
          </p>
        </div>

        {!valid ? (
          <Card className="border-error-red/30 bg-error-red/5">
            <CardContent className="flex items-start gap-3 py-6">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error-red" />
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-error-red">
                  Missing or invalid project ID
                </p>
                <p className="text-muted-foreground">
                  Indicators must be created from inside a project. Open the
                  project from{' '}
                  <Link
                    href="/officer/projects"
                    className="font-medium text-kerala-blue underline-offset-2 hover:underline"
                  >
                    My Projects
                  </Link>{' '}
                  and use the &quot;Add New Indicator&quot; button.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <IndicatorForm projectId={projectId} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export default function OfficerNewIndicatorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-background">
          <main className="container mx-auto flex-1 px-4 py-8">
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">Loading indicator form...</CardContent>
            </Card>
          </main>
        </div>
      }
    >
      <OfficerNewIndicatorPageContent />
    </Suspense>
  );
}
