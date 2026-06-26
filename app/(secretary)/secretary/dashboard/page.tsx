'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, FolderOpen, Loader2, ShieldCheck, Users } from 'lucide-react';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ProjectTable } from '@/components/tables/ProjectTable';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type ProjectRow = {
  projectId: number;
  projectCode: string | null;
  projectName: string | null;
  projectCost: number;
  isCompleted: number;
  department: string | null;
  noDaysEmployedDirect: number;
  noPersonsEmployedDirect: number;
  noDaysEmployedIndirect: number;
  noPersonsEmployedIndirect: number;
  indicatorsTotal: number;
  indicatorsCompleted: number;
  totalAllocated: number;
  balance: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

export default function SecretaryDashboardPage() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/officer/projects', { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (!cancelled) setProjects((body.projects ?? []) as ProjectRow[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const rows = projects ?? [];
    return {
      totalProjects: rows.length,
      completedProjects: rows.filter((project) => project.isCompleted === 2).length,
      inProgressProjects: rows.filter((project) => project.isCompleted === 1).length,
      totalIndicators: rows.reduce((sum, project) => sum + (project.indicatorsTotal || 0), 0),
    };
  }, [projects]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
        homeHref="/secretary/dashboard"
        right={<OfficerUserMenu roleLabel="Secretary" />}
      />

      <main className="container mx-auto flex-1 px-4 py-8">
        <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-slate-50/80 shadow-sm">
          <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-kerala-blue" />
                Secretary Dashboard
              </div>
              <div className="max-w-3xl space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                  Department-level project overview and operational entry point.
                </h1>
                <p className="text-sm leading-6 text-muted-foreground lg:text-base">
                  Use this dashboard to review your department projects, track progress, and jump into the project console.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
              <div className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Live status</p>
                <p className="mt-2 text-sm font-medium text-foreground">Connected to officer project API</p>
              </div>
              <div className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data timestamp</p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {loading ? 'Loading...' : new Date().toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Total Projects" value={stats.totalProjects} description="Projects assigned to your department" icon={FolderOpen} />
          <MetricCard title="In Progress" value={stats.inProgressProjects} description="Active project records" icon={BarChart3} />
          <MetricCard title="Completed" value={stats.completedProjects} description="Fully completed projects" icon={ShieldCheck} />
          <MetricCard title="Indicators" value={stats.totalIndicators} description="Total indicator records" icon={Users} />
        </div>

        {error && (
          <Card className="mt-6 border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-3 py-8 text-sm text-destructive">
              <Loader2 className="h-5 w-5 animate-spin" />
              {error}
            </CardContent>
          </Card>
        )}

        <div className="mt-6">
          <ProjectTable />
        </div>

        {projects && projects.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border bg-background px-4 py-3 text-sm text-muted-foreground">
            <span>Displaying {formatNumber(projects.length)} projects for this secretary account.</span>
            <Badge variant="outline">Secretary scope</Badge>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{formatNumber(value)}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-2xl border border-kerala-blue/20 bg-kerala-blue/5 p-3 text-kerala-blue">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}