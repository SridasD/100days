import { sql } from "drizzle-orm";
import { db } from "../client";

/**
 * Get public dashboard summary stats (no auth required).
 *
 * `hdp.master_projects.is_completed` semantics:
 *   0 = Not started
 *   1 = Started (in progress)
 *   2 = Completed
 *
 * NULL is treated as "Not started" so legacy rows that pre-date the column
 * convention still report sensibly.
 */
export async function getPublicDashboardStats() {
  const [projectsResult, indicatorsResult, verifiedResult] = await Promise.all([
    db.execute(sql`
        SELECT
          COUNT(*)::int                                              AS total,
          SUM(CASE WHEN is_completed = 2 THEN 1 ELSE 0 END)::int     AS completed,
          SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END)::int     AS in_progress,
          SUM(CASE WHEN COALESCE(is_completed, 0) = 0 THEN 1 ELSE 0 END)::int
                                                                    AS not_started
        FROM hdp.master_projects
        WHERE COALESCE(is_archived, false) = false
      `),
    db.execute(sql`
        SELECT COUNT(*)::int as count FROM hdp.indicators i
        WHERE EXISTS (
          SELECT 1 FROM hdp.master_projects mp
          WHERE mp.project_id = i.project_id
            AND COALESCE(mp.is_archived, false) = false
        )
      `),
    db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM hdp.indicators i
        WHERE i.verified_date IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM hdp.master_projects mp
            WHERE mp.project_id = i.project_id
              AND COALESCE(mp.is_archived, false) = false
          )
      `),
  ]);

  const p = (projectsResult.rows[0] as any) ?? {};

  return {
    totalProjects: Number(p.total) || 0,
    completedProjects: Number(p.completed) || 0,
    inProgressProjects: Number(p.in_progress) || 0,
    notStartedProjects: Number(p.not_started) || 0,
    totalIndicators: ((indicatorsResult.rows[0] as any)?.count as number) || 0,
    verifiedIndicators: ((verifiedResult.rows[0] as any)?.count as number) || 0,
  };
}

/**
 * Get public progress by district
 */
export async function getPublicDistrictProgress() {
  const result = await db.execute(sql`
    SELECT
      md.district_id,
      md.district_name,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.district_id = md.district_id
          AND EXISTS (
            SELECT 1 FROM hdp.master_projects mp
            WHERE mp.project_id = i.project_id
              AND COALESCE(mp.is_archived, false) = false
          )
      ), 0) AS total_indicators,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.district_id = md.district_id
          AND i.verified_date IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM hdp.master_projects mp
            WHERE mp.project_id = i.project_id
              AND COALESCE(mp.is_archived, false) = false
          )
      ), 0) AS verified_indicators,
      COALESCE((
        SELECT AVG(COALESCE(i.verified_percentage, 0))::numeric(5,2)
        FROM hdp.indicators i
        WHERE i.district_id = md.district_id
          AND EXISTS (
            SELECT 1 FROM hdp.master_projects mp
            WHERE mp.project_id = i.project_id
              AND COALESCE(mp.is_archived, false) = false
          )
      ), 0) AS avg_progress
    FROM hdp.master_district md
    ORDER BY md.district_name ASC
  `);

  return result.rows.map((r: any) => ({
    districtId: r.district_id,
    districtName: r.district_name,
    totalIndicators: r.total_indicators as number,
    verifiedIndicators: r.verified_indicators as number,
    averageProgress: parseFloat(r.avg_progress as string) || 0,
  }));
}

/**
 * Get public progress over time (for charts)
 */
export async function getPublicProgressTimeline() {
  const result = await db.execute(sql`
    SELECT
      DATE(i.submitted_date)::text as date,
      COUNT(*)::int as submitted_count,
      COALESCE(SUM(CASE WHEN i.verified_date IS NOT NULL THEN 1 ELSE 0 END)::int, 0) as verified_count
    FROM hdp.indicators i
    WHERE i.submitted_date IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM hdp.master_projects mp
        WHERE mp.project_id = i.project_id
          AND COALESCE(mp.is_archived, false) = false
      )
    GROUP BY DATE(i.submitted_date)
    ORDER BY DATE(i.submitted_date) DESC
    LIMIT 90
  `);

  return result.rows.map((r: any) => ({
    date: r.date,
    submitted: r.submitted_count as number,
    verified: r.verified_count as number,
  }));
}

/**
 * Get top projects by verification progress
 */
export async function getTopProjects(limit: number = 10) {
  // A project linked to N departments via project_secretary produced N
  // duplicate rows under the old JOIN, breaking React with
  // "two children with the same key" on the homepage. Aggregate the
  // department names via a correlated STRING_AGG and drop the JOIN — each
  // project_id now appears exactly once.
  const result = await db.execute(sql`
    SELECT
      mp.project_id,
      mp.project_code,
      mp.project_name,
      COALESCE(
        (
          SELECT STRING_AGG(ms.secretary_name, ', ' ORDER BY ms.secretary_name)
          FROM hdp.project_secretary ps
          LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
          WHERE ps.project_id = mp.project_id
        ),
        '—'
      ) AS secretary_name,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS total_indicators,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id AND i.verified_date IS NOT NULL
      ), 0) AS verified_indicators,
      COALESCE((
        SELECT AVG(COALESCE(i.verified_percentage, 0))::numeric(5,2)
        FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS avg_progress
    FROM hdp.master_projects mp
    WHERE COALESCE(mp.is_archived, false) = false
    ORDER BY verified_indicators DESC, avg_progress DESC
    LIMIT ${limit}
  `);

  return result.rows.map((r: any) => ({
    projectId: r.project_id,
    projectCode: r.project_code,
    projectName: r.project_name,
    secretaryName: r.secretary_name,
    totalIndicators: r.total_indicators as number,
    verifiedIndicators: r.verified_indicators as number,
    averageProgress: parseFloat(r.avg_progress as string) || 0,
  }));
}
