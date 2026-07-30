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
          SELECT DISTINCT mp.project_id, COALESCE(mp.project_cost, 0) AS project_cost
          FROM hdp.project_department pd
          INNER JOIN hdp.project_secretary ps ON ps.project_id = pd.project_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          WHERE pd.dept_id = ${id}
            AND ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
        ),
        project_rollup AS (
          SELECT
            sp.project_id,
            sp.project_cost,
            COALESCE(AVG(COALESCE(i.verified_percentage, 0)), 0) AS project_physical_pct,
            COALESCE(SUM(COALESCE(i.verified_financial_achievement, 0)), 0) AS project_achievement,
            COUNT(i.indicator_id) AS indicator_count
          FROM scoped_projects sp
          LEFT JOIN hdp.indicators i ON i.project_id = sp.project_id
          GROUP BY sp.project_id, sp.project_cost
        )
        SELECT
          md.dept_id,
          COALESCE(md.dept_name, 'Unassigned') AS department,
          (SELECT COUNT(*) FROM scoped_projects)::int AS total_projects,
          (SELECT COALESCE(SUM(indicator_count), 0) FROM project_rollup)::int AS total_indicators,
          ROUND(COALESCE((SELECT AVG(project_physical_pct) FROM project_rollup), 0)::numeric, 1) AS physical_progress,
          CASE
            WHEN (SELECT SUM(project_cost) FILTER (WHERE project_cost > 0) FROM project_rollup) > 0
            THEN ROUND((
              (SELECT SUM(project_achievement) FILTER (WHERE project_cost > 0) FROM project_rollup)
              / (SELECT SUM(project_cost) FILTER (WHERE project_cost > 0) FROM project_rollup) * 100
            )::numeric, 1)
            ELSE 0
          END AS financial_progress,
          (SELECT COUNT(*)::int
            FROM hdp.gallery g
            INNER JOIN hdp.indicators i ON i.indicator_id = g.indicator_id
            INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
            WHERE g.gallery_type = 1 AND COALESCE(g.is_verified, false) = true
          ) AS images_uploaded,
          (SELECT COUNT(*)::int
            FROM hdp.gallery g
            INNER JOIN hdp.indicators i ON i.indicator_id = g.indicator_id
            INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
            WHERE g.gallery_type = 2 AND COALESCE(g.is_verified, false) = true
          ) AS videos_uploaded,
          (SELECT MAX(COALESCE(i.verified_date, i.submitted_date))
            FROM hdp.indicators i
            INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
          ) AS last_updated
        FROM hdp.master_department md
        WHERE md.dept_id = ${id}
      `),
        db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT
            mp.project_id,
            mp.public_id AS project_public_id,
            mp.project_code,
            mp.project_name,
            COALESCE(mp.is_completed, 0) AS is_completed,
            COALESCE(mp.project_cost, 0) AS project_cost
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
          sp.project_public_id,
          sp.project_code,
          sp.project_name,
          sp.is_completed,
          ROUND(COALESCE(AVG(COALESCE(i.verified_percentage, 0)), 0)::numeric, 1) AS physical_progress,
          CASE
            WHEN sp.project_cost > 0
            THEN ROUND((COALESCE(SUM(COALESCE(i.verified_financial_achievement, 0)), 0) / sp.project_cost * 100)::numeric, 1)
            ELSE 0
          END AS financial_progress,
          COALESCE(h.hod_names, 'Unassigned') AS assigned_hod,
          MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
        FROM scoped_projects sp
        LEFT JOIN hdp.indicators i ON i.project_id = sp.project_id
        LEFT JOIN hods h ON h.dept_id = ${id}
        GROUP BY sp.project_id, sp.project_public_id, sp.project_code, sp.project_name, sp.is_completed, sp.project_cost, COALESCE(h.hod_names, 'Unassigned')
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
          COALESCE(i.verified_percentage, 0) AS progress,
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
          projectPublicId: r.project_public_id ? String(r.project_public_id) : null,
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
