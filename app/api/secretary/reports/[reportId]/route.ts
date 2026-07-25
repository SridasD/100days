import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getDefaulterThresholds } from "@/lib/config/defaulter-thresholds";

export const runtime = "nodejs";

type Row = Record<string, unknown>;
type ReportResult = {
  title: string;
  headers: string[];
  rows: unknown[][];
  csv: string;
};

const REPORT_GOV_HEADING = "കേരള സർക്കാർ | 100 ദിന പദ്ധതികൾ";

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

function buildReport(
  title: string,
  headers: string[],
  rows: unknown[][],
): ReportResult {
  return {
    title,
    headers,
    rows,
    csv: toCsv(headers, rows),
  };
}

function asCellValue(value: unknown): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

function asDisplayDate(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Kolkata",
  }).format(value);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function toXlsxBuffer(result: ReportResult) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  const maxColumns = Math.max(result.headers.length, 1);
  const tableHeaderRowNumber = 5;

  sheet.mergeCells(1, 1, 1, maxColumns);
  sheet.getCell(1, 1).value = REPORT_GOV_HEADING;
  sheet.getCell(1, 1).font = { bold: true, size: 14 };

  sheet.mergeCells(2, 1, 2, maxColumns);
  sheet.getCell(2, 1).value = result.title;
  sheet.getCell(2, 1).font = { bold: true, size: 12 };

  sheet.mergeCells(3, 1, 3, maxColumns);
  sheet.getCell(3, 1).value = `Generated on: ${asDisplayDate(new Date())}`;
  sheet.getCell(3, 1).font = { italic: true, size: 11 };

  const headerRow = sheet.getRow(tableHeaderRowNumber);
  headerRow.values = result.headers;
  headerRow.font = { bold: true };

  for (const row of result.rows) {
    sheet.addRow(row.map(asCellValue));
  }

  sheet.columns = result.headers.map((header, idx) => {
    const headerLen = header.length;
    const contentLen = result.rows.reduce((max, row) => {
      const cell = row[idx];
      const length = cell == null ? 0 : String(cell).length;
      return Math.max(max, length);
    }, 0);
    return { width: Math.min(Math.max(headerLen, contentLen, 12), 48) };
  });

  const tableEndRowNumber = tableHeaderRowNumber + result.rows.length;
  const border: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FF94A3B8" } },
    left: { style: "thin", color: { argb: "FF94A3B8" } },
    bottom: { style: "thin", color: { argb: "FF94A3B8" } },
    right: { style: "thin", color: { argb: "FF94A3B8" } },
  };

  for (
    let rowNumber = tableHeaderRowNumber;
    rowNumber <= tableEndRowNumber;
    rowNumber += 1
  ) {
    for (
      let colNumber = 1;
      colNumber <= result.headers.length;
      colNumber += 1
    ) {
      const cell = sheet.getCell(rowNumber, colNumber);
      cell.border = border;
      cell.alignment = { vertical: "middle", wrapText: true };
    }
  }

  return workbook.xlsx.writeBuffer();
}

