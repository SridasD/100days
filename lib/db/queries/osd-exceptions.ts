import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export type OsdExceptionType =
  | "UNMAPPED_DEPARTMENT"
  | "UNMAPPED_SECRETARY"
  | "MAPPED_NO_INDICATORS"
  | "INDICATOR_NO_PROGRESS"
  | "MISSING_IMAGE"
  | "MISSING_VIDEO"
  | "LATEST_PENDING_VERIFICATION"
  | "PROJECT_READY_FOR_CLOSURE"
  | "INVALID_COMPLETED_PROJECT"
  | "COMPLETED_WITH_DATE"
  | "COMPLETED_MISSING_DATE";

export interface OsdExceptionSummaryRow {
  key: OsdExceptionType;
  label: string;
  count: number;
  severity: "critical" | "warning" | "info";
}

export interface OsdExceptionDepartmentRow {
  departmentName: string;
  totalExceptions: number;
  criticalExceptions: number;
}

export interface OsdExceptionQueueRow {
  exceptionType: OsdExceptionType;
  severity: "critical" | "warning" | "info";
  projectId: number;
  projectPublicId: string | null;
  projectName: string;
  departmentName: string;
  secretaryName: string;
  indicatorId: number | null;
  indicatorPublicId: string | null;
  indicatorName: string | null;
  districtName: string | null;
  ageDays: number | null;
  note: string;
}

export interface OsdExceptionMonitorData {
  timestamp: string;
  summary: OsdExceptionSummaryRow[];
  departments: OsdExceptionDepartmentRow[];
  queue: OsdExceptionQueueRow[];
}

