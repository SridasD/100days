import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  isAdminSession,
  requireOsdAdminSession,
} from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireOsdAdminSession(req);
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const [statsResult, departmentResult] = await Promise.all([
      db.execute(sql`
        WITH department_summary AS (
          SELECT ms.sec_id
          FROM hdp.master_secretary ms
          LEFT JOIN hdp.project_secretary ps ON ps.sec_id = ms.sec_id
          LEFT JOIN hdp.master_projects mp ON mp.project_id = ps.project_id
            AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
          WHERE ms.is_used = true
          GROUP BY ms.sec_id
          HAVING COUNT(DISTINCT mp.project_id) > 0
        )
        SELECT
          (SELECT COUNT(*)::int FROM department_summary) AS total_departments,
          COUNT(DISTINCT mp.project_id)::int AS total_projects,
          COUNT(DISTINCT CASE WHEN mp.is_completed = 2 THEN mp.project_id END)::int AS completed_projects,
          COUNT(DISTINCT CASE WHEN mp.is_completed = 1 THEN mp.project_id END)::int AS in_progress_projects
        FROM hdp.master_projects mp
        WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
      `),
      db.execute(sql`
        SELECT
          ms.sec_id,
          ms.public_id,
          COALESCE(ms.secretary_name, 'Unassigned') AS department_name,
          COUNT(DISTINCT mp.project_id)::int AS project_count,
          COUNT(DISTINCT i.indicator_id)::int AS indicator_count,
          MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
        FROM hdp.master_secretary ms
        LEFT JOIN hdp.project_secretary ps ON ps.sec_id = ms.sec_id
        LEFT JOIN hdp.master_projects mp ON mp.project_id = ps.project_id
          AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
        LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
        WHERE ms.is_used = true
        GROUP BY ms.sec_id, COALESCE(ms.secretary_name, 'Unassigned')
        HAVING COUNT(DISTINCT mp.project_id) > 0
        ORDER BY department_name ASC
      `),
    ]);

    const stats =
      (statsResult.rows[0] as Record<string, number | null> | undefined) ?? {};

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats: {
        totalDepartments: Number(stats.total_departments) || 0,
        totalProjects: Number(stats.total_projects) || 0,
        completedProjects: Number(stats.completed_projects) || 0,
        inProgressProjects: Number(stats.in_progress_projects) || 0,
      },
      departments: departmentResult.rows.map((row) => {
        const item = row as {
          sec_id: number;
          public_id: string | null;
          department_name: string;
          project_count: number;
          indicator_count: number;
          last_updated: string | null;
        };
        return {
          secId: Number(item.sec_id),
          departmentPublicId: item.public_id ? String(item.public_id) : null,
          departmentName: item.department_name,
          projectCount: Number(item.project_count) || 0,
          indicatorCount: Number(item.indicator_count) || 0,
          lastUpdated: item.last_updated,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/admin/osd/summary failed", err);
    return NextResponse.json(
      { error: "Failed to load OSD summary" },
      { status: 500 },
    );
  }
}
