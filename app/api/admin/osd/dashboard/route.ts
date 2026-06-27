/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  requireOsdAdminSession,
  isAdminSession,
} from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireOsdAdminSession(req);
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const [
      statsResult,
      departmentResult,
      sectorResult,
      districtResult,
      verificationResult,
      employmentResult,
      recentResult,
      riskResult,
      verificationTrendResult,
      employmentDistrictResult,
      employmentTrendResult,
    ] = await Promise.all([
      db.execute(sql`
                SELECT
                  COUNT(DISTINCT mp.project_id)::int AS total_projects,
                  COUNT(DISTINCT CASE WHEN COALESCE(mp.is_completed, 0) = 1 THEN mp.project_id END)::int AS active_projects,
                  COUNT(DISTINCT CASE WHEN mp.is_completed = 2 THEN mp.project_id END)::int AS completed_projects,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_achievement,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_achievement,
                  COUNT(DISTINCT CASE WHEN i.submitted_date IS NOT NULL AND i.verified_date IS NULL THEN i.indicator_id END)::int AS pending_verification,
                  COUNT(DISTINCT i.indicator_id)::int AS total_indicators
                FROM hdp.master_projects mp
                LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
                WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
            `),
      db.execute(sql`
                SELECT
                  COALESCE(ms.secretary_name, 'Unassigned') AS department_name,
                  COUNT(DISTINCT mp.project_id)::int AS project_count,
                  COUNT(DISTINCT CASE WHEN mp.is_completed = 2 THEN mp.project_id END)::int AS completed_projects,
                  COUNT(DISTINCT CASE WHEN i.submitted_date IS NOT NULL AND i.verified_date IS NULL THEN i.indicator_id END)::int AS pending_verification,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_achievement,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_achievement,
                  ROUND(
                    (
                      COALESCE(AVG(COALESCE(i.verified_percentage, i.percentage, 0)), 0) * 0.45
                    ) + (
                      COALESCE(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0)), 0) * 0.35
                    ) + (
                      CASE WHEN COUNT(DISTINCT mp.project_id) = 0 THEN 0 ELSE (COUNT(DISTINCT CASE WHEN mp.is_completed = 2 THEN mp.project_id END)::numeric / COUNT(DISTINCT mp.project_id)) * 100 END * 0.20
                    ),
                    1
                  ) AS composite_score
                FROM hdp.master_projects mp
                LEFT JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
                LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
                LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
                WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                GROUP BY COALESCE(ms.secretary_name, 'Unassigned')
                ORDER BY composite_score DESC, project_count DESC, department_name ASC
            `),
      db.execute(sql`
                SELECT
                  COALESCE(ms.sector_name, 'Others') AS sector_name,
                  COUNT(DISTINCT mp.project_id)::int AS project_count,
                  COUNT(DISTINCT CASE WHEN mp.is_completed = 2 THEN mp.project_id END)::int AS completed_projects,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS achievement
                FROM hdp.master_projects mp
                LEFT JOIN hdp.master_sector ms ON ms.sector_id = mp.sector_id
                LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
                WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                GROUP BY COALESCE(ms.sector_name, 'Others')
                ORDER BY project_count DESC, achievement DESC, sector_name ASC
            `),
      db.execute(sql`
                SELECT
                  md.district_id,
                  COALESCE(md.district_name, 'Unknown') AS district_name,
                  COUNT(DISTINCT mp.project_id)::int AS total_projects,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_achievement,
                  COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_achievement,
                  COUNT(DISTINCT CASE WHEN i.submitted_date IS NOT NULL AND i.verified_date IS NULL THEN i.indicator_id END)::int AS pending_verification
                FROM hdp.master_district md
                LEFT JOIN hdp.indicators i ON i.district_id = md.district_id
                  AND EXISTS (
                    SELECT 1 FROM hdp.master_projects mp2
                    WHERE mp2.project_id = i.project_id
                      AND COALESCE((to_jsonb(mp2)->>'is_archived')::boolean, false) = false
                  )
                LEFT JOIN hdp.master_projects mp ON mp.project_id = i.project_id
                  AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                GROUP BY md.district_id, COALESCE(md.district_name, 'Unknown')
                ORDER BY physical_achievement DESC, total_projects DESC, district_name ASC
            `),
      db.execute(sql`
                SELECT
                  COALESCE(ms.secretary_name, 'Unassigned') AS department_name,
                  COUNT(*)::int AS pending_count,
                  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - i.submitted_date)) / 86400)::numeric, 1), 0) AS average_age_days
                FROM hdp.indicators i
                LEFT JOIN hdp.master_projects mp ON mp.project_id = i.project_id
                  AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                LEFT JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
                LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
                WHERE i.submitted_date IS NOT NULL
                  AND i.verified_date IS NULL
                  AND mp.project_id IS NOT NULL
                GROUP BY COALESCE(ms.secretary_name, 'Unassigned')
                ORDER BY pending_count DESC, average_age_days DESC, department_name ASC
                LIMIT 8
            `),
      db.execute(sql`
                SELECT
                  COALESCE(SUM(COALESCE(mp.no_persons_employed_direct, 0))::int, 0) AS direct_persons,
                  COALESCE(SUM(COALESCE(mp.no_persons_employed_indirect, 0))::int, 0) AS indirect_persons,
                  COALESCE(SUM(COALESCE(mp.no_days_employed_direct, 0))::int, 0) AS direct_days,
                  COALESCE(SUM(COALESCE(mp.no_days_employed_indirect, 0))::int, 0) AS indirect_days
                FROM hdp.master_projects mp
                WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
            `),
      db.execute(sql`
                SELECT
                  COALESCE(mp.project_name, i.indicator_name, 'Untitled project') AS project_name,
                  COALESCE(ms.secretary_name, 'Unassigned') AS department_name,
                  COALESCE(md.district_name, 'Unknown') AS district_name,
                  COALESCE(i.verified_percentage, i.percentage, 0) AS progress,
                  i.verified_date
                FROM hdp.indicators i
                LEFT JOIN hdp.master_projects mp ON mp.project_id = i.project_id
                  AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                LEFT JOIN hdp.master_district md ON md.district_id = i.district_id
                LEFT JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
                LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
                WHERE i.verified_date IS NOT NULL
                  AND mp.project_id IS NOT NULL
                ORDER BY i.verified_date DESC
                LIMIT 6
            `),
      db.execute(sql`
                WITH per_project AS (
                  SELECT
                    mp.project_id,
                    COALESCE(AVG(COALESCE(i.verified_percentage, i.percentage, 0)), 0) AS avg_progress,
                    COUNT(*) FILTER (WHERE i.submitted_date IS NOT NULL AND i.verified_date IS NULL) AS pending_count,
                    COALESCE(MAX(EXTRACT(EPOCH FROM (NOW() - i.submitted_date)) / 86400), 0) AS max_pending_age_days
                  FROM hdp.master_projects mp
                  LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
                  WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                  GROUP BY mp.project_id
                )
                SELECT
                  COUNT(*) FILTER (WHERE avg_progress < 45 OR pending_count > 0)::int AS projects_at_risk,
                  COUNT(*) FILTER (WHERE pending_count > 0 AND max_pending_age_days > 7)::int AS delayed_projects
                FROM per_project
            `),
      db.execute(sql`
                SELECT
                  COUNT(*) FILTER (WHERE i.verified_date >= NOW() - INTERVAL '7 days')::int AS verified_last_7,
                  COUNT(*) FILTER (
                    WHERE i.verified_date < NOW() - INTERVAL '7 days'
                      AND i.verified_date >= NOW() - INTERVAL '14 days'
                  )::int AS verified_prev_7
                FROM hdp.indicators i
                WHERE i.verified_date IS NOT NULL
                  AND EXISTS (
                    SELECT 1 FROM hdp.master_projects mp
                    WHERE mp.project_id = i.project_id
                      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                  )
            `),
      db.execute(sql`
                SELECT
                  md.district_id,
                  COALESCE(md.district_name, 'Unknown') AS district_name,
                  COALESCE(
                    SUM(
                      COALESCE(i.verified_achieved_no_persons_employed_direct, i.achieved_no_persons_employed_direct, 0) +
                      COALESCE(i.verified_achieved_no_persons_employed_indirect, i.achieved_no_persons_employed_indirect, 0)
                    )::int,
                    0
                  ) AS employment_persons
                FROM hdp.master_district md
                LEFT JOIN hdp.indicators i ON i.district_id = md.district_id
                  AND EXISTS (
                    SELECT 1 FROM hdp.master_projects mp
                    WHERE mp.project_id = i.project_id
                      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                  )
                GROUP BY md.district_id, COALESCE(md.district_name, 'Unknown')
                ORDER BY employment_persons DESC, district_name ASC
                LIMIT 8
            `),
      db.execute(sql`
                SELECT
                  DATE_TRUNC('month', COALESCE(i.verified_date, i.submitted_date))::date AS month_start,
                  TO_CHAR(DATE_TRUNC('month', COALESCE(i.verified_date, i.submitted_date)), 'Mon YYYY') AS month_label,
                  COALESCE(
                    SUM(
                      COALESCE(i.verified_achieved_no_persons_employed_direct, i.achieved_no_persons_employed_direct, 0) +
                      COALESCE(i.verified_achieved_no_persons_employed_indirect, i.achieved_no_persons_employed_indirect, 0)
                    )::int,
                    0
                  ) AS employment_persons
                FROM hdp.indicators i
                WHERE COALESCE(i.verified_date, i.submitted_date) >= DATE_TRUNC('month', NOW()) - INTERVAL '5 months'
                  AND EXISTS (
                    SELECT 1 FROM hdp.master_projects mp
                    WHERE mp.project_id = i.project_id
                      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
                  )
                GROUP BY DATE_TRUNC('month', COALESCE(i.verified_date, i.submitted_date))
                ORDER BY month_start ASC
            `),
    ]);

    const stats = (statsResult.rows[0] as any) ?? {};
    const employment = (employmentResult.rows[0] as any) ?? {};
    const risk = (riskResult.rows[0] as any) ?? {};
    const verificationTrend = (verificationTrendResult.rows[0] as any) ?? {};

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats: {
        totalProjects: Number(stats.total_projects) || 0,
        activeProjects: Number(stats.active_projects) || 0,
        completedProjects: Number(stats.completed_projects) || 0,
        physicalAchievement: Number(stats.physical_achievement) || 0,
        financialAchievement: Number(stats.financial_achievement) || 0,
        employmentGenerated:
          (Number(employment.direct_persons) || 0) +
          (Number(employment.indirect_persons) || 0),
        pendingVerification: Number(stats.pending_verification) || 0,
        totalIndicators: Number(stats.total_indicators) || 0,
      },
      riskSignals: {
        projectsAtRisk: Number(risk.projects_at_risk) || 0,
        delayedProjects: Number(risk.delayed_projects) || 0,
        verifiedLast7: Number(verificationTrend.verified_last_7) || 0,
        verifiedPrev7: Number(verificationTrend.verified_prev_7) || 0,
      },
      departmentRanking: departmentResult.rows,
      sectorPerformance: sectorResult.rows,
      districtRanking: districtResult.rows,
      verificationMonitoring: {
        pendingQueue: verificationResult.rows,
      },
      employment: {
        summary: employment,
        recentVerified: recentResult.rows,
        byDistrict: employmentDistrictResult.rows,
        trend: employmentTrendResult.rows,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/osd/dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load OSD dashboard data" },
      { status: 500 },
    );
  }
}