const SHARED_EXCEPTION_CTE = sql`
  WITH active_projects AS (
    SELECT
      mp.project_id,
      mp.public_id::text AS public_id,
      COALESCE(mp.project_name, 'Untitled project') AS project_name,
      COALESCE(mp.is_completed, 0) AS is_completed
    FROM hdp.master_projects mp
    WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
  ),
  project_scope AS (
    SELECT
      ap.project_id,
      ap.public_id AS project_public_id,
      ap.project_name,
      ap.is_completed,
      EXISTS(
        SELECT 1 FROM hdp.project_department pd
        WHERE pd.project_id = ap.project_id
      ) AS has_department,
      EXISTS(
        SELECT 1 FROM hdp.project_secretary ps
        WHERE ps.project_id = ap.project_id
      ) AS has_secretary,
      EXISTS(
        SELECT 1 FROM hdp.indicators i
        WHERE i.project_id = ap.project_id
      ) AS has_indicators,
      COALESCE((
        SELECT STRING_AGG(DISTINCT COALESCE(md.dept_name, 'Unknown'), ', ' ORDER BY COALESCE(md.dept_name, 'Unknown'))
        FROM hdp.project_department pd
        LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
        WHERE pd.project_id = ap.project_id
      ), 'Unmapped') AS department_name,
      COALESCE((
        SELECT STRING_AGG(DISTINCT COALESCE(ms.secretary_name, 'Unknown'), ', ' ORDER BY COALESCE(ms.secretary_name, 'Unknown'))
        FROM hdp.project_secretary ps
        LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
        WHERE ps.project_id = ap.project_id
      ), 'Unmapped') AS secretary_name
    FROM active_projects ap
  ),
  indicator_scope AS (
    SELECT
      i.indicator_id,
      i.public_id::text AS indicator_public_id,
      i.project_id,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(md.district_name, 'Unknown') AS district_name,
      i.submitted_date,
      i.verified_date,
      i.completed_date,
      COALESCE(i.verified_percentage, i.percentage, 0) AS effective_percentage,
      EXISTS(
        SELECT 1 FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
      ) AS has_image,
      EXISTS(
        SELECT 1 FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
      ) AS has_video
    FROM hdp.indicators i
    INNER JOIN active_projects ap ON ap.project_id = i.project_id
    LEFT JOIN hdp.master_district md ON md.district_id = i.district_id
  ),
  project_completion AS (
    SELECT
      ps.project_id,
      COUNT(isc.indicator_id)::int AS indicator_count,
      COUNT(*) FILTER (WHERE isc.effective_percentage >= 100)::int AS completed_indicator_count,
      COUNT(*) FILTER (WHERE isc.effective_percentage >= 100 AND isc.completed_date IS NOT NULL)::int AS completed_with_date_count,
      COUNT(*) FILTER (WHERE isc.effective_percentage >= 100 AND isc.completed_date IS NULL)::int AS completed_missing_date_count
    FROM project_scope ps
    LEFT JOIN indicator_scope isc ON isc.project_id = ps.project_id
    GROUP BY ps.project_id
  ),
  exception_rows AS (
    SELECT
      'UNMAPPED_DEPARTMENT'::text AS exception_type,
      'critical'::text AS severity,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      NULL::bigint AS indicator_id,
      NULL::text AS indicator_public_id,
      NULL::text AS indicator_name,
      NULL::text AS district_name,
      NULL::numeric AS age_days,
      'Project is not mapped to any department.'::text AS note
    FROM project_scope ps
    WHERE ps.has_department = false

    UNION ALL

    SELECT
      'UNMAPPED_SECRETARY'::text,
      'critical'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      NULL::bigint,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::numeric,
      'Project is not mapped to any secretary.'::text
    FROM project_scope ps
    WHERE ps.has_secretary = false

    UNION ALL

    SELECT
      'MAPPED_NO_INDICATORS'::text,
      'critical'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      NULL::bigint,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::numeric,
      'Project is mapped but indicators have not been added.'::text
    FROM project_scope ps
    WHERE ps.has_department = true
      AND ps.has_secretary = true
      AND ps.has_indicators = false

    UNION ALL

    SELECT
      'INDICATOR_NO_PROGRESS'::text,
      'warning'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      isc.indicator_id,
      isc.indicator_public_id,
      isc.indicator_name,
      isc.district_name,
      NULL::numeric,
      'Indicator exists but no progress has been submitted yet.'::text
    FROM indicator_scope isc
    INNER JOIN project_scope ps ON ps.project_id = isc.project_id
    WHERE isc.submitted_date IS NULL

    UNION ALL

    SELECT
      'MISSING_IMAGE'::text,
      'info'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      isc.indicator_id,
      isc.indicator_public_id,
      isc.indicator_name,
      isc.district_name,
      NULL::numeric,
      'Indicator has no image evidence.'::text
    FROM indicator_scope isc
    INNER JOIN project_scope ps ON ps.project_id = isc.project_id
    WHERE isc.has_image = false

    UNION ALL

    SELECT
      'MISSING_VIDEO'::text,
      'info'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      isc.indicator_id,
      isc.indicator_public_id,
      isc.indicator_name,
      isc.district_name,
      NULL::numeric,
      'Indicator has no video evidence.'::text
    FROM indicator_scope isc
    INNER JOIN project_scope ps ON ps.project_id = isc.project_id
    WHERE isc.has_video = false

    UNION ALL

    SELECT
      'LATEST_PENDING_VERIFICATION'::text,
      'critical'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      isc.indicator_id,
      isc.indicator_public_id,
      isc.indicator_name,
      isc.district_name,
      ROUND((EXTRACT(EPOCH FROM (NOW() - isc.submitted_date)) / 86400)::numeric, 1) AS age_days,
      'Latest progress submission is pending verification.'::text
    FROM indicator_scope isc
    INNER JOIN project_scope ps ON ps.project_id = isc.project_id
    WHERE isc.submitted_date IS NOT NULL
      AND (isc.verified_date IS NULL OR isc.submitted_date > isc.verified_date)

    UNION ALL

    SELECT
      'PROJECT_READY_FOR_CLOSURE'::text,
      'warning'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      NULL::bigint,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::numeric,
      'All indicators are completed with dates, but the project is not marked completed.'::text
    FROM project_scope ps
    INNER JOIN project_completion pc ON pc.project_id = ps.project_id
    WHERE pc.indicator_count > 0
      AND pc.completed_with_date_count = pc.indicator_count
      AND ps.is_completed <> 2

    UNION ALL

    SELECT
      'INVALID_COMPLETED_PROJECT'::text,
      'critical'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      NULL::bigint,
      NULL::text,
      NULL::text,
      NULL::text,
      NULL::numeric,
      'Project is marked completed while indicators are incomplete or missing completion dates.'::text
    FROM project_scope ps
    INNER JOIN project_completion pc ON pc.project_id = ps.project_id
    WHERE ps.is_completed = 2
      AND (
        pc.indicator_count = 0
        OR pc.completed_with_date_count < pc.indicator_count
      )

    UNION ALL

    SELECT
      'COMPLETED_WITH_DATE'::text,
      'info'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      isc.indicator_id,
      isc.indicator_public_id,
      isc.indicator_name,
      isc.district_name,
      NULL::numeric,
      'Indicator is completed and completion date is marked.'::text
    FROM indicator_scope isc
    INNER JOIN project_scope ps ON ps.project_id = isc.project_id
    WHERE isc.effective_percentage >= 100
      AND isc.completed_date IS NOT NULL

    UNION ALL

    SELECT
      'COMPLETED_MISSING_DATE'::text,
      'warning'::text,
      ps.project_id,
      ps.project_public_id,
      ps.project_name,
      ps.department_name,
      ps.secretary_name,
      isc.indicator_id,
      isc.indicator_public_id,
      isc.indicator_name,
      isc.district_name,
      NULL::numeric,
      'Indicator is completed but completion date is missing.'::text
    FROM indicator_scope isc
    INNER JOIN project_scope ps ON ps.project_id = isc.project_id
    WHERE isc.effective_percentage >= 100
      AND isc.completed_date IS NULL
  )
`;

