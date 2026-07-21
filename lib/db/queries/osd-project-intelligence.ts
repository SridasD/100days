import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export interface OsdProjectCore {
  projectId: number;
  projectPublicId: string | null;
  projectCode: string | null;
  projectName: string;
  projectNameMal: string | null;
  description: string | null;
  projectOutcome: string | null;
  projectCost: number;
  sourceOfFundingName: string | null;
  sectorName: string | null;
  priority: number | null;
  natureOfProject: number | null;
  projectExecutionType: number | null;
  isCompleted: number;
  completionDate: string | null;
  stage: number | null;
  noDaysEmployedDirect: number;
  noPersonsEmployedDirect: number;
  noDaysEmployedIndirect: number;
  noPersonsEmployedIndirect: number;
  otherBenefits: string | null;
  govtPolicyLinkage: string | null;
  manifestoLinkage: string | null;
  extraOne: string | null;
  extraTwo: string | null;
  extraThree: string | null;
  secretaryNames: string[];
  departmentNames: string[];
}

export interface OsdProjectIndicator {
  indicatorId: number;
  indicatorPublicId: string | null;
  indicatorName: string;
  districtName: string | null;
  unit: string | null;
  financialTarget: number;
  physicalTarget: number;
  physicalAchievement: number;
  verifiedPhysicalAchievement: number;
  percentage: number;
  verifiedPercentage: number;
  submittedDate: string | null;
  verifiedDate: string | null;
  completedDate: string | null;
  hasImage: boolean;
  hasVideo: boolean;
  imageCount: number;
  videoCount: number;
  isPendingVerification: boolean;
  noProgressSubmitted: boolean;
  completedMissingDate: boolean;
  pendingAgeDays: number | null;
}

export interface OsdProjectIntelligenceData {
  project: OsdProjectCore;
  metrics: {
    totalIndicators: number;
    verifiedIndicators: number;
    pendingVerification: number;
    completedIndicators: number;
    missingImage: number;
    missingVideo: number;
  };
  indicators: OsdProjectIndicator[];
}

