import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { resolveDepartmentId } from "@/lib/db/public-id";

export const runtime = "nodejs";

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ deptId: string }> },
) {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  if (session.roleId !== ROLE.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { deptId } = await params;
  const id = await resolveDepartmentId(deptId);
  if (!id) {
    return NextResponse.json({ error: "Invalid deptId" }, { status: 400 });
  }

  try {
    const scopeResult = await db.execute(sql`
      SELECT 1
      FROM hdp.project_department pd
      INNER JOIN hdp.project_secretary ps ON ps.project_id = pd.project_id
      INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
      WHERE pd.dept_id = ${id}
        AND ps.sec_id = ${session.secId}
        AND COALESCE(mp.is_archived, false) = false
      LIMIT 1
    `);

    if (scopeResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Department not in secretary scope" },
        { status: 404 },
      );
    }

    const [summaryResult, projectsResult, indicatorsResult] = await Promise.all(
      [
        db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT mp.project_id
          FROM hdp.project_department pd
          INNER JOIN hdp.project_secretary ps ON ps.project_id = pd.project_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          WHERE pd.dept_id = ${id}
            AND ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
        )
        SELECT
          md.dept_id,
          COALESCE(md.dept_name, 'Unassigned') AS department,
          COUNT(DISTINCT sp.project_id)::int AS total_projects,
          COUNT(i.indicator_id)::int AS total_indicators,
          COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
          COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
          COUNT(g.gallery_id) FILTER (WHERE g.gallery_type = 1)::int AS images_uploaded,
          COUNT(g.gallery_id) FILTER (WHERE g.gallery_type = 2)::int AS videos_uploaded,
          MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
        FROM hdp.master_department md
        LEFT JOIN scoped_projects sp ON true
        LEFT JOIN hdp.indicators i ON i.project_id = sp.project_id
        LEFT JOIN hdp.gallery g ON g.indicator_id = i.indicator_id
        WHERE md.dept_id = ${id}
        GROUP BY md.dept_id, COALESCE(md.dept_name, 'Unassigned')
      `),
        db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT
            mp.project_id,
            mp.project_code,
            mp.project_name,
            COALESCE(mp.is_completed, 0) AS is_completed
          FROM hdp.project_department pd
          INNER JOIN hdp.project_secretary ps ON ps.project_id = pd.project_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          WHERE pd.dept_id = ${id}
            AND ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
        ),
        hods AS (
          SELECT
            ud.dept_id,
            STRING_AGG(ud.user_name, ', ' ORDER BY ud.user_name) AS hod_names
          FROM hdp.user_details ud
          WHERE ud.role_id = 6
            AND ud.status = 1
            AND ud.dept_id = ${id}
          GROUP BY ud.dept_id
        )
        SELECT
          sp.project_id,
          sp.project_code,
          sp.project_name,
          sp.is_completed,
          COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
          COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
          COALESCE(h.hod_names, 'Unassigned') AS assigned_hod,
          MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
        FROM scoped_projects sp
        LEFT JOIN hdp.indicators i ON i.project_id = sp.project_id
        LEFT JOIN hods h ON h.dept_id = ${id}
        GROUP BY sp.project_id, sp.project_code, sp.project_name, sp.is_completed, COALESCE(h.hod_names, 'Unassigned')
        ORDER BY sp.project_name ASC
      `),
        db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT mp.project_id
          FROM hdp.project_department pd
          INNER JOIN hdp.project_secretary ps ON ps.project_id = pd.project_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          WHERE pd.dept_id = ${id}
            AND ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
        )
        SELECT
          i.indicator_id,
          COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
          mp.project_code,
          COALESCE(mp.project_name, 'Untitled project') AS project_name,
          COALESCE(i.verified_percentage, i.percentage, 0) AS progress,
          COALESCE(i.verified_date, i.submitted_date) AS last_updated,
          (
            SELECT COUNT(*)::int
            FROM hdp.gallery g
            WHERE g.indicator_id = i.indicator_id
              AND g.gallery_type = 1
          ) AS images_count,
          (
            SELECT COUNT(*)::int
            FROM hdp.gallery g
            WHERE g.indicator_id = i.indicator_id
              AND g.gallery_type = 2
          ) AS videos_count
        FROM hdp.indicators i
        INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
        LEFT JOIN hdp.master_projects mp ON mp.project_id = i.project_id
        ORDER BY i.indicator_name ASC
      `),
      ],
    );

    const summaryRow = (summaryResult.rows[0] as Record<string, unknown>) ?? {};

    return NextResponse.json({
      summary: {
        deptId: toNum(summaryRow.dept_id),
        department: String(summaryRow.department ?? "Unassigned"),
        totalProjects: toNum(summaryRow.total_projects),
        totalIndicators: toNum(summaryRow.total_indicators),
        physicalProgress: toNum(summaryRow.physical_progress),
        financialProgress: toNum(summaryRow.financial_progress),
        imagesUploaded: toNum(summaryRow.images_uploaded),
        videosUploaded: toNum(summaryRow.videos_uploaded),
        lastUpdated: summaryRow.last_updated ?? null,
      },
      projects: projectsResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          projectId: toNum(r.project_id),
          projectCode: String(r.project_code ?? "-"),
          projectName: String(r.project_name ?? "Untitled project"),
          status:
            toNum(r.is_completed) === 2
              ? "completed"
              : toNum(r.is_completed) === 1
                ? "in-progress"
                : "not-started",
          physicalProgress: toNum(r.physical_progress),
          financialProgress: toNum(r.financial_progress),
          assignedHod: String(r.assigned_hod ?? "Unassigned"),
          lastUpdated: r.last_updated ?? null,
        };
      }),
      indicators: indicatorsResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          indicatorId: toNum(r.indicator_id),
          indicatorName: String(r.indicator_name ?? "Untitled indicator"),
          projectCode: String(r.project_code ?? "-"),
          projectName: String(r.project_name ?? "Untitled project"),
          progress: toNum(r.progress),
          imagesCount: toNum(r.images_count),
          videosCount: toNum(r.videos_count),
          lastUpdated: r.last_updated ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/secretary/departments/[deptId] failed", err);
    return NextResponse.json(
      { error: "Failed to load department details" },
      { status: 500 },
    );
  }
}
