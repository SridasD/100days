/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// One row per department that has at least one project. Returns project /
// indicator counts, total project cost, physical + financial progress %, media
// counts, and an overall status.
// Physical %: average of each project's own physical % (avg of its indicators'
// verified_percentage, unverified/no-progress indicators counting as 0), every
// project weighted equally. Financial %: sum of verified_financial_achievement
// across projects with a recorded project_cost > 0, divided by the sum of those
// project_cost values — never an average of per-indicator percentages. financialPct
// is null when no project in the department has a usable cost.
export const runtime = "nodejs";

export async function GET() {
  try {
    const r = await db.execute(sql`
      WITH dept_projects AS (
        SELECT ms.sec_id, mp.project_id, COALESCE(mp.project_cost, 0) AS project_cost
        FROM hdp.master_secretary ms
        INNER JOIN hdp.project_secretary ps ON ps.sec_id = ms.sec_id
        INNER JOIN hdp.master_projects mp ON mp.project_id = ps.project_id
        WHERE COALESCE(mp.is_archived, false) = false
      ),
      project_rollup AS (
        SELECT
          dp.sec_id,
          dp.project_id,
          dp.project_cost,
          COALESCE(AVG(COALESCE(i.verified_percentage, 0)), 0) AS project_physical_pct,
          COALESCE(SUM(COALESCE(i.verified_financial_achievement, 0)), 0) AS project_achievement
        FROM dept_projects dp
        LEFT JOIN hdp.indicators i ON i.project_id = dp.project_id
        GROUP BY dp.sec_id, dp.project_id, dp.project_cost
      ),
      dept_rollup AS (
        SELECT
          sec_id,
          COALESCE(AVG(project_physical_pct), 0) AS physical_pct,
          CASE
            WHEN SUM(project_cost) FILTER (WHERE project_cost > 0) > 0
            THEN (SUM(project_achievement) FILTER (WHERE project_cost > 0)
                  / SUM(project_cost) FILTER (WHERE project_cost > 0) * 100)
            ELSE NULL
          END AS financial_pct
        FROM project_rollup
        GROUP BY sec_id
      )
      SELECT
        ms.sec_id,
        ms.public_id,
        ms.secretary_name,
        COALESCE(NULLIF(TRIM(ms.secretary_name_mal), ''), ms.secretary_name)
          AS secretary_name_mal,

        COALESCE((
          SELECT COUNT(DISTINCT mp.project_id)::int
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS projects,

        COALESCE((
          SELECT COUNT(DISTINCT mp.project_id)::int
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND COALESCE(mp.is_completed, 0) = 2
        ), 0) AS projects_completed,

        COALESCE((
          SELECT COUNT(DISTINCT mp.project_id)::int
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND COALESCE(mp.is_completed, 0) = 1
        ), 0) AS projects_in_progress,

        COALESCE((
          SELECT COUNT(*)::int
          FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS indicators,

        COALESCE((
          SELECT SUM(mp.project_cost)::numeric
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS total_cost,

        COALESCE(dr.physical_pct, 0)::numeric(5,2) AS physical_pct,
        dr.financial_pct::numeric(5,2) AS financial_pct,

        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          INNER JOIN hdp.indicators i ON g.indicator_id = i.indicator_id
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND g.gallery_type = 1
            AND COALESCE(g.is_verified, false) = true
        ), 0) AS image_count,

        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          INNER JOIN hdp.indicators i ON g.indicator_id = i.indicator_id
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND g.gallery_type = 2
            AND COALESCE(g.is_verified, false) = true
        ), 0) AS video_count

        ,COALESCE((
          SELECT COUNT(*)::int FROM hdp.documents d
          INNER JOIN hdp.indicators i ON d.indicator_id = i.indicator_id
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND d.verified_date IS NOT NULL
        ), 0) AS document_count

      FROM hdp.master_secretary ms
      LEFT JOIN dept_rollup dr ON dr.sec_id = ms.sec_id
      WHERE EXISTS (
        SELECT 1 FROM hdp.project_secretary ps
        INNER JOIN hdp.master_projects mp ON mp.project_id = ps.project_id
        WHERE ps.sec_id = ms.sec_id
          AND COALESCE(mp.is_archived, false) = false
      )
      ORDER BY ms.secretary_name ASC
    `);

    const departments = (r.rows as Array<any>).map((row) => {
      const physicalPct = Number(row.physical_pct) || 0;
      const financialPct =
        row.financial_pct == null ? null : Number(row.financial_pct);
      const projects = Number(row.projects) || 0;
      const projectsCompleted = Number(row.projects_completed) || 0;
      const projectsInProgress = Number(row.projects_in_progress) || 0;
      const indicators = Number(row.indicators) || 0;
      // Status derivation based on project state:
      //   all projects completed â†’ completed
      //   any project in progress â†’ in-progress
      //   otherwise â†’ not-started
      let status: "completed" | "in-progress" | "not-started" = "not-started";
      if (projects > 0 && projectsCompleted >= projects) {
        status = "completed";
      } else if (projectsInProgress > 0) {
        status = "in-progress";
      } else {
        status = "not-started";
      }
      return {
        secId: Number(row.sec_id),
        departmentPublicId: row.public_id
          ? String(row.public_id)
          : String(row.sec_id),
        nameMal:
          (typeof row.secretary_name_mal === "string" &&
            row.secretary_name_mal) ||
          row.secretary_name ||
          "",
        nameEn: row.secretary_name || "",
        projects,
        projectsCompleted,
        indicators,
        costInLakhs: Number(row.total_cost) || 0,
        physicalPct: Math.round(physicalPct),
        financialPct: financialPct === null ? null : Math.round(financialPct),
        status,
        imageCount: Number(row.image_count) || 0,
        videoCount: Number(row.video_count) || 0,
        documentCount: Number(row.document_count) || 0,
      };
    });

    return NextResponse.json({ departments });
  } catch (err) {
    console.error("GET /api/public/departments failed", err);
    return NextResponse.json(
      { error: "Failed to load departments" },
      { status: 500 },
    );
  }
}