export async function getOsdProjectIntelligence(
  projectId: number,
): Promise<OsdProjectIntelligenceData | null> {
  const projectResult = await db.execute(sql`
    SELECT
      mp.project_id,
      mp.public_id::text AS project_public_id,
      mp.project_code,
      COALESCE(mp.project_name, 'Untitled project') AS project_name,
      mp.project_name_mal,
      mp.description,
      mp.project_outcome,
      COALESCE(mp.project_cost, 0) AS project_cost,
      msf.source_of_funding_name,
      msec.sector_name,
      mp.priority,
      mp.nature_of_project,
      mp.project_execution_type,
      COALESCE(mp.is_completed, 0) AS is_completed,
      mp.completion_date,
      mp.stage,
      COALESCE(mp.no_days_employed_direct, 0) AS no_days_employed_direct,
      COALESCE(mp.no_persons_employed_direct, 0) AS no_persons_employed_direct,
      COALESCE(mp.no_days_employed_indirect, 0) AS no_days_employed_indirect,
      COALESCE(mp.no_persons_employed_indirect, 0) AS no_persons_employed_indirect,
      mp.other_benefits,
      mp.govt_policy_linkage,
      mp.manifesto_linkage,
      mp.extra_one,
      mp.extra_two,
      mp.extra_three
    FROM hdp.master_projects mp
    LEFT JOIN hdp.master_source_of_funding msf
      ON msf.source_of_funding_id = mp.source_of_funding_id
    LEFT JOIN hdp.master_sector msec
      ON msec.sector_id = mp.sector_id
    WHERE mp.project_id = ${projectId}
      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    LIMIT 1
  `);

  const projectRow = projectResult.rows[0] as
    | Record<string, unknown>
    | undefined;
  if (!projectRow) return null;

  const [secretaryResult, departmentResult, indicatorsResult] =
    await Promise.all([
      db.execute(sql`
      SELECT DISTINCT COALESCE(ms.secretary_name, 'Unmapped') AS secretary_name
      FROM hdp.project_secretary ps
      LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
      WHERE ps.project_id = ${projectId}
      ORDER BY COALESCE(ms.secretary_name, 'Unmapped') ASC
    `),
      db.execute(sql`
      SELECT DISTINCT COALESCE(md.dept_name, 'Unmapped') AS dept_name
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      WHERE pd.project_id = ${projectId}
      ORDER BY COALESCE(md.dept_name, 'Unmapped') ASC
    `),
      db.execute(sql`
      SELECT
        i.indicator_id,
        i.public_id::text AS indicator_public_id,
        COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
        md.district_name,
        i.unit,
        COALESCE(i.financial_target, 0) AS financial_target,
        COALESCE(i.physical_target, 0) AS physical_target,
        COALESCE(i.physical_achievement, 0) AS physical_achievement,
        COALESCE(i.verified_physical_achievement, 0) AS verified_physical_achievement,
        COALESCE(i.percentage, 0) AS percentage,
        COALESCE(i.verified_percentage, i.percentage, 0) AS verified_percentage,
        i.submitted_date,
        i.verified_date,
        i.completed_date,
        EXISTS(
          SELECT 1 FROM hdp.gallery g
          WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
        ) AS has_image,
        EXISTS(
          SELECT 1 FROM hdp.gallery g
          WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
        ) AS has_video,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
        ), 0) AS image_count,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
        ), 0) AS video_count,
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
        END AS pending_age_days
      FROM hdp.indicators i
      LEFT JOIN hdp.master_district md ON md.district_id = i.district_id
      WHERE i.project_id = ${projectId}
      ORDER BY indicator_name ASC
    `),
    ]);

  const secretaryNames = secretaryResult.rows.map((row) =>
    String((row as { secretary_name: string }).secretary_name),
  );
  const departmentNames = departmentResult.rows.map((row) =>
    String((row as { dept_name: string }).dept_name),
  );

  const indicators = indicatorsResult.rows.map((row) => {
    const item = row as Record<string, unknown>;
    const submittedDate = item.submitted_date
      ? String(item.submitted_date)
      : null;
    const verifiedDate = item.verified_date ? String(item.verified_date) : null;
    const completedDate = item.completed_date
      ? String(item.completed_date)
      : null;
    return {
      indicatorId: Number(item.indicator_id),
      indicatorPublicId: item.indicator_public_id
        ? String(item.indicator_public_id)
        : null,
      indicatorName: String(item.indicator_name ?? "Untitled indicator"),
      districtName: item.district_name ? String(item.district_name) : null,
      unit: item.unit ? String(item.unit) : null,
      financialTarget: Number(item.financial_target ?? 0),
      physicalTarget: Number(item.physical_target ?? 0),
      physicalAchievement: Number(item.physical_achievement ?? 0),
      verifiedPhysicalAchievement: Number(
        item.verified_physical_achievement ?? 0,
      ),
      percentage: Number(item.percentage ?? 0),
      verifiedPercentage: Number(item.verified_percentage ?? 0),
      submittedDate,
      verifiedDate,
      completedDate,
      hasImage: Boolean(item.has_image),
      hasVideo: Boolean(item.has_video),
      imageCount: Number(item.image_count ?? 0),
      videoCount: Number(item.video_count ?? 0),
      isPendingVerification: Boolean(item.is_pending_verification),
      noProgressSubmitted: Boolean(item.no_progress_submitted),
      completedMissingDate: Boolean(item.completed_missing_date),
      pendingAgeDays:
        item.pending_age_days != null ? Number(item.pending_age_days) : null,
    } satisfies OsdProjectIndicator;
  });

  const metrics = {
    totalIndicators: indicators.length,
    verifiedIndicators: indicators.filter((ind) => ind.verifiedDate != null)
      .length,
    pendingVerification: indicators.filter((ind) => ind.isPendingVerification)
      .length,
    completedIndicators: indicators.filter(
      (ind) => ind.verifiedPercentage >= 100,
    ).length,
    missingImage: indicators.filter((ind) => !ind.hasImage).length,
    missingVideo: indicators.filter((ind) => !ind.hasVideo).length,
  };

  return {
    project: {
      projectId: Number(projectRow.project_id),
      projectPublicId: projectRow.project_public_id
        ? String(projectRow.project_public_id)
        : null,
      projectCode: projectRow.project_code
        ? String(projectRow.project_code)
        : null,
      projectName: String(projectRow.project_name ?? "Untitled project"),
      projectNameMal: projectRow.project_name_mal
        ? String(projectRow.project_name_mal)
        : null,
      description: projectRow.description
        ? String(projectRow.description)
        : null,
      projectOutcome: projectRow.project_outcome
        ? String(projectRow.project_outcome)
        : null,
      projectCost: Number(projectRow.project_cost ?? 0),
      sourceOfFundingName: projectRow.source_of_funding_name
        ? String(projectRow.source_of_funding_name)
        : null,
      sectorName: projectRow.sector_name
        ? String(projectRow.sector_name)
        : null,
      priority:
        projectRow.priority != null ? Number(projectRow.priority) : null,
      natureOfProject:
        projectRow.nature_of_project != null
          ? Number(projectRow.nature_of_project)
          : null,
      projectExecutionType:
        projectRow.project_execution_type != null
          ? Number(projectRow.project_execution_type)
          : null,
      isCompleted: Number(projectRow.is_completed ?? 0),
      completionDate: projectRow.completion_date
        ? String(projectRow.completion_date)
        : null,
      stage: projectRow.stage != null ? Number(projectRow.stage) : null,
      noDaysEmployedDirect: Number(projectRow.no_days_employed_direct ?? 0),
      noPersonsEmployedDirect: Number(
        projectRow.no_persons_employed_direct ?? 0,
      ),
      noDaysEmployedIndirect: Number(projectRow.no_days_employed_indirect ?? 0),
      noPersonsEmployedIndirect: Number(
        projectRow.no_persons_employed_indirect ?? 0,
      ),
      otherBenefits: projectRow.other_benefits
        ? String(projectRow.other_benefits)
        : null,
      govtPolicyLinkage: projectRow.govt_policy_linkage
        ? String(projectRow.govt_policy_linkage)
        : null,
      manifestoLinkage: projectRow.manifesto_linkage
        ? String(projectRow.manifesto_linkage)
        : null,
      extraOne: projectRow.extra_one ? String(projectRow.extra_one) : null,
      extraTwo: projectRow.extra_two ? String(projectRow.extra_two) : null,
      extraThree: projectRow.extra_three
        ? String(projectRow.extra_three)
        : null,
      secretaryNames,
      departmentNames,
    },
    metrics,
    indicators,
  };
}
