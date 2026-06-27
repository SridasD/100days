import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getDefaulterThresholds } from "@/lib/config/defaulter-thresholds";

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
  if (!Number.isFinite(session.secId) || session.secId <= 0) {
    return NextResponse.json(
      { error: "Secretary scope not configured" },
      { status: 400 },
    );
  }

  const { pendingDays, inactivityDays, indicatorStaleDays } =
    getDefaulterThresholds();

  try {
    const [
      scopeLabelResult,
      summaryResult,
      projectStatusResult,
      projectRowsResult,
      departmentResult,
      pendingProgressResult,
      pendingVerificationResult,
      noRecentActivityResult,
      indicatorsWithoutUpdatesResult,
      recentActivityResult,
    ] = await Promise.all([
      db.execute(sql`
        SELECT secretary_name
        FROM hdp.master_secretary
        WHERE sec_id = ${session.secId}
        LIMIT 1
      `),
      db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT
            mp.project_id,
            COALESCE(mp.is_archived, false) AS is_archived,
            COALESCE(mp.is_completed, 0) AS is_completed,
            mp.completion_date
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
          WHERE ps.sec_id = ${session.secId}
        ),
        active_projects AS (
          SELECT * FROM scoped_projects WHERE is_archived = false
        ),
        scoped_indicators AS (
          SELECT i.*
          FROM hdp.indicators i
          INNER JOIN active_projects ap ON ap.project_id = i.project_id
        )
        SELECT
          (SELECT COUNT(DISTINCT pd.dept_id)::int
            FROM hdp.project_department pd
            INNER JOIN active_projects ap ON ap.project_id = pd.project_id
          ) AS total_departments,
          (SELECT COUNT(*)::int FROM active_projects) AS total_projects,
          (SELECT COUNT(*)::int FROM scoped_indicators) AS total_indicators,
          (SELECT COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0)
            FROM scoped_indicators i
          ) AS physical_progress,
          (SELECT COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0)
            FROM scoped_indicators i
          ) AS financial_progress,
          (SELECT COUNT(*)::int
            FROM hdp.gallery g
            INNER JOIN scoped_indicators i ON i.indicator_id = g.indicator_id
            WHERE g.gallery_type = 1
          ) AS images_uploaded,
          (SELECT COUNT(*)::int
            FROM hdp.gallery g
            INNER JOIN scoped_indicators i ON i.indicator_id = g.indicator_id
            WHERE g.gallery_type = 2
          ) AS videos_uploaded,
          (SELECT MAX(COALESCE(i.verified_date, i.submitted_date))
            FROM scoped_indicators i
          ) AS last_data_update
      `),
      db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT
            mp.project_id,
            COALESCE(mp.is_archived, false) AS is_archived,
            COALESCE(mp.is_completed, 0) AS is_completed,
            mp.completion_date
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
          WHERE ps.sec_id = ${session.secId}
        )
        SELECT
          COUNT(*) FILTER (WHERE is_archived = false AND is_completed = 0)::int AS not_started,
          COUNT(*) FILTER (WHERE is_archived = false AND is_completed = 1)::int AS in_progress,
          COUNT(*) FILTER (WHERE is_archived = false AND is_completed = 2)::int AS completed,
          COUNT(*) FILTER (WHERE is_archived = true)::int AS archived
        FROM scoped_projects
      `),
      db.execute(sql`
        WITH scoped_projects AS (
          SELECT DISTINCT
            mp.project_id,
            mp.project_code,
            mp.project_name,
            COALESCE(mp.is_archived, false) AS is_archived,
            COALESCE(mp.is_completed, 0) AS is_completed,
            mp.completion_date,
            ms.sector_name,
            COALESCE(
              (
                SELECT STRING_AGG(DISTINCT md.dept_name, ', ' ORDER BY md.dept_name)
                FROM hdp.project_department pd
                LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
                WHERE pd.project_id = mp.project_id
              ),
              'Unassigned'
            ) AS department_names,
            COALESCE(
              (
                SELECT STRING_AGG(DISTINCT md2.district_name, ', ' ORDER BY md2.district_name)
                FROM hdp.indicators i2
                LEFT JOIN hdp.master_district md2 ON md2.district_id = i2.district_id
                WHERE i2.project_id = mp.project_id
              ),
              '—'
            ) AS district_names
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
          LEFT JOIN hdp.master_sector ms ON ms.sector_id = mp.sector_id
          WHERE ps.sec_id = ${session.secId}
        )
        SELECT
          sp.project_id,
          sp.project_code,
          sp.project_name,
          sp.is_archived,
          sp.is_completed,
          sp.completion_date,
          sp.sector_name,
          sp.department_names,
          sp.district_names,
          COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
          COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
          COUNT(i.indicator_id)::int AS indicators,
          COUNT(i.indicator_id) FILTER (
            WHERE i.submitted_date IS NOT NULL AND i.verified_date IS NULL
          )::int AS pending_verification,
          MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
        FROM scoped_projects sp
        LEFT JOIN hdp.indicators i ON i.project_id = sp.project_id
        GROUP BY
          sp.project_id,
          sp.project_code,
          sp.project_name,
          sp.is_archived,
          sp.is_completed,
          sp.completion_date,
          sp.sector_name,
          sp.department_names,
          sp.district_names
        ORDER BY sp.project_name ASC NULLS LAST
      `),
      db.execute(sql`
        WITH dept_projects AS (
          SELECT DISTINCT
            pd.dept_id,
            COALESCE(md.dept_name, 'Unassigned') AS department,
            mp.project_id
          FROM hdp.project_department pd
          LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
          WHERE ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
        )
        SELECT
          dp.dept_id,
          dp.department,
          COUNT(DISTINCT dp.project_id)::int AS projects,
          COUNT(i.indicator_id)::int AS indicators,
          COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
          COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
          MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
        FROM dept_projects dp
        LEFT JOIN hdp.indicators i ON i.project_id = dp.project_id
        GROUP BY dp.dept_id, dp.department
        ORDER BY physical_progress ASC, financial_progress ASC, dp.department ASC
      `),
      db.execute(sql`
        WITH dept_activity AS (
          SELECT
            pd.dept_id,
            COALESCE(md.dept_name, 'Unassigned') AS department,
            MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_activity
          FROM hdp.project_department pd
          LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
          LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
          WHERE ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
          GROUP BY pd.dept_id, COALESCE(md.dept_name, 'Unassigned')
        )
        SELECT
          da.department,
          COALESCE(
            FLOOR(EXTRACT(EPOCH FROM (NOW() - da.last_activity)) / 86400)::int,
            ${pendingDays}
          ) AS pending_days
        FROM dept_activity da
        WHERE da.last_activity IS NULL
           OR da.last_activity < NOW() - (${pendingDays} * INTERVAL '1 day')
        ORDER BY pending_days DESC, da.department ASC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT
          COUNT(*)::int AS pending_verification_count
        FROM hdp.indicators i
        INNER JOIN hdp.project_secretary ps ON ps.project_id = i.project_id
        INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
        WHERE ps.sec_id = ${session.secId}
          AND COALESCE(mp.is_archived, false) = false
          AND i.submitted_date IS NOT NULL
          AND i.verified_date IS NULL
      `),
      db.execute(sql`
        WITH dept_activity AS (
          SELECT
            pd.dept_id,
            COALESCE(md.dept_name, 'Unassigned') AS department,
            MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_activity
          FROM hdp.project_department pd
          LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
          INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
          INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
          LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
          WHERE ps.sec_id = ${session.secId}
            AND COALESCE(mp.is_archived, false) = false
          GROUP BY pd.dept_id, COALESCE(md.dept_name, 'Unassigned')
        )
        SELECT
          da.department,
          COALESCE(
            FLOOR(EXTRACT(EPOCH FROM (NOW() - da.last_activity)) / 86400)::int,
            ${inactivityDays}
          ) AS inactive_days
        FROM dept_activity da
        WHERE da.last_activity IS NULL
           OR da.last_activity < NOW() - (${inactivityDays} * INTERVAL '1 day')
        ORDER BY inactive_days DESC, da.department ASC
        LIMIT 20
      `),
      db.execute(sql`
        SELECT
          i.indicator_id,
          COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
          COALESCE(mp.project_name, 'Untitled project') AS project_name,
          COALESCE(
            (
              SELECT STRING_AGG(DISTINCT md.dept_name, ', ' ORDER BY md.dept_name)
              FROM hdp.project_department pd
              LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
              WHERE pd.project_id = mp.project_id
            ),
            'Unassigned'
          ) AS department,
          COALESCE(
            FLOOR(
              EXTRACT(
                EPOCH FROM (
                  NOW() - COALESCE(i.submitted_date, i.verified_date)
                )
              ) / 86400
            )::int,
            ${indicatorStaleDays}
          ) AS stale_days
        FROM hdp.indicators i
        INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
        INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
        WHERE ps.sec_id = ${session.secId}
          AND COALESCE(mp.is_archived, false) = false
          AND (
            (i.submitted_date IS NULL AND i.verified_date IS NULL)
            OR COALESCE(i.submitted_date, i.verified_date) < NOW() - (${indicatorStaleDays} * INTERVAL '1 day')
          )
        ORDER BY stale_days DESC, indicator_name ASC
        LIMIT 30
      `),
      db.execute(sql`
        SELECT
          ul.user_log_id,
          ul.action,
          ul.entity,
          ul.entity_id,
          ul.logged_on,
          COALESCE(ud.user_name, 'System') AS actor
        FROM hdp.user_log ul
        LEFT JOIN hdp.user_details ud ON ud.user_id = ul.user_id
        WHERE ul.sec_id = ${session.secId}
          AND ul.action IN (
            'PROJECT_CREATED',
            'INDICATOR_CREATED',
            'INDICATOR_SUBMITTED',
            'INDICATOR_APPROVED',
            'MEDIA_UPLOADED',
            'VIDEO_EMBEDDED'
          )
        ORDER BY ul.logged_on DESC, ul.user_log_id DESC
        LIMIT 20
      `),
    ]);

    const scopeLabel =
      (
        scopeLabelResult.rows[0] as
          | { secretary_name: string | null }
          | undefined
      )?.secretary_name ?? null;
    const summary = (summaryResult.rows[0] as Record<string, unknown>) ?? {};
    const projectStatus =
      (projectStatusResult.rows[0] as Record<string, unknown>) ?? {};
    const pendingVerification =
      (
        pendingVerificationResult.rows[0] as
          | { pending_verification_count: unknown }
          | undefined
      )?.pending_verification_count ?? 0;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      scope: {
        secId: session.secId,
        secretaryName: scopeLabel,
      },
      summary: {
        totalDepartments: toNum(summary.total_departments),
        totalProjects: toNum(summary.total_projects),
        totalIndicators: toNum(summary.total_indicators),
        physicalProgress: toNum(summary.physical_progress),
        financialProgress: toNum(summary.financial_progress),
        imagesUploaded: toNum(summary.images_uploaded),
        videosUploaded: toNum(summary.videos_uploaded),
        lastDataUpdate: summary.last_data_update ?? null,
      },
      projectStatus: {
        notStarted: toNum(projectStatus.not_started),
        inProgress: toNum(projectStatus.in_progress),
        completed: toNum(projectStatus.completed),
        archived: toNum(projectStatus.archived),
      },
      projects: projectRowsResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          projectId: toNum(r.project_id),
          projectCode: toNullableString(r.project_code),
          projectName: toNullableString(r.project_name),
          isArchived: Boolean(r.is_archived),
          isCompleted: toNum(r.is_completed),
          completionDate: r.completion_date ?? null,
          sectorName: toNullableString(r.sector_name) ?? "Unassigned",
          departmentNames: toNullableString(r.department_names) ?? "Unassigned",
          districtNames: toNullableString(r.district_names) ?? "—",
          physicalProgress: toNum(r.physical_progress),
          financialProgress: toNum(r.financial_progress),
          indicators: toNum(r.indicators),
          pendingVerification: toNum(r.pending_verification),
          lastUpdated: r.last_updated ?? null,
        };
      }),
      departmentPerformance: departmentResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          deptId: toNum(r.dept_id),
          department: toNullableString(r.department) ?? "Unassigned",
          projects: toNum(r.projects),
          indicators: toNum(r.indicators),
          physicalProgress: toNum(r.physical_progress),
          financialProgress: toNum(r.financial_progress),
          lastUpdated: r.last_updated ?? null,
        };
      }),
      alerts: {
        pendingProgressUpdates: pendingProgressResult.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            department: toNullableString(r.department) ?? "Unassigned",
            pendingDays: toNum(r.pending_days),
          };
        }),
        pendingVerificationCount: toNum(pendingVerification),
        noRecentActivity: noRecentActivityResult.rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            department: toNullableString(r.department) ?? "Unassigned",
            inactiveDays: toNum(r.inactive_days),
          };
        }),
        indicatorsWithoutUpdates: indicatorsWithoutUpdatesResult.rows.map(
          (row) => {
            const r = row as Record<string, unknown>;
            return {
              indicatorId: toNum(r.indicator_id),
              indicatorName:
                toNullableString(r.indicator_name) ?? "Untitled indicator",
              projectName:
                toNullableString(r.project_name) ?? "Untitled project",
              department: toNullableString(r.department) ?? "Unassigned",
              staleDays: toNum(r.stale_days),
            };
          },
        ),
      },
      recentActivity: recentActivityResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          eventId: toNum(r.user_log_id),
          action: toNullableString(r.action) ?? "UNKNOWN",
          entity: toNullableString(r.entity),
          entityId: toNum(r.entity_id),
          actor: toNullableString(r.actor) ?? "System",
          loggedOn: r.logged_on ?? null,
        };
      }),
      thresholds: {
        pendingDays,
        inactivityDays,
        indicatorStaleDays,
      },
    });
  } catch (err) {
    console.error("GET /api/secretary/dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load secretary dashboard" },
      { status: 500 },
    );
  }
}
