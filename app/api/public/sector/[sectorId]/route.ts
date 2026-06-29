/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { resolveSectorId } from "@/lib/db/public-id";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sectorId: string }> },
) {
  const { sectorId } = await params;
  const id = await resolveSectorId(sectorId);
  if (!id) {
    return NextResponse.json({ error: "Invalid sectorId" }, { status: 400 });
  }

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
      WHERE ms.sector_id = ${id}
      LIMIT 1
    `);

    const row = result.rows[0] as any;
    if (!row) {
      return NextResponse.json({ error: "Sector not found" }, { status: 404 });
    }

    const projects = Number(row.projects) || 0;
    const projectsCompleted = Number(row.projects_completed) || 0;
    const projectsInProgress = Number(row.projects_in_progress) || 0;
    const indicators = Number(row.indicators) || 0;
    const verifiedComplete = Number(row.verified_complete) || 0;
    const submitted = Number(row.submitted) || 0;
    let status: "completed" | "in-progress" | "not-started" = "not-started";
    if (projects > 0 && projectsCompleted >= projects) {
      status = "completed";
    } else if (projectsInProgress > 0) {
      status = "in-progress";
    }

    return NextResponse.json({
      sector: {
        sectorId: Number(row.sector_id),
        sectorPublicId: row.public_id
          ? String(row.public_id)
          : String(row.sector_id),
        sectorName: row.sector_name ?? "",
        imagePath: row.sector_img_path
          ? `/images/sector_images/${row.sector_img_path}`
          : null,
        projects,
        indicators,
        status,
      },
    });
  } catch (err) {
    console.error("GET /api/public/sector/[sectorId] failed", err);
    return NextResponse.json(
      { error: "Failed to load sector" },
      { status: 500 },
    );
  }
}
