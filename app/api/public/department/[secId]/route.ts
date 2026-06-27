/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Public department detail. Returns the department label, headline stats,
// and the full list of projects under that sec_id with their indicator /
// media counts, progress percentages and a derived public status.
//
// Status derivation:
//   master_projects.is_completed = 2 â†’ 'completed'
//   master_projects.is_completed = 1 â†’ 'in-progress'
//   anything else (0 / NULL)         â†’ 'not-started'
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ secId: string }> },
) {
  const { secId } = await params;
  const id = Number(secId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid secId" }, { status: 400 });
  }

  try {
    // ----- 1. Department label + headline stats ---------------------------
    // Use secretary_name_mal as the primary Malayalam label; fall back to
    // English secretary_name only when the Malayalam value is still NULL
    // or blank (safety net for rows the admin hasn't translated yet).
    const head = await db.execute(sql`
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
          SELECT COUNT(DISTINCT mp.project_id)::int
          FROM hdp.master_projects mp
          INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND mp.is_completed = 2
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS completed,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          INNER JOIN hdp.project_secretary ps ON i.project_id = ps.project_id
          WHERE ps.sec_id = ms.sec_id
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS indicators,
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
      WHERE ms.sec_id = ${id}
      LIMIT 1
    `);
    const headRow = head.rows[0] as any;
    if (!headRow) {
      return NextResponse.json(
        { error: "Department not found" },
        { status: 404 },
      );
    }

    // ----- 2. Project list ------------------------------------------------
    // Project names use mp.project_name directly â€” they're already in the
    // right language as entered by the admin (often Malayalam).
    const projectsResult = await db.execute(sql`
      SELECT
        mp.project_id,
        mp.project_code,
        mp.project_name AS project_name,
        COALESCE(mp.project_cost, 0)::numeric AS project_cost,
        mp.is_completed,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          WHERE i.project_id = mp.project_id
        ), 0) AS indicators_total,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          WHERE i.project_id = mp.project_id
            AND i.verified_date IS NOT NULL
            AND COALESCE(i.verified_percentage, 0) >= 100
        ), 0) AS indicators_completed,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          INNER JOIN hdp.indicators i ON g.indicator_id = i.indicator_id
          WHERE i.project_id = mp.project_id
            AND g.gallery_type = 1
            AND COALESCE(g.is_verified, false) = true
        ), 0) AS image_count,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          INNER JOIN hdp.indicators i ON g.indicator_id = i.indicator_id
          WHERE i.project_id = mp.project_id
            AND g.gallery_type = 2
            AND COALESCE(g.is_verified, false) = true
        ), 0) AS video_count,
        COALESCE((
          SELECT AVG(COALESCE(i.verified_percentage, 0))::numeric(5,2)
          FROM hdp.indicators i
          WHERE i.project_id = mp.project_id
            AND i.verified_date IS NOT NULL
        ), 0) AS physical_pct,
        COALESCE((
          SELECT CASE
            WHEN SUM(COALESCE(i.financial_target, 0)) > 0
            THEN (SUM(COALESCE(i.verified_financial_achievement, 0))
                  / SUM(i.financial_target) * 100)::numeric(5,2)
            ELSE 0
          END
          FROM hdp.indicators i
          WHERE i.project_id = mp.project_id
            AND i.verified_date IS NOT NULL
        ), 0) AS financial_pct,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          WHERE i.project_id = mp.project_id
            AND i.verified_date IS NOT NULL
        ), 0) > 0 AS verified
      FROM hdp.master_projects mp
      INNER JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
      WHERE ps.sec_id = ${id}
        AND COALESCE(mp.is_archived, false) = false
      ORDER BY mp.project_id ASC
    `);

    const projects = (projectsResult.rows as Array<any>).map((r) => {
      const isCompleted = Number(r.is_completed) || 0;
      let status: "completed" | "in-progress" | "not-started" = "not-started";
      if (isCompleted === 2) status = "completed";
      else if (isCompleted === 1) status = "in-progress";
      return {
        projectId: Number(r.project_id),
        projectCode: r.project_code ?? null,
        name: r.project_name ?? "",
        costInLakhs: Number(r.project_cost) || 0,
        indicatorsTotal: Number(r.indicators_total) || 0,
        indicatorsCompleted: Number(r.indicators_completed) || 0,
        imageCount: Number(r.image_count) || 0,
        videoCount: Number(r.video_count) || 0,
        physicalPct: Math.round(Number(r.physical_pct) || 0),
        financialPct: Math.round(Number(r.financial_pct) || 0),
        verified: Boolean(r.verified),
        status,
      };
    });

    return NextResponse.json({
      department: {
        secId: Number(headRow.sec_id),
        nameMal: headRow.secretary_name_mal ?? headRow.secretary_name ?? "",
        stats: {
          projects: Number(headRow.projects) || 0,
          completed: Number(headRow.completed) || 0,
          indicators: Number(headRow.indicators) || 0,
          media: Number(headRow.video_count) || 0,
        },
        projects,
      },
    });
  } catch (err) {
    console.error("GET /api/public/department/[secId] failed", err);
    return NextResponse.json(
      { error: "Failed to load department" },
      { status: 500 },
    );
  }
}

