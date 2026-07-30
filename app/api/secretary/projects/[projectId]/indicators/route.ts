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
  const sessionOrResponse = await requireSession();
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
        WITH secretary_departments AS (
          SELECT md.dept_id
          FROM hdp.master_department md
          WHERE md.sec_id = ${session.secId}
        ),
        ownership AS (
          SELECT
            EXISTS (
              SELECT 1
              FROM hdp.project_secretary ps
              WHERE ps.project_id = ${id}
                AND ps.sec_id = ${session.secId}
            ) AS is_owned,
            EXISTS (
              SELECT 1
              FROM hdp.indicators i
              WHERE i.project_id = ${id}
                AND COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
                  SELECT sd.dept_id FROM secretary_departments sd
                )
            ) AS has_supported_indicator
        )
        SELECT
          mp.project_id,
          mp.project_code,
          COALESCE(mp.project_name, 'Untitled project') AS project_name,
          ow.is_owned,
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
        CROSS JOIN ownership ow
        LEFT JOIN hdp.master_sector ms ON ms.sector_id = mp.sector_id
        WHERE mp.project_id = ${id}
          AND (ow.is_owned = true OR ow.has_supported_indicator = true)
          AND COALESCE(mp.is_archived, false) = false
        LIMIT 1
      `),
      db.execute(sql`
        WITH secretary_departments AS (
          SELECT md.dept_id
          FROM hdp.master_department md
          WHERE md.sec_id = ${session.secId}
        ),
        ownership AS (
          SELECT EXISTS (
            SELECT 1
            FROM hdp.project_secretary ps
            WHERE ps.project_id = ${id}
              AND ps.sec_id = ${session.secId}
          ) AS is_owned
        )
        SELECT
          i.indicator_id,
          COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
          COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
          CASE
            WHEN COALESCE(i.financial_target, 0) > 0
            THEN ROUND((COALESCE(i.verified_financial_achievement, 0) / i.financial_target * 100)::numeric, 0)
            ELSE 0
          END AS financial_progress,
          (
            ow.is_owned = false
            AND COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
              SELECT sd.dept_id FROM secretary_departments sd
            )
          ) AS is_supporting_participation,
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
        CROSS JOIN ownership ow
        INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
        WHERE i.project_id = ${id}
          AND (
            ow.is_owned = true
            OR COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
              SELECT sd.dept_id FROM secretary_departments sd
            )
          )
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
        isOwned: Boolean(p.is_owned),
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
          isSupportingParticipation: Boolean(r.is_supporting_participation),
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
