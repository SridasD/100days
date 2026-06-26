import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { ProjectTable } from '@/components/tables/ProjectTable';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getToken } from 'next-auth/jwt';

// Appendix C.1 — Nodal Officer "My Projects".
// URL: /officer/projects
// ProjectTable now fetches its data from GET /api/officer/projects.

export default async function OfficerProjectsPage() {
  const hdrs = await headers();
  const token = await getToken({
    req: {
      headers: {
        cookie: hdrs.get('cookie') ?? '',
      },
    } as any,
    secret: process.env.AUTH_SECRET,
  });
  if (!token) redirect('/login');

  const roleId = Number(token.roleId ?? 0);
  if (roleId !== 2) redirect('/login');

  const userName = String(token.userName ?? token.name ?? '');
  const roleLabel = 'Nodal Officer';
  // TODO: fetch real department label from master_secretary using session.secId
  const departmentLabel = userName.includes('Animal') ? 'Animal Husbandry' : '';

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
