'use client';

/**
 * Officer-side Edit Indicator page.
 *
 * Renders the same <IndicatorForm /> used to create indicators, switched
 * into edit mode by passing both `projectId` and `indicatorId`. We resolve
 * the project_id from a lightweight GET on the indicator before rendering
 * the form so the same component can run its budget query and master-data
 * cascade against the right project.
 */
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { IndicatorForm } from '@/components/forms/IndicatorForm';

export default function OfficerEditIndicatorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const indicatorId = Number(id);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) {
      setError('Invalid indicator id');
      return;
    }
    let cancelled = false;
    fetch(`/api/officer/indicators/${indicatorId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ indicator: { projectId: number } }>;
      })
      .then((j) => {
        if (!cancelled) setProjectId(j.indicator.projectId);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load indicator');
      });
    return () => {
      cancelled = true;
    };
  }, [indicatorId]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader right={<OfficerUserMenu roleLabel="Nodal Officer" />} />

      <main className="container mx-auto flex-1 space-y-6 px-4 py-8">
        <div className="space-y-2">
          {projectId && (
            <Link
              href={`/officer/projects/${projectId}/indicators`}
              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-kerala-blue hover:underline"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to indicators
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Edit Indicator
          </h1>
          <p className="text-xs text-muted-foreground">
            Update master fields for the indicator. All fields available on the
            Add screen are editable here while the row remains pending
            verification.
          </p>
        </div>

        {error && (
          <Card className="border-error-red/30 bg-error-red/5">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-error-red">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </CardContent>
          </Card>
        )}

        {!projectId && !error && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading indicator…
          </div>
        )}

        {projectId && (
          <IndicatorForm projectId={projectId} indicatorId={indicatorId} />
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
