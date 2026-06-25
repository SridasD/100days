import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Public project detail. Returns:
//   - project headline (name, code, cost, status, departments)
//   - per-indicator rows with progress + media counts
//   - flat lists of images and embedded videos for a gallery view
//
// Verifier-corrected values are preferred over nodal-submitted ones whenever
// a verified row exists, mirroring how the rest of the public site reads.
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  try {
    // ----- 1. Project headline -------------------------------------------
    const head = await db.execute(sql`
      SELECT
        mp.project_id,
        mp.project_code,
        mp.project_name,
        COALESCE(mp.project_cost, 0)::numeric AS project_cost,
        COALESCE(mp.is_completed, 0) AS is_completed,
        mp.completion_date,
        mp.description,
        COALESCE((
          SELECT STRING_AGG(
            COALESCE(NULLIF(TRIM(ms.secretary_name_mal), ''), ms.secretary_name),
            ', '
            ORDER BY ms.secretary_name
          )
          FROM hdp.project_secretary ps
          LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
          WHERE ps.project_id = mp.project_id
        ), '') AS departments,
        (
          SELECT ps.sec_id FROM hdp.project_secretary ps
          WHERE ps.project_id = mp.project_id
          ORDER BY ps.sec_id ASC LIMIT 1
        ) AS primary_sec_id,
        (
          SELECT COALESCE(NULLIF(TRIM(ms.secretary_name_mal), ''), ms.secretary_name)
          FROM hdp.project_secretary ps
          LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
          WHERE ps.project_id = mp.project_id
          ORDER BY ps.sec_id ASC LIMIT 1
        ) AS primary_dept_name
      FROM hdp.master_projects mp
      WHERE mp.project_id = ${id}
        AND COALESCE(mp.is_archived, false) = false
      LIMIT 1
    `);
    const headRow = head.rows[0] as any;
    if (!headRow) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const isCompleted = Number(headRow.is_completed) || 0;
    let status: "completed" | "in-progress" | "not-started" = "not-started";
    if (isCompleted === 2) status = "completed";
    else if (isCompleted === 1) status = "in-progress";

    // ----- 2. Indicators with progress -----------------------------------
    const inds = await db.execute(sql`
      SELECT
        i.indicator_id,
        i.indicator_name,
        i.unit,
        md.district_name,
        COALESCE(i.physical_target, 0)::numeric AS physical_target,
        COALESCE(i.financial_target, 0)::numeric AS financial_target,
        COALESCE(
          i.verified_physical_achievement,
          i.physical_achievement,
          0
        )::numeric AS physical_achievement,
        COALESCE(
          i.verified_financial_achievement,
          i.financial_achievement,
          0
        )::numeric AS financial_achievement,
        COALESCE(i.verified_percentage, i.percentage, 0)::numeric AS physical_pct,
        COALESCE(i.verified_physical_description, i.physical_description, '')
          AS description,
        i.verified_date,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 1
        ), 0) AS image_count,
        COALESCE((
          SELECT COUNT(*)::int FROM hdp.gallery g
          WHERE g.indicator_id = i.indicator_id AND g.gallery_type = 2
        ), 0) AS video_count
      FROM hdp.indicators i
      LEFT JOIN hdp.master_district md ON i.district_id = md.district_id
      WHERE i.project_id = ${id}
      ORDER BY i.indicator_id ASC
    `);

    const indicators = (inds.rows as Array<any>).map((r) => {
      const physTarget = Number(r.physical_target) || 0;
      const finTarget = Number(r.financial_target) || 0;
      const physAch = Number(r.physical_achievement) || 0;
      const finAch = Number(r.financial_achievement) || 0;
      const physPct =
        physTarget > 0
          ? Math.min(100, Math.round((physAch / physTarget) * 100))
          : Number(r.physical_pct) || 0;
      const finPct =
        finTarget > 0
          ? Math.min(100, Math.round((finAch / finTarget) * 100))
          : 0;
      return {
        indicatorId: Number(r.indicator_id),
        name: r.indicator_name ?? "",
        unit: r.unit ?? "",
        district: r.district_name ?? "—",
        physicalTarget: physTarget,
        physicalAchievement: physAch,
        financialTarget: finTarget,
        financialAchievement: finAch,
        physicalPct: physPct,
        financialPct: finPct,
        description: r.description ?? "",
        verified: Boolean(r.verified_date),
        imageCount: Number(r.image_count) || 0,
        videoCount: Number(r.video_count) || 0,
      };
    });

    // ----- 3. Gallery for the project -----------------------------------
    // Each row joins back to its indicator so the public Gallery tab can
    // group media per-indicator. We sort by indicator id first (so groups
    // stay in indicator-display order) then by upload time within a group.
    const gallery = await db.execute(sql`
      SELECT
        g.gallery_id,
        g.gallery_type,
        g.image_path,
        g.description,
        g.uploaded_on,
        i.indicator_id,
        i.indicator_name
      FROM hdp.gallery g
      INNER JOIN hdp.indicators i ON g.indicator_id = i.indicator_id
      WHERE i.project_id = ${id}
      ORDER BY i.indicator_id ASC, g.uploaded_on DESC
      LIMIT 200
    `);

    const images = (gallery.rows as Array<any>)
      .filter((g) => Number(g.gallery_type) === 1)
      .map((g) => ({
        galleryId: Number(g.gallery_id),
        imagePath: g.image_path,
        description: g.description ?? "",
        uploadedOn: g.uploaded_on,
        indicatorId: Number(g.indicator_id),
        indicatorName: g.indicator_name ?? "",
      }));
    const videos = (gallery.rows as Array<any>)
      .filter((g) => Number(g.gallery_type) === 2)
      .map((g) => ({
        galleryId: Number(g.gallery_id),
        embedSrc: g.image_path, // stores the youtube/embed url
        description: g.description ?? "",
        uploadedOn: g.uploaded_on,
        indicatorId: Number(g.indicator_id),
        indicatorName: g.indicator_name ?? "",
      }));

    // ----- 4. Aggregate progress for the headline -----------------------
    const overallPhysical =
      indicators.length > 0
        ? Math.round(
            indicators.reduce((s, i) => s + i.physicalPct, 0) /
              indicators.length,
          )
        : 0;
    const overallFinancial =
      indicators.length > 0
        ? Math.round(
            indicators.reduce((s, i) => s + i.financialPct, 0) /
              indicators.length,
          )
        : 0;

    return NextResponse.json({
      project: {
        projectId: Number(headRow.project_id),
        projectCode: headRow.project_code ?? null,
        name: headRow.project_name ?? "",
        description: headRow.description ?? "",
        costInLakhs: Number(headRow.project_cost) || 0,
        status,
        completionDate: headRow.completion_date ?? null,
        departments: headRow.departments ?? "",
        primarySecId: headRow.primary_sec_id
          ? Number(headRow.primary_sec_id)
          : null,
        primaryDeptName: headRow.primary_dept_name ?? "",
        overallPhysicalPct: overallPhysical,
        overallFinancialPct: overallFinancial,
        indicators,
        images,
        videos,
      },
    });
  } catch (err) {
    console.error("GET /api/public/project/[projectId] failed", err);
    return NextResponse.json(
      { error: "Failed to load project" },
      { status: 500 },
    );
  }
}
