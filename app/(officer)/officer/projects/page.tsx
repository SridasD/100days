import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ProjectTable } from '@/components/tables/ProjectTable';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// Appendix C.1 — Nodal Officer "My Projects".
// URL: /officer/projects
// ProjectTable now fetches its data from GET /api/officer/projects.

export default async function OfficerProjectsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as { name?: string | null; roleId: number };
  const roleLabel = 'Nodal Officer';
  // TODO: fetch real department label from master_secretary using session.secId
  const departmentLabel = user.name?.includes('Animal') ? 'Animal Husbandry' : '';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
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
