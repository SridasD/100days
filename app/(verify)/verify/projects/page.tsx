'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, FolderOpen } from 'lucide-react';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface VerifierProject {
  projectId: number;
  projectPublicId: string | null;
  projectCode: string | null;
  projectName: string;
  department: string;
  indicatorsPending: number;
  indicatorsVerified: number;
  indicatorsTotal: number;
}

export default function VerifyProjectsPage() {
  const [projects, setProjects] = useState<VerifierProject[] | null>(null);
  const [departmentLabel, setDepartmentLabel] = useState('Verifying');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/verify/projects', { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as {
          projects: VerifierProject[];
          scope?: { departmentLabel?: string };
        };
        setProjects(json.projects);
        if (json.scope?.departmentLabel) {
          setDepartmentLabel(json.scope.departmentLabel);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const roleLabel = 'Verification Officer';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
        homeHref="/verify/projects"
        right={
          <OfficerUserMenu
            roleLabel={roleLabel}
            departmentLabel={departmentLabel}
          />
        }
      />

      <main className="container mx-auto flex-1 px-4 py-10">
        <div className="mb-8 space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Verification Queue
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and approve indicator progress submissions from nodal officers.
          </p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="border-error-red/30 bg-error-red/5">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertTriangle className="h-6 w-6 text-error-red" />
              <div>
                <p className="text-sm font-semibold text-error-red">
                  Failed to load projects
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (!projects || projects.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <FolderOpen className="h-7 w-7 text-muted-foreground" />
              <div>
                <p className="text-base font-semibold text-foreground">
                  No projects to verify
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check back later for submissions from nodal officers.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && projects && projects.length > 0 && (
          <div className="grid gap-4">
            {projects.map((p) => (
              <Card
                key={p.projectId}
                className="overflow-hidden border-l-4 border-l-kerala-blue shadow-sm transition-all duration-200 hover:shadow-md"
              >
                <CardContent className="p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-kerala-blue">
                        {p.projectName}
                      </h3>
                      {p.projectCode && (
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Code: {p.projectCode}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {p.department}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.indicatorsPending > 0 && (
                        <Badge className="flex items-center gap-1.5 bg-warning-amber/90 text-white hover:bg-warning-amber">
                          <Clock className="h-3 w-3" />
                          {p.indicatorsPending} Pending
                        </Badge>
                      )}
                      {p.indicatorsVerified > 0 && (
                        <Badge className="flex items-center gap-1.5 bg-success-green/90 text-white hover:bg-success-green">
                          <CheckCircle2 className="h-3 w-3" />
                          {p.indicatorsVerified} Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {p.indicatorsTotal} total indicators
                    </p>
                    <Button
                      asChild
                      size="sm"
                      className="cursor-pointer"
                    >
                      <Link href={`/verify/projects/${p.projectPublicId ?? p.projectId}`}>
                        Review Indicators
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
