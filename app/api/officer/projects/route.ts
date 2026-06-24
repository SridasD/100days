import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { isSession, requireOfficerSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { listOfficerProjects } from '@/lib/db/queries/officer';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  try {
    // Resolve scope label for the header chrome.
    let departmentLabel: string | null = null;
    if (session.secId > 0) {
      const r = await db.execute(sql`
        SELECT secretary_name
        FROM hdp.master_secretary
        WHERE sec_id = ${session.secId}
        LIMIT 1
      `);
      departmentLabel =
        (r.rows[0] as { secretary_name: string | null } | undefined)
          ?.secretary_name ?? null;
    }

    const rows = await listOfficerProjects(session.secId);
    return NextResponse.json({
      scope: {
        secId: session.secId,
        departmentLabel,
      },
      projects: rows.map((r) => {
        const cost = r.project_cost ? Number(r.project_cost) : 0;
        const allocated = r.total_allocated ? Number(r.total_allocated) : 0;
        return {
          projectId: r.project_id,
          projectCode: r.project_code,
          projectName: r.project_name,
          projectNameMal: r.project_name_mal,
          projectCost: cost,
          isCompleted: r.is_completed ?? 0,
          department: r.department,
          noDaysEmployedDirect: r.no_days_employed_direct ?? 0,
          noPersonsEmployedDirect: r.no_persons_employed_direct ?? 0,
          noDaysEmployedIndirect: r.no_days_employed_indirect ?? 0,
          noPersonsEmployedIndirect: r.no_persons_employed_indirect ?? 0,
          indicatorsTotal: r.indicators_total,
          indicatorsCompleted: r.indicators_completed,
          totalAllocated: allocated,
          balance: cost - allocated,
        };
      }),
    });
  } catch (err) {
    console.error('GET /api/officer/projects failed', err);
    return NextResponse.json(
      { error: 'Failed to load projects' },
      { status: 500 },
    );
  }
}
