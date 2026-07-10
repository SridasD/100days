import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { resolveDistrictId } from "@/lib/db/public-id";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ district_id: string }> },
) {
  const { district_id } = await params;
  const districtId = await resolveDistrictId(district_id);
  if (!districtId) {
    return NextResponse.json({ error: "Invalid district ID" }, { status: 400 });
  }

  try {
    // Get district name
    const districtResult = await db.execute(sql`
      SELECT district_name FROM hdp.master_district
      WHERE district_id = ${districtId} LIMIT 1
    `);
    const districtRow = districtResult.rows[0] as
      | { district_name: string | null }
      | undefined;
    const districtName = districtRow?.district_name;
    if (!districtName) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 },
      );
    }

    // Get indicators for district
    const indicatorsResult = await db.execute(sql`
      SELECT
        i.indicator_id,
        mp.project_name,
        i.indicator_name,
        i.physical_target,
        COALESCE(i.verified_physical_achievement, 0) AS physical_achievement,
        COALESCE(i.verified_percentage, 0) AS percentage,
        i.verified_percentage,
        i.verified_date,
        i.submitted_date
      FROM hdp.indicators i
      JOIN hdp.master_projects mp ON i.project_id = mp.project_id
      WHERE i.district_id = ${districtId}
        AND COALESCE(mp.is_archived, false) = false
        AND i.verified_date IS NOT NULL
      ORDER BY mp.project_name, i.indicator_name
    `);

    return NextResponse.json({
      districtName,
      indicators: indicatorsResult.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          indicatorId: Number(r.indicator_id),
          projectName: String(r.project_name ?? ""),
          indicatorName: String(r.indicator_name ?? ""),
          physicalTarget: Number(r.physical_target) || 0,
          physicalAchievement: Number(r.physical_achievement) || 0,
          percentage: Number(r.percentage) || 0,
          verifiedPercentage: Number(r.verified_percentage) || 0,
          verifiedDate: r.verified_date ?? null,
          submittedDate: r.submitted_date ?? null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/public/district/[id] failed", err);
    return NextResponse.json(
      { error: "Failed to load district data" },
      { status: 500 },
    );
  }
}
