import { sql } from "drizzle-orm";
import { db } from "../client";

// ---------------------------------------------------------------------------
// Officer-scoped Drizzle queries.
// Filtered by sec_id everywhere — the officer can only see / mutate rows that
// belong to their assigned secretary (Section 4.3 RLS strategy).
// ---------------------------------------------------------------------------

export interface OfficerProjectRow {
  project_id: number;
  project_code: string | null;
  project_name: string | null;
  project_name_mal: string | null;
  project_cost: string | null; // numeric → string via pg
  is_completed: number | null;
  no_days_employed_direct: number | null;
  no_persons_employed_direct: number | null;
  no_days_employed_indirect: number | null;
  no_persons_employed_indirect: number | null;
  department: string | null;
  indicators_total: number;
  indicators_completed: number;
  /** SUM(financial_target) over the project's indicators, in Lakhs. */
  total_allocated: string | null;
}

export async function listOfficerProjects(
  secId: number,
): Promise<OfficerProjectRow[]> {
  // DISTINCT ON keeps a project from appearing twice when it is linked to
  // multiple sec_ids that both match the officer's secId (rare, but possible
  // for cross-dept officers in future). We aggregate the department label
  // via STRING_AGG so the card shows every dept the project belongs to,
  // not just the row picked by the join.
  // NOTE: dropped the legacy `mp.stage = 1` filter. Admin-created projects
  // should be visible regardless of stage value, matching getOfficerProject.
  const result = await db.execute(sql`
    SELECT DISTINCT ON (mp.project_id)
      mp.project_id,
      mp.project_code,
      mp.project_name,
      mp.project_name_mal,
      mp.project_cost,
      mp.is_completed,
      mp.no_days_employed_direct,
      mp.no_persons_employed_direct,
      mp.no_days_employed_indirect,
      mp.no_persons_employed_indirect,
      COALESCE(
        (
          SELECT STRING_AGG(ms2.secretary_name, ', ' ORDER BY ms2.secretary_name)
          FROM hdp.project_secretary ps2
          LEFT JOIN hdp.master_secretary ms2 ON ps2.sec_id = ms2.sec_id
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
        WHERE i.project_id = mp.project_id AND i.percentage = 100
      ), 0) AS indicators_completed,
      COALESCE((
        SELECT SUM(i.financial_target)::numeric FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS total_allocated
    FROM hdp.master_projects mp
    INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    WHERE ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    ORDER BY mp.project_id, mp.project_name ASC
  `);
  return result.rows as unknown as OfficerProjectRow[];
}

export interface OfficerProjectDetailRow extends OfficerProjectRow {
  description: string | null;
  nature_of_project: number | null;
  priority: number | null;
  project_execution_type: number | null;
  completion_date: string | null;
  sec_id: number | null;
  /** Sum of financial_target across all indicators of this project (Lakhs). */
  total_allocated: string | null;
}

export async function getOfficerProject(
  projectId: number,
  secId: number,
): Promise<OfficerProjectDetailRow | null> {
  const result = await db.execute(sql`
    SELECT
      mp.project_id,
      mp.project_code,
      mp.project_name,
      mp.project_name_mal,
      mp.description,
      mp.project_cost,
      mp.is_completed,
      mp.nature_of_project,
      mp.priority,
      mp.project_execution_type,
      mp.completion_date,
      mp.no_days_employed_direct,
      mp.no_persons_employed_direct,
      mp.no_days_employed_indirect,
      mp.no_persons_employed_indirect,
      ms.secretary_name AS department,
      ps.sec_id,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS indicators_total,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id AND i.percentage = 100
      ), 0) AS indicators_completed,
      COALESCE((
        SELECT SUM(i.financial_target)::numeric FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS total_allocated
    FROM hdp.master_projects mp
    INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
    WHERE mp.project_id = ${projectId}
      AND ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    LIMIT 1
  `);
  const row = (result.rows as unknown as OfficerProjectDetailRow[])[0];
  return row ?? null;
}

export interface OfficerIndicatorRow {
  indicator_id: number;
  project_id: number;
  indicator_name: string | null;
  unit: string | null;
  district_id: number | null;
  district_name: string | null;
  physical_target: string | null;
  physical_achievement: number | null;
  financial_target: string | null;
  financial_achievement: string | null;
  percentage: string | null;
  verified_percentage: string | null;
  physical_description: string | null;
  // Verifier-corrected values — null until approved
  verified_physical_achievement: number | null;
  verified_financial_achievement: string | null;
  verified_physical_description: string | null;
  completed_date: string | null;
  submitted_date: string | null;
  verified_date: string | null;
  achieved_no_days_employed_direct: number | null;
  achieved_no_persons_employed_direct: number | null;
  achieved_no_days_employed_indirect: number | null;
  achieved_no_persons_employed_indirect: number | null;
  image_count: number;
  video_count: number;
  document_count: number;
  supporting_dept_names: string | null;
}

export async function listIndicatorsForProject(
  projectId: number,
  secId: number,
): Promise<OfficerIndicatorRow[]> {
  const result = await db.execute(sql`
    SELECT
      i.indicator_id,
      i.project_id,
      i.indicator_name,
      i.unit,
      i.district_id,
      md.district_name,
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
      i.completed_date,
      i.submitted_date,
      i.verified_date,
      i.achieved_no_days_employed_direct,
      i.achieved_no_persons_employed_direct,
      i.achieved_no_days_employed_indirect,
      i.achieved_no_persons_employed_indirect,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
      ), 0) AS image_count,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
      ), 0) AS video_count,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.documents d
        WHERE d.indicator_id = i.indicator_id
      ), 0) AS document_count
      ,COALESCE((
        SELECT STRING_AGG(md.dept_name, ', ' ORDER BY md.dept_name)
        FROM unnest(COALESCE(i.supporting_dept_ids, '{}'::integer[])) AS dept_ids(dept_id)
        JOIN hdp.master_department md ON md.dept_id = dept_ids.dept_id
      ), '') AS supporting_dept_names
    FROM hdp.indicators i
    LEFT JOIN hdp.master_district md ON i.district_id = md.district_id
    INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
    WHERE i.project_id = ${projectId}
      AND ps.sec_id = ${secId}
    ORDER BY i.indicator_id ASC
  `);
  return result.rows as unknown as OfficerIndicatorRow[];
}

/**
 * Ownership check — returns true when the indicator's project is assigned
 * to the officer's secretary. All mutation endpoints MUST gate on this.
 */
export async function officerOwnsIndicator(
  indicatorId: number,
  secId: number,
): Promise<boolean> {
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

export interface GalleryRow {
  gallery_id: number;
  indicator_id: number;
  gallery_type: number;
  image_path: string | null;
  description: string | null;
  uploaded_on: string | null;
  is_verified: boolean | null;
}

export async function listGallery(
  indicatorId: number,
  galleryType?: 1 | 2,
): Promise<GalleryRow[]> {
  if (galleryType) {
    const result = await db.execute(sql`
      SELECT gallery_id, indicator_id, gallery_type, image_path,
             description, uploaded_on, is_verified
      FROM hdp.gallery
      WHERE indicator_id = ${indicatorId}
        AND gallery_type = ${galleryType}
      ORDER BY gallery_id DESC
    `);
    return result.rows as unknown as GalleryRow[];
  }
  const result = await db.execute(sql`
    SELECT gallery_id, indicator_id, gallery_type, image_path,
           description, uploaded_on, is_verified
    FROM hdp.gallery
    WHERE indicator_id = ${indicatorId}
    ORDER BY gallery_id DESC
  `);
  return result.rows as unknown as GalleryRow[];
}