function csvToHtmlTable(csv: string, title: string) {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const cells = lines.map((line) => line.split(","));
  const [header, ...rows] = cells;
  const generatedOn = asDisplayDate(new Date());
  const safeTitle = escapeHtml(title);
  const safeGovHeading = escapeHtml(REPORT_GOV_HEADING);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    :root {
      --ink: #0f172a;
      --muted: #475569;
      --line: #cbd5e1;
      --head-bg: #e2e8f0;
      --row-alt: #f8fafc;
      --brand: #0b3a82;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f1f5f9;
      color: var(--ink);
      font-family: "Segoe UI", "Noto Sans Malayalam", "Nirmala UI", Arial, sans-serif;
      line-height: 1.45;
    }
    .page {
      max-width: 1120px;
      margin: 20px auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px 20px 20px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    .header {
      border-bottom: 2px solid var(--brand);
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .gov-heading {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: var(--brand);
      margin: 0;
    }
    .report-title {
      font-size: 16px;
      font-weight: 600;
      margin: 6px 0 2px;
      color: var(--ink);
    }
    .generated-on {
      font-size: 12px;
      color: var(--muted);
      margin: 0;
    }
    .table-wrap {
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px 10px;
      font-size: 12px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: var(--head-bg);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 11px;
      font-weight: 700;
    }
    tbody tr:nth-child(even) td { background: var(--row-alt); }
    tbody tr:last-child td { border-bottom: 0; }
    .footer {
      margin-top: 10px;
      font-size: 11px;
      color: var(--muted);
      text-align: right;
    }
    @media print {
      body { background: #fff; }
      .page {
        box-shadow: none;
        border: 0;
        margin: 0;
        padding: 0;
        max-width: none;
      }
      .header { margin-bottom: 10px; }
      @page { size: A4 landscape; margin: 12mm; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="header">
      <p class="gov-heading">${safeGovHeading}</p>
      <p class="report-title">${safeTitle}</p>
      <p class="generated-on">Generated on: ${escapeHtml(generatedOn)}</p>
    </header>
    <section class="table-wrap">
      <table>
        <thead><tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows
            .map(
              (r) =>
                `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
            )
            .join("\n")}
        </tbody>
      </table>
    </section>
    <div class="footer">HDP Reporting System</div>
  </main>
</body>
</html>`;
}

async function reportDepartmentSummary(secId: number) {
  const result = await db.execute(sql`
    WITH secretary_departments AS (
      SELECT md.dept_id
      FROM hdp.master_department md
      WHERE md.sec_id = ${secId}
    ),
    owned_projects AS (
      SELECT DISTINCT ps.project_id
      FROM hdp.project_secretary ps
      WHERE ps.sec_id = ${secId}
    ),
    supported_indicators AS (
      SELECT DISTINCT i.indicator_id, i.project_id
      FROM hdp.indicators i
      WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
        SELECT sd.dept_id FROM secretary_departments sd
      )
    ),
    scoped_projects AS (
      SELECT DISTINCT p.project_id
      FROM (
        SELECT op.project_id FROM owned_projects op
        UNION
        SELECT si.project_id FROM supported_indicators si
      ) p
    ),
    scoped_indicators AS (
      SELECT i.*
      FROM hdp.indicators i
      INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
      LEFT JOIN supported_indicators si ON si.indicator_id = i.indicator_id
      LEFT JOIN owned_projects op ON op.project_id = i.project_id
      WHERE op.project_id IS NOT NULL OR si.indicator_id IS NOT NULL
    ),
    dept_projects AS (
      SELECT DISTINCT
        pd.dept_id,
        COALESCE(md.dept_name, 'Unassigned') AS department,
        mp.project_id
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
      INNER JOIN scoped_projects sp ON sp.project_id = mp.project_id
      WHERE COALESCE(mp.is_archived, false) = false
    )
    SELECT
      dp.department,
      COUNT(DISTINCT dp.project_id)::int AS projects,
      COUNT(i.indicator_id)::int AS indicators,
      COALESCE(ROUND(AVG(COALESCE(i.verified_percentage, i.percentage, 0))::numeric, 1), 0) AS physical_progress,
      COALESCE(ROUND(AVG(COALESCE(i.verified_financial_achievement, i.financial_achievement, 0))::numeric, 1), 0) AS financial_progress,
      MAX(COALESCE(i.verified_date, i.submitted_date)) AS last_updated
    FROM dept_projects dp
    LEFT JOIN scoped_indicators i ON i.project_id = dp.project_id
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

  const totals = rows.reduce(
    (acc, row) => {
      acc.projects += Number(row[1] ?? 0);
      acc.indicators += Number(row[2] ?? 0);
      return acc;
    },
    { projects: 0, indicators: 0 },
  );

  rows.push(["TOTAL", totals.projects, totals.indicators, "", "", ""]);

  return buildReport("Department Summary Report", headers, rows);
}

async function reportProjectSummary(secId: number) {
  const result = await db.execute(sql`
    WITH secretary_departments AS (
      SELECT md.dept_id
      FROM hdp.master_department md
      WHERE md.sec_id = ${secId}
    ),
    owned_projects AS (
      SELECT DISTINCT ps.project_id
      FROM hdp.project_secretary ps
      WHERE ps.sec_id = ${secId}
    ),
    supported_indicators AS (
      SELECT DISTINCT i.indicator_id, i.project_id
      FROM hdp.indicators i
      WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
        SELECT sd.dept_id FROM secretary_departments sd
      )
    ),
    scoped_projects AS (
      SELECT
        t.project_id,
        BOOL_OR(t.is_owned) AS is_owned
      FROM (
        SELECT op.project_id, true AS is_owned
        FROM owned_projects op
        UNION ALL
        SELECT si.project_id, false AS is_owned
        FROM supported_indicators si
      ) t
      GROUP BY t.project_id
    ),
    scoped_indicators AS (
      SELECT i.*
      FROM hdp.indicators i
      INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
      LEFT JOIN supported_indicators si ON si.indicator_id = i.indicator_id
      WHERE sp.is_owned = true OR si.indicator_id IS NOT NULL
    )
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
    INNER JOIN scoped_projects sp ON sp.project_id = mp.project_id
    LEFT JOIN hdp.master_source_of_funding msf
      ON msf.source_of_funding_id = mp.source_of_funding_id
    LEFT JOIN scoped_indicators i ON i.project_id = mp.project_id
    WHERE COALESCE(mp.is_archived, false) = false
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
  return buildReport("Project Summary Report", headers, rows);
}

async function reportPhysicalProgress(secId: number) {
  const result = await db.execute(sql`
    WITH secretary_departments AS (
      SELECT md.dept_id
      FROM hdp.master_department md
      WHERE md.sec_id = ${secId}
    ),
    owned_projects AS (
      SELECT DISTINCT ps.project_id
      FROM hdp.project_secretary ps
      WHERE ps.sec_id = ${secId}
    ),
    supported_indicators AS (
      SELECT DISTINCT i.indicator_id, i.project_id
      FROM hdp.indicators i
      WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
        SELECT sd.dept_id FROM secretary_departments sd
      )
    ),
    scoped_projects AS (
      SELECT
        t.project_id,
        BOOL_OR(t.is_owned) AS is_owned
      FROM (
        SELECT op.project_id, true AS is_owned
        FROM owned_projects op
        UNION ALL
        SELECT si.project_id, false AS is_owned
        FROM supported_indicators si
      ) t
      GROUP BY t.project_id
    ),
    scoped_indicators AS (
      SELECT i.*
      FROM hdp.indicators i
      INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
      LEFT JOIN supported_indicators si ON si.indicator_id = i.indicator_id
      WHERE sp.is_owned = true OR si.indicator_id IS NOT NULL
    )
    SELECT
      mp.project_name,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
      COALESCE(i.verified_date, i.submitted_date) AS last_updated
    FROM scoped_indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    WHERE COALESCE(mp.is_archived, false) = false
    ORDER BY mp.project_name ASC, indicator_name ASC
  `);

  const headers = ["Project", "Indicator", "Physical %", "Last Updated"];
  const rows = (result.rows as Row[]).map((r) => [
    r.project_name,
    r.indicator_name,
    r.physical_progress,
    r.last_updated,
  ]);
  return buildReport("Physical Progress Report", headers, rows);
}

async function reportFinancialProgress(secId: number) {
  const result = await db.execute(sql`
    WITH secretary_departments AS (
      SELECT md.dept_id
      FROM hdp.master_department md
      WHERE md.sec_id = ${secId}
    ),
    owned_projects AS (
      SELECT DISTINCT ps.project_id
      FROM hdp.project_secretary ps
      WHERE ps.sec_id = ${secId}
    ),
    supported_indicators AS (
      SELECT DISTINCT i.indicator_id, i.project_id
      FROM hdp.indicators i
      WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
        SELECT sd.dept_id FROM secretary_departments sd
      )
    ),
    scoped_projects AS (
      SELECT
        t.project_id,
        BOOL_OR(t.is_owned) AS is_owned
      FROM (
        SELECT op.project_id, true AS is_owned
        FROM owned_projects op
        UNION ALL
        SELECT si.project_id, false AS is_owned
        FROM supported_indicators si
      ) t
      GROUP BY t.project_id
    ),
    scoped_indicators AS (
      SELECT i.*
      FROM hdp.indicators i
      INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
      LEFT JOIN supported_indicators si ON si.indicator_id = i.indicator_id
      WHERE sp.is_owned = true OR si.indicator_id IS NOT NULL
    )
    SELECT
      mp.project_name,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(i.verified_financial_achievement, i.financial_achievement, 0) AS financial_progress,
      COALESCE(i.verified_date, i.submitted_date) AS last_updated
    FROM scoped_indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    WHERE COALESCE(mp.is_archived, false) = false
    ORDER BY mp.project_name ASC, indicator_name ASC
  `);

  const headers = ["Project", "Indicator", "Financial %", "Last Updated"];
  const rows = (result.rows as Row[]).map((r) => [
    r.project_name,
    r.indicator_name,
    r.financial_progress,
    r.last_updated,
  ]);
  return buildReport("Financial Progress Report", headers, rows);
}

async function reportIndicators(secId: number) {
  const result = await db.execute(sql`
    WITH secretary_departments AS (
      SELECT md.dept_id
      FROM hdp.master_department md
      WHERE md.sec_id = ${secId}
    ),
    owned_projects AS (
      SELECT DISTINCT ps.project_id
      FROM hdp.project_secretary ps
      WHERE ps.sec_id = ${secId}
    ),
    supported_indicators AS (
      SELECT DISTINCT i.indicator_id, i.project_id
      FROM hdp.indicators i
      WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
        SELECT sd.dept_id FROM secretary_departments sd
      )
    ),
    scoped_projects AS (
      SELECT
        t.project_id,
        BOOL_OR(t.is_owned) AS is_owned
      FROM (
        SELECT op.project_id, true AS is_owned
        FROM owned_projects op
        UNION ALL
        SELECT si.project_id, false AS is_owned
        FROM supported_indicators si
      ) t
      GROUP BY t.project_id
    ),
    scoped_indicators AS (
      SELECT i.*
      FROM hdp.indicators i
      INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
      LEFT JOIN supported_indicators si ON si.indicator_id = i.indicator_id
      WHERE sp.is_owned = true OR si.indicator_id IS NOT NULL
    )
    SELECT
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(mp.project_name, 'Untitled project') AS project_name,
      COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
      COALESCE(i.verified_financial_achievement, i.financial_achievement, 0) AS financial_progress,
      COALESCE(i.verified_date, i.submitted_date) AS last_updated
    FROM scoped_indicators i
    INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
    WHERE COALESCE(mp.is_archived, false) = false
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
  return buildReport("Indicator Report", headers, rows);
}

async function reportDefaulters(secId: number) {
  const {
    pendingDays,
    inactivityDays,
    indicatorStaleDays: staleDays,
  } = getDefaulterThresholds();

  const result = await db.execute(sql`
    WITH secretary_departments AS (
      SELECT md.dept_id
      FROM hdp.master_department md
      WHERE md.sec_id = ${secId}
    ),
    owned_projects AS (
      SELECT DISTINCT ps.project_id
      FROM hdp.project_secretary ps
      WHERE ps.sec_id = ${secId}
    ),
    supported_indicators AS (
      SELECT DISTINCT i.indicator_id, i.project_id
      FROM hdp.indicators i
      WHERE COALESCE(i.supporting_dept_ids, '{}'::integer[]) && ARRAY(
        SELECT sd.dept_id FROM secretary_departments sd
      )
    ),
    scoped_projects AS (
      SELECT DISTINCT p.project_id
      FROM (
        SELECT op.project_id FROM owned_projects op
        UNION
        SELECT si.project_id FROM supported_indicators si
      ) p
    ),
    scoped_indicators AS (
      SELECT i.*
      FROM hdp.indicators i
      INNER JOIN scoped_projects sp ON sp.project_id = i.project_id
      LEFT JOIN supported_indicators si ON si.indicator_id = i.indicator_id
      LEFT JOIN owned_projects op ON op.project_id = i.project_id
      WHERE op.project_id IS NOT NULL OR si.indicator_id IS NOT NULL
    ),
    pending_progress AS (
      SELECT
        COALESCE(md.dept_name, 'Unassigned') AS subject,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(COALESCE(i.verified_date, i.submitted_date)))) / 86400)::int AS days,
        'pending_progress' AS category
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      INNER JOIN hdp.master_projects mp ON mp.project_id = pd.project_id
      INNER JOIN scoped_projects sp ON sp.project_id = mp.project_id
      LEFT JOIN scoped_indicators i ON i.project_id = mp.project_id
      WHERE COALESCE(mp.is_archived, false) = false
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
      INNER JOIN scoped_projects sp ON sp.project_id = mp.project_id
      LEFT JOIN scoped_indicators i ON i.project_id = mp.project_id
      WHERE COALESCE(mp.is_archived, false) = false
      GROUP BY COALESCE(md.dept_name, 'Unassigned')
      HAVING MAX(COALESCE(i.verified_date, i.submitted_date)) IS NULL
         OR MAX(COALESCE(i.verified_date, i.submitted_date)) < NOW() - (${inactivityDays} * INTERVAL '1 day')
    ),
    stale_indicators AS (
      SELECT
        COALESCE(i.indicator_name, 'Untitled indicator') AS subject,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - COALESCE(i.submitted_date, i.verified_date))) / 86400)::int AS days,
        'stale_indicator' AS category
      FROM scoped_indicators i
      INNER JOIN hdp.master_projects mp ON mp.project_id = i.project_id
      WHERE COALESCE(mp.is_archived, false) = false
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
  return buildReport("Defaulters Report", headers, rows);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const sessionOrResponse = await requireSession();
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
    let result: ReportResult;

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

    if (format === "xlsx") {
      const xlsxBuffer = await toXlsxBuffer(result);
      return new NextResponse(xlsxBuffer as ArrayBuffer, {
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "content-disposition": `attachment; filename="${reportId}-report.xlsx"`,
        },
      });
    }

    return new NextResponse(result.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${reportId}-report.csv"`,
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
