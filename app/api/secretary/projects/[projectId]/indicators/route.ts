import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { resolveProjectId } from "@/lib/db/public-id";

export const runtime = "nodejs";

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireSession(req);
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  if (session.roleId !== ROLE.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  try {
    const [projectResult, indicatorsResult] = await Promise.all([
      db.execute(sql`
        SELECT
          mp.project_id,
          mp.project_code,
          COALESCE(mp.project_name, 'Untitled project') AS project_name,
          COALESCE(mp.is_completed, 0) AS is_completed,
          COALESCE(
            (
              SELECT STRING_AGG(DISTINCT md.dept_name, ', ' ORDER BY md.dept_name)
              FROM hdp.project_department pd
              LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
              WHERE pd.project_id = mp.project_id
            ),
            'Unassigned'
          ) AS department_names,
          COALESCE(ms.sector_name, 'Unassigned') AS sector_name,
          COALESCE(
            (
              SELECT STRING_AGG(DISTINCT d.district_name, ', ' ORDER BY d.district_name)
              FROM hdp.indicators i2
              LEFT JOIN hdp.master_district d ON d.district_id = i2.district_id
              WHERE i2.project_id = mp.project_id
            ),
            '-'
          ) AS district_names
        FROM hdp.master_projects mp
        INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
        LEFT JOIN hdp.master_sector ms ON ms.sector_id = mp.sector_id
        WHERE mp.project_id = ${id}
          AND ps.sec_id = ${session.secId}
          AND COALESCE(mp.is_archived, false) = false
        LIMIT 1
      `),
      db.execute(sql`
        SELECT
          i.indicator_id,
          COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
          COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
          COALESCE(i.verified_financial_achievement, i.financial_achievement, 0) AS financial_progress,
          COALESCE(d.district_name, 'Unassigned') AS district,
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
        LEFT JOIN hdp.master_district d ON d.district_id = i.district_id
        INNER JOIN hdp.project_secretary ps ON ps.project_id = i.project_id
        INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
        WHERE i.project_id = ${id}
          AND ps.sec_id = ${session.secId}
          AND COALESCE(mp.is_archived, false) = false
        ORDER BY indicator_name ASC
      `),
    ]);

    if (projectResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Project not found in secretary scope" },
        { status: 404 },
      );
    }

    const p = projectResult.rows[0] as Record<string, unknown>;

    return NextResponse.json({
      project: {
        projectId: toNum(p.project_id),
        projectCode: String(p.project_code ?? "-"),
        projectName: String(p.project_name ?? "Untitled project"),
        status:
          toNum(p.is_completed) === 2
            ? "completed"
            : toNum(p.is_completed) === 1
              ? "in-progress"
              : "not-started",
        departmentNames: String(p.department_names ?? "Unassigned"),
        sectorName: String(p.sector_name ?? "Unassigned"),
        districtNames: String(p.district_names ?? "-"),
      },
      indicators: indicatorsResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          indicatorId: toNum(r.indicator_id),
          indicatorName: String(r.indicator_name ?? "Untitled indicator"),
          physicalProgress: toNum(r.physical_progress),
          financialProgress: toNum(r.financial_progress),
          district: String(r.district ?? "Unassigned"),
          imagesCount: toNum(r.images_count),
          videosCount: toNum(r.videos_count),
          lastUpdated: r.last_updated ?? null,
        };
      }),
    });
  } catch (err) {
    console.error(
      "GET /api/secretary/projects/[projectId]/indicators failed",
      err,
    );
    return NextResponse.json(
      { error: "Failed to load project indicators" },
      { status: 500 },
    );
  }
}
