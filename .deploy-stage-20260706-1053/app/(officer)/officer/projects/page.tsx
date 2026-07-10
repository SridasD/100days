import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ProjectTable } from '@/components/tables/ProjectTable';
import { isSession, requireSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';

// Appendix C.1 — Nodal Officer "My Projects".
// URL: /officer/projects
// ProjectTable now fetches its data from GET /api/officer/projects.

export default async function OfficerProjectsPage() {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) redirect('/login');
  const session = sessionOrResponse;

  const roleId = Number(session.roleId ?? 0);
  if (roleId !== 2 && roleId !== 6) redirect('/login');

  const userName = String(session.userName ?? '');
  const roleLabel = roleId === 6 ? 'Head of Department' : 'Nodal Officer';
  // TODO: fetch real department label from master_secretary using session.secId
  const departmentLabel = userName.includes('Animal') ? 'Animal Husbandry' : '';

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

      <main className="container mx-auto flex-1 px-4 py-10">
        <div className="mb-8 space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            My Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Showing projects assigned to your department.
          </p>
        </div>

        <ProjectTable />
      </main>

      <SiteFooter />
    </div>
  );
}
