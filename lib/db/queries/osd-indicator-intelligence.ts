import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export interface OsdIndicatorIntelligence {
  indicatorId: number;
  indicatorPublicId: string | null;
  indicatorName: string;
  unit: string | null;
  districtName: string | null;
  projectId: number;
  projectPublicId: string | null;
  projectName: string;
  projectCode: string | null;
  secretaryNames: string[];
  departmentNames: string[];
  financialTarget: number;
  physicalTarget: number;
  physicalAchievement: number;
  verifiedPhysicalAchievement: number;
  percentage: number;
  verifiedPercentage: number;
  submittedDate: string | null;
  verifiedDate: string | null;
  completedDate: string | null;
  imageCount: number;
  videoCount: number;
  hasImage: boolean;
  hasVideo: boolean;
  isPendingVerification: boolean;
  noProgressSubmitted: boolean;
  completedMissingDate: boolean;
  pendingAgeDays: number | null;
}

export async function getOsdIndicatorIntelligence(
  indicatorId: number,
): Promise<OsdIndicatorIntelligence | null> {
  const result = await db.execute(sql`
    SELECT
      i.indicator_id,
      i.public_id::text AS indicator_public_id,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      i.unit,
      md.district_name,
      mp.project_id,
      mp.public_id::text AS project_public_id,
      COALESCE(mp.project_name, 'Untitled project') AS project_name,
      mp.project_code,
      COALESCE(i.financial_target, 0) AS financial_target,
      COALESCE(i.physical_target, 0) AS physical_target,
      COALESCE(i.physical_achievement, 0) AS physical_achievement,
      COALESCE(i.verified_physical_achievement, 0) AS verified_physical_achievement,
      COALESCE(i.percentage, 0) AS percentage,
      COALESCE(i.verified_percentage, i.percentage, 0) AS verified_percentage,
      i.submitted_date,
      i.verified_date,
      i.completed_date,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
      ), 0) AS image_count,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
      ), 0) AS video_count,
      EXISTS(
        SELECT 1 FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
      ) AS has_image,
      EXISTS(
        SELECT 1 FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
      ) AS has_video,
      CASE
        WHEN i.submitted_date IS NOT NULL
         AND (i.verified_date IS NULL OR i.submitted_date > i.verified_date)
        THEN true ELSE false
      END AS is_pending_verification,
      CASE WHEN i.submitted_date IS NULL THEN true ELSE false END AS no_progress_submitted,
      CASE
        WHEN COALESCE(i.verified_percentage, i.percentage, 0) >= 100
         AND i.completed_date IS NULL
        THEN true ELSE false
      END AS completed_missing_date,
      CASE
        WHEN i.submitted_date IS NOT NULL
        THEN ROUND((EXTRACT(EPOCH FROM (NOW() - i.submitted_date)) / 86400)::numeric, 1)
        ELSE NULL::numeric
      END AS pending_age_days,
      COALESCE((
        SELECT ARRAY_AGG(DISTINCT COALESCE(ms.secretary_name, 'Unmapped') ORDER BY COALESCE(ms.secretary_name, 'Unmapped'))
        FROM hdp.project_secretary ps
        LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
        WHERE ps.project_id = mp.project_id
      ), ARRAY[]::text[]) AS secretary_names,
      COALESCE((
        SELECT ARRAY_AGG(DISTINCT COALESCE(mdep.dept_name, 'Unmapped') ORDER BY COALESCE(mdep.dept_name, 'Unmapped'))
        FROM hdp.project_department pd
        LEFT JOIN hdp.master_department mdep ON mdep.dept_id = pd.dept_id
        WHERE pd.project_id = mp.project_id
      ), ARRAY[]::text[]) AS department_names
    FROM hdp.indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    LEFT JOIN hdp.master_district md ON md.district_id = i.district_id
    WHERE i.indicator_id = ${indicatorId}
      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    LIMIT 1
  `);

  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  return {
    indicatorId: Number(row.indicator_id),
    indicatorPublicId: row.indicator_public_id
      ? String(row.indicator_public_id)
      : null,
    indicatorName: String(row.indicator_name ?? "Untitled indicator"),
    unit: row.unit ? String(row.unit) : null,
    districtName: row.district_name ? String(row.district_name) : null,
    projectId: Number(row.project_id),
    projectPublicId: row.project_public_id
      ? String(row.project_public_id)
      : null,
    projectName: String(row.project_name ?? "Untitled project"),
    projectCode: row.project_code ? String(row.project_code) : null,
    secretaryNames: (row.secretary_names as string[] | null) ?? [],
    departmentNames: (row.department_names as string[] | null) ?? [],
    financialTarget: Number(row.financial_target ?? 0),
    physicalTarget: Number(row.physical_target ?? 0),
    physicalAchievement: Number(row.physical_achievement ?? 0),
    verifiedPhysicalAchievement: Number(row.verified_physical_achievement ?? 0),
    percentage: Number(row.percentage ?? 0),
    verifiedPercentage: Number(row.verified_percentage ?? 0),
    submittedDate: row.submitted_date ? String(row.submitted_date) : null,
    verifiedDate: row.verified_date ? String(row.verified_date) : null,
    completedDate: row.completed_date ? String(row.completed_date) : null,
    imageCount: Number(row.image_count ?? 0),
    videoCount: Number(row.video_count ?? 0),
    hasImage: Boolean(row.has_image),
    hasVideo: Boolean(row.has_video),
    isPendingVerification: Boolean(row.is_pending_verification),
    noProgressSubmitted: Boolean(row.no_progress_submitted),
    completedMissingDate: Boolean(row.completed_missing_date),
    pendingAgeDays:
      row.pending_age_days != null ? Number(row.pending_age_days) : null,
  };
}
