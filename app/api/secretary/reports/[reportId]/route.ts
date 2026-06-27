import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getDefaulterThresholds } from "@/lib/config/defaulter-thresholds";

export const runtime = "nodejs";

type Row = Record<string, unknown>;

function csvEscape(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function toCsv(headers: string[], rows: unknown[][]) {
  const headerLine = headers.map(csvEscape).join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return `${headerLine}\n${body}`;
}

function csvToHtmlTable(csv: string, title: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const cells = lines.map((line) => line.split(","));
  const [header, ...rows] = cells;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    h1 { font-size: 18px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d1d5db; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f3f4f6; }
    @media print { body { margin: 8px; } }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>
      ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n")}
    </tbody>
  </table>
</body>
</html>`;
}

async function reportDepartmentSummary(secId: number) {
  const result = await db.execute(sql`
    WITH dept_projects AS (
      SELECT DISTINCT
        pd.dept_id,
        COALESCE(md.dept_name, 'Unassigned') AS department,
        mp.project_id
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
      INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
      WHERE ps.sec_id = ${secId}
        AND COALESCE(mp.is_archived, false) = false
    )
    SELECT
      dp.department,
      COUNT(DISTINCT dp.project_id)::int AS projects,
      COUNT(i.indicator_id)::int AS indicators,
      COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
      COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
      MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
    FROM dept_projects dp
    LEFT JOIN hdp.indicators i ON i.project_id = dp.project_id
    GROUP BY dp.department
    ORDER BY dp.department ASC
  `);

  const headers = [
    "Department",
    "Projects",
    "Indicators",
    "Physical %",
    "Financial %",
    "Last Updated",
  ];
  const rows = (result.rows as Row[]).map((r) => [
    r.department,
    r.projects,
    r.indicators,
    r.physical_progress,
    r.financial_progress,
    r.last_updated,
  ]);
  return { title: "Department Summary Report", csv: toCsv(headers, rows) };
}

async function reportProjectSummary(secId: number) {
  const result = await db.execute(sql`
    SELECT
      mp.project_code,
      mp.project_name,
      COALESCE(msf.source_of_funding_name, '') AS source_of_funding,
      COALESCE(mp.project_outcome, '') AS project_outcome,
      COALESCE(mp.is_completed, 0) AS is_completed,
      COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
      COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
      COUNT(i.indicator_id)::int AS indicators,
      MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
    FROM hdp.master_projects mp
    INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
    LEFT JOIN hdp.master_source_of_funding msf
      ON msf.source_of_funding_id = mp.source_of_funding_id
    LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
    WHERE ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    GROUP BY mp.project_id, mp.project_code, mp.project_name, COALESCE(mp.is_completed, 0)
    ORDER BY mp.project_name ASC
  `);

  const headers = [
    "Code",
    "Project",
    "Source Of Funding",
    "Project Outcome",
    "Status",
    "Physical %",
    "Financial %",
    "Indicators",
    "Last Updated",
  ];
  const rows = (result.rows as Row[]).map((r) => [
    r.project_code,
    r.project_name,
    r.source_of_funding,
    r.project_outcome,
    Number(r.is_completed) === 2
      ? "completed"
      : Number(r.is_completed) === 1
        ? "in-progress"
        : "not-started",
    r.physical_progress,
    r.financial_progress,
    r.indicators,
    r.last_updated,
  ]);
  return { title: "Project Summary Report", csv: toCsv(headers, rows) };
}

async function reportPhysicalProgress(secId: number) {
  const result = await db.execute(sql`
    SELECT
      mp.project_name,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
      COALESCE(i.verified_date, i.submitted_date) AS last_updated
    FROM hdp.indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
    WHERE ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    ORDER BY mp.project_name ASC, indicator_name ASC
  `);

  const headers = ["Project", "Indicator", "Physical %", "Last Updated"];
  const rows = (result.rows as Row[]).map((r) => [
    r.project_name,
    r.indicator_name,
    r.physical_progress,
    r.last_updated,
  ]);
  return { title: "Physical Progress Report", csv: toCsv(headers, rows) };
}

async function reportFinancialProgress(secId: number) {
  const result = await db.execute(sql`
    SELECT
      mp.project_name,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(i.verified_financial_achievement, i.financial_achievement, 0) AS financial_progress,
      COALESCE(i.verified_date, i.submitted_date) AS last_updated
    FROM hdp.indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
    WHERE ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    ORDER BY mp.project_name ASC, indicator_name ASC
  `);

  const headers = ["Project", "Indicator", "Financial %", "Last Updated"];
  const rows = (result.rows as Row[]).map((r) => [
    r.project_name,
    r.indicator_name,
    r.financial_progress,
    r.last_updated,
  ]);
  return { title: "Financial Progress Report", csv: toCsv(headers, rows) };
}

async function reportIndicators(secId: number) {
  const result = await db.execute(sql`
    SELECT
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(mp.project_name, 'Untitled project') AS project_name,
      COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
      COALESCE(i.verified_financial_achievement, i.financial_achievement, 0) AS financial_progress,
      COALESCE(i.verified_date, i.submitted_date) AS last_updated
    FROM hdp.indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
    WHERE ps.sec_id = ${secId}
      AND COALESCE(mp.is_archived, false) = false
    ORDER BY indicator_name ASC
  `);

  const headers = [
    "Indicator",
    "Project",
    "Physical %",
    "Financial %",
    "Last Updated",
  ];
  const rows = (result.rows as Row[]).map((r) => [
    r.indicator_name,
    r.project_name,
    r.physical_progress,
    r.financial_progress,
    r.last_updated,
  ]);
  return { title: "Indicator Report", csv: toCsv(headers, rows) };
}

async function reportDefaulters(secId: number) {
  const {
    pendingDays,
    inactivityDays,
    indicatorStaleDays: staleDays,
  } = getDefaulterThresholds();

  const result = await db.execute(sql`
    WITH pending_progress AS (
      SELECT
        COALESCE(md.dept_name, 'Unassigned') AS subject,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(COALESCE(i.verified_date, i.submitted_date)))) / 86400)::int AS days,
        'pending_progress' AS category
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
      INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
      LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
      WHERE ps.sec_id = ${secId}
        AND COALESCE(mp.is_archived, false) = false
      GROUP BY COALESCE(md.dept_name, 'Unassigned')
      HAVING MAX(COALESCE(i.verified_date, i.submitted_date)) IS NULL
         OR MAX(COALESCE(i.verified_date, i.submitted_date)) < NOW() - (${pendingDays} * INTERVAL '1 day')
    ),
    no_activity AS (
      SELECT
        COALESCE(md.dept_name, 'Unassigned') AS subject,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(COALESCE(i.verified_date, i.submitted_date)))) / 86400)::int AS days,
        'no_activity' AS category
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
      INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
      LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
      WHERE ps.sec_id = ${secId}
        AND COALESCE(mp.is_archived, false) = false
      GROUP BY COALESCE(md.dept_name, 'Unassigned')
      HAVING MAX(COALESCE(i.verified_date, i.submitted_date)) IS NULL
         OR MAX(COALESCE(i.verified_date, i.submitted_date)) < NOW() - (${inactivityDays} * INTERVAL '1 day')
    ),
    stale_indicators AS (
      SELECT
        COALESCE(i.indicator_name, 'Untitled indicator') AS subject,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(i.submitted_date, i.verified_date))) / 86400)::int AS days,
        'stale_indicator' AS category
      FROM hdp.indicators i
      INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
      INNER JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
      WHERE ps.sec_id = ${secId}
        AND COALESCE(mp.is_archived, false) = false
        AND (
          (i.submitted_date IS NULL AND i.verified_date IS NULL)
          OR COALESCE(i.submitted_date, i.verified_date) < NOW() - (${staleDays} * INTERVAL '1 day')
        )
    )
    SELECT category, subject, COALESCE(days, 0)::int AS days
    FROM pending_progress
    UNION ALL
    SELECT category, subject, COALESCE(days, 0)::int AS days
    FROM no_activity
    UNION ALL
    SELECT category, subject, COALESCE(days, 0)::int AS days
    FROM stale_indicators
    ORDER BY days DESC, category ASC
    LIMIT 200
  `);

  const headers = ["Category", "Subject", "Days"];
  const rows = (result.rows as Row[]).map((r) => [
    r.category,
    r.subject,
    r.days,
  ]);
  return { title: "Defaulters Report", csv: toCsv(headers, rows) };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const sessionOrResponse = await requireSession(req);
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  if (session.roleId !== ROLE.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { reportId } = await params;
  const format = req.nextUrl.searchParams.get("format") ?? "csv";

  if (!["csv", "xlsx", "pdf"].includes(format)) {
    return NextResponse.json(
      { error: "Invalid format. Use csv, xlsx or pdf" },
      { status: 400 },
    );
  }

  try {
    let result: { title: string; csv: string };

    switch (reportId) {
      case "department-summary":
        result = await reportDepartmentSummary(session.secId);
        break;
      case "project-summary":
        result = await reportProjectSummary(session.secId);
        break;
      case "physical-progress":
        result = await reportPhysicalProgress(session.secId);
        break;
      case "financial-progress":
        result = await reportFinancialProgress(session.secId);
        break;
      case "indicator":
        result = await reportIndicators(session.secId);
        break;
      case "defaulters":
        result = await reportDefaulters(session.secId);
        break;
      default:
        return NextResponse.json(
          { error: "Unknown report type" },
          { status: 404 },
        );
    }

    if (format === "pdf") {
      const html = csvToHtmlTable(result.csv, result.title);
      return new NextResponse(html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": `inline; filename="${reportId}-report.html"`,
        },
      });
    }

    const contentType =
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv; charset=utf-8";

    const ext = format === "xlsx" ? "xlsx" : "csv";

    return new NextResponse(result.csv, {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="${reportId}-report.${ext}"`,
      },
    });
  } catch (err) {
    console.error("GET /api/secretary/reports/[reportId] failed", err);
    return NextResponse.json(
      { error: "Failed to generate report" },
      { status: 500 },
    );
  }
}
