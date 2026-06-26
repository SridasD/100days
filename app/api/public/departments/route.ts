import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// One row per department that has at least one project. Returns project /
// indicator counts, total project cost, physical + financial progress %
// (averages of verified_percentage and financial_achievement/target), media
// counts, and an overall status.
export const runtime = "nodejs";

export async function GET() {
  try {
    const r = await db.execute(sql`
      SELECT
        ms.sec_id,
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

        COALESCE((
          SELECT AVG(COALESCE(i.verified_percentage, 0))::numeric(5,2)
          FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND i.verified_date IS NOT NULL
        ), 0) AS physical_pct,

        COALESCE((
          SELECT
            CASE
              WHEN SUM(COALESCE(i.financial_target, 0)) > 0
              THEN (SUM(COALESCE(i.verified_financial_achievement, 0))
                    / SUM(i.financial_target) * 100)::numeric(5,2)
              ELSE 0
            END
          FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
            AND i.verified_date IS NOT NULL
        ), 0) AS financial_pct,

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

      FROM hdp.master_secretary ms
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
      const financialPct = Number(row.financial_pct) || 0;
      const indicators = Number(row.indicators) || 0;
      // Simple status heuristic:
      //   no indicators yet → not-started
      //   physical 100% AND financial 100% → completed
      //   otherwise → in-progress
      let status: "completed" | "in-progress" | "not-started" = "not-started";
      if (indicators === 0) {
        status = "not-started";
      } else if (physicalPct >= 99.9 && financialPct >= 99.9) {
        status = "completed";
      } else {
        status = "in-progress";
      }
      return {
        secId: Number(row.sec_id),
        nameMal:
          (typeof row.secretary_name_mal === "string" &&
            row.secretary_name_mal) ||
          row.secretary_name ||
          "",
        projects: Number(row.projects) || 0,
        indicators,
        costInLakhs: Number(row.total_cost) || 0,
        physicalPct: Math.round(physicalPct),
        financialPct: Math.round(financialPct),
        status,
        imageCount: Number(row.image_count) || 0,
        videoCount: Number(row.video_count) || 0,
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
