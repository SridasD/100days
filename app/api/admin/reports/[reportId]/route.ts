import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdminSession, isAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

/**
 * Generate CSV content for reports
 */
async function generateSummaryReportCSV() {
  const result = await db.execute(sql`
    SELECT
      'Summary Report' as report_type,
        (SELECT COUNT(*) FROM hdp.master_projects WHERE COALESCE(is_archived, false) = false) as total_projects,
        (SELECT COUNT(*) FROM hdp.master_projects WHERE is_completed = 1 AND COALESCE(is_archived, false) = false) as completed_projects,
      (SELECT COUNT(*) FROM hdp.indicators i
        WHERE EXISTS (
          SELECT 1 FROM hdp.master_projects mp
          WHERE mp.project_id = i.project_id
            AND COALESCE(mp.is_archived, false) = false
        )) as total_indicators,
      (SELECT COUNT(*) FROM hdp.indicators i
        WHERE i.verified_date IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM hdp.master_projects mp
            WHERE mp.project_id = i.project_id
              AND COALESCE(mp.is_archived, false) = false
          )) as verified_indicators
  `);

  const row = (result.rows[0] as Record<string, unknown> | undefined) ?? {};
  const headers = [
    "Report Type",
    "Total Projects",
    "Completed Projects",
    "Total Indicators",
    "Verified Indicators",
  ];
  const data = [
    row.report_type,
    row.total_projects,
    row.completed_projects,
    row.total_indicators,
    row.verified_indicators,
  ];

  return [headers, data].map((r) => r.join(",")).join("\n");
}

/**
 * Generate CSV content for department-wise report
 */
async function generateDepartmentWiseReportCSV() {
  const result = await db.execute(sql`
    SELECT
      ms.secretary_name,
      COUNT(DISTINCT mp.project_id) as project_count,
      COUNT(DISTINCT i.indicator_id) as indicator_count,
      COALESCE(SUM(CASE WHEN i.verified_date IS NOT NULL THEN 1 ELSE 0 END), 0) as verified_indicators
    FROM hdp.master_secretary ms
    LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id
    LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id
    LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id
    WHERE ms.is_used = true
        AND (mp.project_id IS NULL OR COALESCE(mp.is_archived, false) = false)
    GROUP BY ms.sec_id, ms.secretary_name
    ORDER BY ms.secretary_name
  `);

  const headers = [
    "Secretary",
    "Projects",
    "Indicators",
    "Verified Indicators",
  ];
  const rows = result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return [
      String(r.secretary_name ?? "Unknown"),
      Number(r.project_count ?? 0),
      Number(r.indicator_count ?? 0),
      Number(r.verified_indicators ?? 0),
    ];
  });

  return [headers, ...rows].map((r) => r.join(",")).join("\n");
}

/**
 * Generate CSV content for completed projects report
 */
async function generateCompletedProjectsReportCSV() {
  const result = await db.execute(sql`
    SELECT
      mp.project_code,
      mp.project_name,
      ms.secretary_name,
      COUNT(i.indicator_id) as indicator_count,
      COALESCE(SUM(CASE WHEN i.verified_date IS NOT NULL THEN 1 ELSE 0 END), 0) as verified_indicators,
      mp.project_cost
    FROM hdp.master_projects mp
    LEFT JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
    LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id
    WHERE mp.is_completed = 1
        AND COALESCE(mp.is_archived, false) = false
    GROUP BY mp.project_id, mp.project_code, mp.project_name, ms.secretary_name, mp.project_cost
    ORDER BY mp.project_name
  `);

  const headers = [
    "Code",
    "Project Name",
    "Secretary",
    "Indicators",
    "Verified",
    "Cost",
  ];
  const rows = result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return [
      String(r.project_code ?? ""),
      String(r.project_name ?? ""),
      String(r.secretary_name ?? ""),
      Number(r.indicator_count ?? 0),
      Number(r.verified_indicators ?? 0),
      String(r.project_cost ?? ""),
    ];
  });

  return [headers, ...rows].map((r) => r.join(",")).join("\n");
}

/**
 * Generate CSV content for district-based report
 */
async function generateDistrictBasedReportCSV() {
  const result = await db.execute(sql`
    SELECT
      md.district_name,
      COUNT(DISTINCT i.indicator_id) as indicator_count,
      COALESCE(SUM(CASE WHEN i.verified_date IS NOT NULL THEN 1 ELSE 0 END), 0) as verified_indicators,
      COALESCE(AVG(COALESCE(i.verified_percentage, 0))::numeric(5,2), 0) as avg_progress
    FROM hdp.master_district md
    LEFT JOIN hdp.indicators i ON md.district_id = i.district_id
    GROUP BY md.district_id, md.district_name
    ORDER BY md.district_name
  `);

  const headers = ["District", "Indicators", "Verified", "Avg Progress %"];
  const rows = result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return [
      String(r.district_name ?? ""),
      Number(r.indicator_count ?? 0),
      Number(r.verified_indicators ?? 0),
      Number(r.avg_progress ?? 0).toFixed(2),
    ];
  });

  return [headers, ...rows].map((r) => r.join(",")).join("\n");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { reportId } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  if (!["csv", "xlsx"].includes(format)) {
    return NextResponse.json(
      { error: "Invalid format. Use csv or xlsx" },
      { status: 400 },
    );
  }

  try {
    let csv: string;

    switch (reportId) {
      case "summary":
        csv = await generateSummaryReportCSV();
        break;
      case "department":
        csv = await generateDepartmentWiseReportCSV();
        break;
      case "completed":
        csv = await generateCompletedProjectsReportCSV();
        break;
      case "district":
        csv = await generateDistrictBasedReportCSV();
        break;
      default:
        return NextResponse.json(
          { error: "Unknown report type" },
          { status: 404 },
        );
    }

    if (format === "csv") {
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${reportId}-report.csv"`,
        },
      });
    } else {
      // For now, just return CSV even if XLSX is requested
      // In production, use a library like exceljs to generate XLSX
      return new NextResponse(csv, {
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${reportId}-report.xlsx"`,
        },
      });
    }
  } catch (err) {
    console.error("GET /api/admin/reports/[reportId] failed", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
