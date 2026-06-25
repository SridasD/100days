import { sql } from "drizzle-orm";
import { db } from "../client";

// ---------------------------------------------------------------------------
// Verifier-scoped Drizzle queries (role_id = 1).
// Filtered by sec_id — verification officers see projects/indicators
// assigned to their secretary.
// ---------------------------------------------------------------------------

export interface VerifierProjectRow {
  project_id: number;
  project_code: string | null;
  project_name: string | null;
  project_name_mal: string | null;
  department: string | null;
  indicators_total: number;
  indicators_pending: number;
  indicators_verified: number;
}

/**
 * List projects with submitted indicators that the verifier can act on.
 *
 * Scoping rules:
 *  • `sec_id = 0`  → central verifier, sees projects from every department.
 *  • `sec_id > 0`  → only sees projects assigned to that department.
 *
 * In both cases we only surface projects that actually have at least one
 * indicator with a `submitted_date` (i.e. nodal officer has saved progress),
 * so the queue is meaningful instead of every project under the dept.
 *
 * DISTINCT is required because a project can be linked to multiple
 * secretaries via `project_secretary` — without it a cross-dept project
 * would appear once per linked sec_id.
 */
export async function listVerifierProjects(
  secId: number,
): Promise<VerifierProjectRow[]> {
  const isCentral = !secId || secId === 0;
  const result = await db.execute(sql`
    SELECT DISTINCT ON (mp.project_id)
      mp.project_id,
      mp.project_code,
      mp.project_name,
      mp.project_name_mal,
      COALESCE(
        (
          SELECT STRING_AGG(ms.secretary_name, ', ' ORDER BY ms.secretary_name)
          FROM hdp.project_secretary ps2
          LEFT JOIN hdp.master_secretary ms ON ps2.sec_id = ms.sec_id
          WHERE ps2.project_id = mp.project_id
        ),
        '—'
      ) AS department,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS indicators_total,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
          AND i.submitted_date IS NOT NULL
          AND i.verified_date IS NULL
      ), 0) AS indicators_pending,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
          AND i.verified_date IS NOT NULL
      ), 0) AS indicators_verified
    FROM hdp.master_projects mp
    LEFT JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    WHERE EXISTS (
        SELECT 1 FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
          AND i.submitted_date IS NOT NULL
      )
      AND COALESCE(mp.is_archived, false) = false
      ${isCentral ? sql`` : sql`AND ps.sec_id = ${secId}`}
    ORDER BY mp.project_id, mp.project_name ASC
  `);
  return result.rows as unknown as VerifierProjectRow[];
}

export interface VerifierIndicatorRow {
  indicator_id: number;
  project_id: number;
  indicator_name: string | null;
  district_name: string | null;
  submitted_by_name: string | null;
  physical_target: string | null;
  physical_achievement: number | null;
  financial_target: string | null;
  financial_achievement: string | null;
  percentage: string | null;
  verified_percentage: string | null;
  physical_description: string | null;
  // Verifier-corrected fields (NULL when not yet verified)
  verified_physical_achievement: number | null;
  verified_financial_achievement: string | null;
  verified_physical_description: string | null;
  submitted_date: string | null;
  verified_date: string | null;
  verified_by_name: string | null;
  image_count: number;
  video_count: number;
  status: "pending" | "approved" | "rejected";
}

/**
 * List indicators for verification (pending or all) for project/verifier
 */
export async function listVerifierIndicators(
  projectId: number,
  secId: number,
  pendingOnly = false,
): Promise<VerifierIndicatorRow[]> {
  const isCentral = !secId || secId === 0;
  const filter = pendingOnly ? sql`AND i.verified_date IS NULL` : sql``;

  // DISTINCT so multi-dept projects don't duplicate indicator rows when
  // the verifier's sec_id matches multiple project_secretary entries.
  const result = await db.execute(sql`
    SELECT DISTINCT ON (i.indicator_id)
      i.indicator_id,
      i.project_id,
      i.indicator_name,
      md.district_name,
      ud_submitted.user_name AS submitted_by_name,
      i.physical_target,
      i.physical_achievement,
      i.financial_target,
      i.financial_achievement,
      i.percentage,
      i.verified_percentage,
      i.physical_description,
      i.verified_physical_achievement,
      i.verified_financial_achievement,
      i.verified_physical_description,
      i.submitted_date,
      i.verified_date,
      ud_verified.user_name AS verified_by_name,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
      ), 0) AS image_count,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
      ), 0) AS video_count
    FROM hdp.indicators i
    LEFT JOIN hdp.master_district md ON i.district_id = md.district_id
    LEFT JOIN hdp.user_details ud_submitted ON i.submitted_by = ud_submitted.user_id
    LEFT JOIN hdp.user_details ud_verified ON i.verified_by = ud_verified.user_id
    LEFT JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
    WHERE i.project_id = ${projectId}
      AND i.submitted_date IS NOT NULL
      ${isCentral ? sql`` : sql`AND ps.sec_id = ${secId}`}
      ${filter}
    ORDER BY
      i.indicator_id,
      CASE WHEN i.verified_date IS NULL THEN 0 ELSE 1 END,
      i.submitted_date DESC
  `);

  return (result.rows as unknown as Array<any>).map(
    (row) =>
      ({
        ...row,
        status: row.verified_date ? "approved" : "pending",
      }) as VerifierIndicatorRow,
  );
}

/**
 * Get full indicator detail for verification (read-only + verification fields)
 */
export async function getVerifierIndicator(indicatorId: number, secId: number) {
  const result = await db.execute(sql`
    SELECT
      i.*,
      md.district_name,
      ud_submitted.user_name AS submitted_by_name,
      ud_verified.user_name AS verified_by_name,
      mp.project_name
    FROM hdp.indicators i
    LEFT JOIN hdp.master_district md ON i.district_id = md.district_id
    LEFT JOIN hdp.user_details ud_submitted ON i.submitted_by = ud_submitted.user_id
    LEFT JOIN hdp.user_details ud_verified ON i.verified_by = ud_verified.user_id
    LEFT JOIN hdp.master_projects mp ON i.project_id = mp.project_id
    INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
    WHERE i.indicator_id = ${indicatorId}
      AND ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    LIMIT 1
  `);

  return result.rows[0] ?? null;
}

/**
 * Ownership check — returns true when indicator's project belongs to verifier's sec_id
 */
export async function verifierOwnsIndicator(
  indicatorId: number,
  secId: number,
): Promise<boolean> {
  // Central verifier (sec_id = 0) can act on any indicator.
  if (!secId || secId === 0) {
    const r = await db.execute(sql`
      SELECT 1 FROM hdp.indicators WHERE indicator_id = ${indicatorId} LIMIT 1
    `);
    return r.rows.length > 0;
  }
  const result = await db.execute(sql`
    SELECT 1
    FROM hdp.indicators i
    INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
    WHERE i.indicator_id = ${indicatorId}
      AND ps.sec_id = ${secId}
    LIMIT 1
  `);
  return result.rows.length > 0;
}
