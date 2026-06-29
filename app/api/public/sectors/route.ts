/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Public sector listing for the home-page sector grid.
// Joins each sector to:
//   - master_projects (sector_id) â†’ projects count
//   - indicators via projects â†’ indicators count
// Status is derived in this order:
//   - all projects completed â†’ completed
//   - any project in progress (is_completed = 1) â†’ in-progress
//   - otherwise â†’ not-started
//
// `sector_name_mal` is the Malayalam label if the column exists, falling
// back to the English `sector_name`. `sector_img_path` is the file name
// stored in hdp.master_sector and resolved by the UI to
// `/images/sector_images/<sector_img_path>`.
export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await db.execute(sql`
      SELECT
        ms.sector_id,
        ms.public_id,
        ms.sector_name,
        ms.sector_img_path,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.master_projects mp
          WHERE mp.sector_id = ms.sector_id
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS projects,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.master_projects mp
          WHERE mp.sector_id = ms.sector_id
            AND COALESCE(mp.is_archived, false) = false
            AND COALESCE(mp.is_completed, 0) = 2
        ), 0) AS projects_completed,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.master_projects mp
          WHERE mp.sector_id = ms.sector_id
            AND COALESCE(mp.is_archived, false) = false
            AND COALESCE(mp.is_completed, 0) = 1
        ), 0) AS projects_in_progress,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          WHERE mp.sector_id = ms.sector_id
            AND COALESCE(mp.is_archived, false) = false
        ), 0) AS indicators,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          WHERE mp.sector_id = ms.sector_id
            AND COALESCE(mp.is_archived, false) = false
            AND i.submitted_date IS NOT NULL
        ), 0) AS submitted,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.indicators i
          INNER JOIN hdp.master_projects mp ON i.project_id = mp.project_id
          WHERE mp.sector_id = ms.sector_id
            AND COALESCE(mp.is_archived, false) = false
            AND i.verified_date IS NOT NULL
            AND COALESCE(i.verified_percentage, 0) >= 100
        ), 0) AS verified_complete
      FROM hdp.master_sector ms
      ORDER BY ms.sector_id ASC
    `);

    const sectors = (result.rows as Array<any>).map((r) => {
      const projects = Number(r.projects) || 0;
      const projectsCompleted = Number(r.projects_completed) || 0;
      const projectsInProgress = Number(r.projects_in_progress) || 0;
      const indicators = Number(r.indicators) || 0;
      const verifiedComplete = Number(r.verified_complete) || 0;
      const submitted = Number(r.submitted) || 0;
      let status: "completed" | "in-progress" | "not-started" = "not-started";
      if (projects > 0 && projectsCompleted >= projects) {
        status = "completed";
      } else if (projectsInProgress > 0) {
        status = "in-progress";
      }
      return {
        sectorId: Number(r.sector_id),
        sectorPublicId: r.public_id ? String(r.public_id) : String(r.sector_id),
        sectorName: r.sector_name ?? "",
        imagePath: r.sector_img_path
          ? `/images/sector_images/${r.sector_img_path}`
          : null,
        projects,
        indicators,
        status,
      };
    });

    return NextResponse.json({ sectors });
  } catch (err) {
    console.error("GET /api/public/sectors failed", err);
    return NextResponse.json(
      { error: "Failed to load sectors" },
      { status: 500 },
    );
  }
}
