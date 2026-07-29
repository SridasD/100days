import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toNullableString(v: unknown) {
  return typeof v === "string" ? v : null;
}

export async function GET() {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  if (session.roleId !== ROLE.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const [scopeLabelResult, supportingResult] = await Promise.all([
      db.execute(sql`
        SELECT secretary_name
        FROM hdp.master_secretary
        WHERE sec_id = ${session.secId}
        LIMIT 1
      `),
      db.execute(sql`
        WITH secretary_departments AS (
          SELECT md.dept_id
          FROM hdp.master_department md
          WHERE md.sec_id = ${session.secId}
        ),
        owned_projects AS (
          SELECT DISTINCT ps.project_id
          FROM hdp.project_secretary ps
          WHERE ps.sec_id = ${session.secId}
        ),
        supported_indicators AS (
          SELECT DISTINCT i.indicator_id, i.project_id
          FROM hdp.indicators i
          WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
            SELECT sd.dept_id FROM secretary_departments sd
          )
        )
        SELECT
          i.indicator_id,
          COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
          mp.project_id,
          COALESCE(mp.project_name, 'Untitled project') AS project_name,
          mp.project_code,
          COALESCE(ms.sector_name, 'Unassigned') AS sector_name,
          COALESCE(md2.district_name, 'Unassigned') AS district_name,
          COALESCE(
            (
              SELECT STRING_AGG(DISTINCT md.dept_name, ', ' ORDER BY md.dept_name)
              FROM hdp.project_department pd
              LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
              WHERE pd.project_id = mp.project_id
            ),
            'Unassigned'
          ) AS department_names,
          COALESCE(mp.is_completed, 0) AS is_completed,
          COALESCE(i.verified_percentage, 0) AS physical_progress,
          CASE
            WHEN COALESCE(i.financial_target, 0) > 0
            THEN ROUND((COALESCE(i.verified_financial_achievement, 0) / i.financial_target * 100)::numeric, 0)
            ELSE 0
          END AS financial_progress,
          COALESCE(i.verified_date, i.submitted_date) AS last_updated
        FROM hdp.indicators i
        INNER JOIN supported_indicators si ON si.indicator_id = i.indicator_id
        INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
        LEFT JOIN owned_projects op ON op.project_id = mp.project_id
        LEFT JOIN hdp.master_sector ms ON ms.sector_id = mp.sector_id
        LEFT JOIN hdp.master_district md2 ON md2.district_id = i.district_id
        WHERE op.project_id IS NULL
          AND COALESCE(mp.is_archived, false) = false
        ORDER BY project_name ASC, indicator_name ASC
      `),
    ]);

    const scopeLabel =
      (
        scopeLabelResult.rows[0] as
          | { secretary_name: string | null }
          | undefined
      )?.secretary_name ?? null;

    return NextResponse.json({
      scope: {
        secId: session.secId,
        secretaryName: scopeLabel,
      },
      supportingParticipationIndicators: supportingResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          indicatorId: toNum(r.indicator_id),
          indicatorName:
            toNullableString(r.indicator_name) ?? "Untitled indicator",
          projectId: toNum(r.project_id),
          projectName: toNullableString(r.project_name) ?? "Untitled project",
          projectCode: toNullableString(r.project_code),
          sectorName: toNullableString(r.sector_name) ?? "Unassigned",
          districtName: toNullableString(r.district_name) ?? "Unassigned",
          departmentNames: toNullableString(r.department_names) ?? "Unassigned",
          isCompleted: toNum(r.is_completed),
          physicalProgress: toNum(r.physical_progress),
          financialProgress: toNum(r.financial_progress),
          lastUpdated: r.last_updated ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/secretary/supporting-dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load supporting dashboard" },
      { status: 500 },
    );
  }
}
