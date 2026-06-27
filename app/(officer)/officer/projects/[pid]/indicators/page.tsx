import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CalendarDays,
  IndianRupee,
  Plus,
  Target,
  Users,
} from 'lucide-react';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { IndicatorTable } from '@/components/tables/IndicatorTable';
import { isSession, requireSession } from '@/lib/auth/session';
import { getOfficerProject } from '@/lib/db/queries/officer';
import { db } from '@/lib/db/client';
import { resolveProjectId } from '@/lib/db/public-id';
import { sql } from 'drizzle-orm';

// Appendix C.2 + C.3 — server component fetches the project banner via
// Drizzle directly; IndicatorTable then fetches indicators client-side from
// GET /api/officer/projects/[pid]/indicators.

interface PageProps {
  params: Promise<{ pid: string }>;
}

export default async function OfficerProjectIndicatorsPage({
  params,
}: PageProps) {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) redirect('/login');
  const session = sessionOrResponse;

  const secId = Number(session.secId ?? 0);
  let deptId = Number(session.deptId ?? 0);
  const roleId = Number(session.roleId ?? 0);
  if (roleId !== 2 && roleId !== 6) {
    redirect('/login');
  }

  if (roleId === 6 && (!Number.isFinite(deptId) || deptId <= 0)) {
    const userId = Number(session.userId ?? 0);
    if (Number.isFinite(userId) && userId > 0) {
      const r = await db.execute(sql`
        SELECT dept_id
        FROM hdp.user_details
        WHERE user_id = ${userId}
        LIMIT 1
      `);
      deptId =
        Number(
          (r.rows[0] as { dept_id: number | string | null } | undefined)
            ?.dept_id ?? 0,
        ) || 0;
    }
  }

  const { pid } = await params;
  const projectIdNum = await resolveProjectId(pid);
  if (!projectIdNum) {
    redirect('/officer/projects');
  }

  const project = await getOfficerProject(projectIdNum, {
    roleId,
    secId: Number.isFinite(secId) ? secId : 0,
    deptId: Number.isFinite(deptId) ? deptId : 0,
  });
  if (!project) {
    redirect('/officer/projects');
  }

  if (project.public_id && pid !== project.public_id) {
    redirect(`/officer/projects/${project.public_id}/indicators`);
  }

  const roleLabel = roleId === 6 ? 'Head of Department' : 'Nodal Officer';
  const departmentLabel = project.department ?? '—';

  const statusLabel =
    project.is_completed === 2
      ? 'Completed'
      : project.is_completed === 1
        ? 'In Progress'
        : 'Not Started';
  const statusTone =
    project.is_completed === 2
      ? 'success'
      : project.is_completed === 1
        ? 'warning'
        : 'neutral';

  const pctDone =
    project.indicators_total > 0
      ? Math.round(
        (project.indicators_completed / project.indicators_total) * 100,
      )
      : 0;

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
            href="/officer/projects"
            aria-label="Back to project details"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Project Details
          </Link>
        </Button>

        <Card className="mb-8 overflow-hidden border-l-4 border-l-[#2E7D32] shadow-sm">
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-kerala-blue">
                    {project.project_name ?? '—'}
                  </h2>
                  {project.project_code && (
                    <Badge variant="info" className="font-mono">
                      {project.project_code}
                    </Badge>
                  )}
                  {project.project_name_mal && (
                    <Badge variant="neutral" className="font-malayalam">
                      {project.project_name_mal}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Department:{' '}
                  <span className="font-medium text-foreground">
                    {project.department ?? '—'}
                  </span>
                </p>
              </div>
              <Badge variant={statusTone}>{statusLabel}</Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success" className="px-3 py-1 font-mono">
                <IndianRupee className="h-3.5 w-3.5" aria-hidden />
                {Number(project.project_cost ?? 0).toFixed(2)} Lakhs
              </Badge>
              <Badge variant="success" className="px-3 py-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                <span>
                  <span className="font-semibold">Direct:</span>{' '}
                  {project.no_days_employed_direct ?? 0} days
                  <span className="px-1 opacity-60">·</span>
                  <Users className="-mt-px mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {project.no_persons_employed_direct ?? 0} persons
                </span>
              </Badge>
              <Badge variant="success" className="px-3 py-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                <span>
                  <span className="font-semibold">Indirect:</span>{' '}
                  {project.no_days_employed_indirect ?? 0} days
                  <span className="px-1 opacity-60">·</span>
                  <Users className="-mt-px mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {project.no_persons_employed_indirect ?? 0} persons
                </span>
              </Badge>
              <Badge variant="success" className="px-3 py-1">
                <Target className="h-3.5 w-3.5" aria-hidden />
                <span>
                  <span className="font-semibold">
                    {project.indicators_completed} /{' '}
                    {project.indicators_total}
                  </span>{' '}
                  indicators completed
                  <span className="ml-1.5 font-mono text-[11px] opacity-70">
                    ({pctDone}%)
                  </span>
                </span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Indicator Details
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track and update progress for each indicator in this project.
            </p>
          </div>
          <Button
            asChild
            className="cursor-pointer bg-[#2E7D32] text-white shadow-sm transition-all duration-200 hover:bg-[#256328] hover:shadow"
          >
            <Link href={`/officer/indicators/new?projectId=${projectIdNum}`}>
              <Plus className="h-4 w-4" aria-hidden />
              Add New Indicator
            </Link>
          </Button>
        </div>

        <IndicatorTable
          projectId={project.public_id ?? pid}
          projectTargets={{
            projectName: project.project_name ?? '',
            directDays: project.no_days_employed_direct ?? 0,
            directPersons: project.no_persons_employed_direct ?? 0,
            indirectDays: project.no_days_employed_indirect ?? 0,
            indirectPersons: project.no_persons_employed_indirect ?? 0,
          }}
        />
      </main>

      <SiteFooter />
    </div>
  );
}