const SUMMARY_QUERY = sql`
  ${SHARED_EXCEPTION_CTE}
  SELECT
    exception_type AS key,
    CASE exception_type
      WHEN 'UNMAPPED_DEPARTMENT' THEN 'Unmapped Department Projects'
      WHEN 'UNMAPPED_SECRETARY' THEN 'Unmapped Secretary Projects'
      WHEN 'MAPPED_NO_INDICATORS' THEN 'Mapped Projects Without Indicators'
      WHEN 'INDICATOR_NO_PROGRESS' THEN 'Indicators Without Progress'
      WHEN 'MISSING_IMAGE' THEN 'Indicators Missing Images'
      WHEN 'MISSING_VIDEO' THEN 'Indicators Missing Video'
      WHEN 'LATEST_PENDING_VERIFICATION' THEN 'Latest Pending Verification'
      WHEN 'PROJECT_READY_FOR_CLOSURE' THEN 'Projects Ready For Closure'
      WHEN 'INVALID_COMPLETED_PROJECT' THEN 'Invalid Completed Projects'
      WHEN 'COMPLETED_WITH_DATE' THEN 'Completed Indicators With Date'
      WHEN 'COMPLETED_MISSING_DATE' THEN 'Completed Indicators Missing Date'
      ELSE exception_type
    END AS label,
    COUNT(*)::int AS count,
    MAX(severity) AS severity
  FROM exception_rows
  GROUP BY exception_type
  ORDER BY
    CASE MAX(severity)
      WHEN 'critical' THEN 1
      WHEN 'warning' THEN 2
      ELSE 3
    END,
    count DESC,
    label ASC
`;

const DEPARTMENT_QUERY = sql`
  ${SHARED_EXCEPTION_CTE}
  SELECT
    department_name,
    COUNT(*)::int AS total_exceptions,
    COUNT(*) FILTER (WHERE severity = 'critical')::int AS critical_exceptions
  FROM exception_rows
  WHERE exception_type NOT IN ('COMPLETED_WITH_DATE')
  GROUP BY department_name
  ORDER BY critical_exceptions DESC, total_exceptions DESC, department_name ASC
  LIMIT 10
`;

const QUEUE_QUERY = sql`
  ${SHARED_EXCEPTION_CTE}
  SELECT
    exception_type,
    severity,
    project_id,
    project_public_id,
    project_name,
    department_name,
    secretary_name,
    indicator_id,
    indicator_public_id,
    indicator_name,
    district_name,
    age_days,
    note
  FROM exception_rows
  ORDER BY
    CASE severity
      WHEN 'critical' THEN 1
      WHEN 'warning' THEN 2
      ELSE 3
    END,
    COALESCE(age_days, 0) DESC,
    project_name ASC,
    indicator_name ASC NULLS LAST
`;

export async function getOsdExceptionMonitorData(): Promise<OsdExceptionMonitorData> {
  const [summaryResult, departmentResult, queueResult] = await Promise.all([
    db.execute(SUMMARY_QUERY),
    db.execute(DEPARTMENT_QUERY),
    db.execute(QUEUE_QUERY),
  ]);

  return {
    timestamp: new Date().toISOString(),
    summary: summaryResult.rows.map((row) => {
      const item = row as {
        key: OsdExceptionType;
        label: string;
        count: number | string;
        severity: "critical" | "warning" | "info";
      };
      return {
        key: item.key,
        label: item.label,
        count: Number(item.count) || 0,
        severity: item.severity,
      };
    }),
    departments: departmentResult.rows.map((row) => {
      const item = row as {
        department_name: string;
        total_exceptions: number | string;
        critical_exceptions: number | string;
      };
      return {
        departmentName: item.department_name,
        totalExceptions: Number(item.total_exceptions) || 0,
        criticalExceptions: Number(item.critical_exceptions) || 0,
      };
    }),
    queue: queueResult.rows.map((row) => {
      const item = row as Record<string, unknown>;
      return {
        exceptionType: String(item.exception_type) as OsdExceptionType,
        severity: String(item.severity) as "critical" | "warning" | "info",
        projectId: Number(item.project_id),
        projectPublicId: item.project_public_id
          ? String(item.project_public_id)
          : null,
        projectName: String(item.project_name ?? "Untitled project"),
        departmentName: String(item.department_name ?? "Unmapped"),
        secretaryName: String(item.secretary_name ?? "Unmapped"),
        indicatorId:
          item.indicator_id != null ? Number(item.indicator_id) : null,
        indicatorPublicId: item.indicator_public_id
          ? String(item.indicator_public_id)
          : null,
        indicatorName: item.indicator_name ? String(item.indicator_name) : null,
        districtName: item.district_name ? String(item.district_name) : null,
        ageDays: item.age_days != null ? Number(item.age_days) : null,
        note: String(item.note ?? ""),
      };
    }),
  };
}
