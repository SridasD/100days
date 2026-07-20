import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { requireAdminSession, isAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";
import { getDefaulterThresholds } from "@/lib/config/defaulter-thresholds";
import type { TabularRow } from "@/components/reports/tabular/types";
import { aggregate, financialRollup, physicalRollup, rollupLastUpdate, rollupStatus, rollupVerification } from "@/components/reports/tabular/lib";

export const runtime = "nodejs";

type ReportRow = Record<string, unknown>;

function formatDateTime(value: Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatFileTimestamp(value: Date = new Date()) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  const hour12 = value.getHours() % 12 || 12;
  const minutes = String(value.getMinutes()).padStart(2, "0");
  const meridiem = value.getHours() >= 12 ? "PM" : "AM";

  return `${day}-${month}-${year}-${hour12}.${minutes} ${meridiem}`;
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function csvToHtmlTable(headers: string[], rows: unknown[][], title: string) {
  const safeCell = (value: unknown) =>
    String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");

  const numberFormatter = new Intl.NumberFormat("en-IN");
  const uniqueValues = (index: number) =>
    new Set(rows.map((row) => String(row[index] ?? "").trim()).filter(Boolean));
  const totalRows = rows.length;
  const adminCount = uniqueValues(0).size;
  const agencyCount = uniqueValues(1).size;
  const projectCount = new Set(
    rows.map((row) =>
      `${String(row[3] ?? "").trim()}|${String(row[4] ?? "").trim()}`.trim(),
    ),
  ).size;
  const indicatorCount = uniqueValues(5).size;
  const laggingCount = rows.filter(
    (row) => String(row[10] ?? "") === "Lagging",
  ).length;
  const pendingVerificationCount = rows.filter(
    (row) => String(row[8] ?? "") === "Pending Verification",
  ).length;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      --bg: #f3f4f6;
      --surface: #ffffff;
      --surface-2: #f8fafc;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --primary: #0f4c81;
      --primary-2: #eaf4ff;
      --success: #1f7a4d;
      --warning: #9a6700;
      --danger: #b42318;
      --shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .page {
      max-width: 1180px;
      margin: 0 auto;
      padding: 16px;
    }
    .shell {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 4px 18px rgba(15, 23, 42, 0.04);
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: #ffffff;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    .brand-mark {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: #eef4fb;
      color: var(--primary);
      border: 1px solid #d7e5f4;
      font-weight: 800;
      font-size: 12px;
      letter-spacing: 0.08em;
      flex: 0 0 auto;
    }
    .brand-copy { min-width: 0; }
    .topbar h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      color: var(--text);
    }
    .topbar p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .topbar-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .meta-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #f8fafc;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .meta-chip strong { color: #0f172a; }
    .menu-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px 20px 0;
    }
    .crumb {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 11px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: #f8fafc;
      color: #475569;
      font-size: 12px;
      font-weight: 700;
    }
    .crumb.active {
      background: #eef4fb;
      color: var(--primary);
      border-color: #d7e5f4;
    }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      text-decoration: none;
      font-size: 13px;
      font-weight: 700;
      box-shadow: none;
    }
    .btn.primary {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
    }
    .hero {
      padding: 12px 16px 8px;
    }
    .hero-card {
      background: #ffffff;
      color: var(--text);
      border-radius: 14px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-left: 4px solid var(--primary);
    }
    .hero-card .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #eef4fb;
      color: var(--primary);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .hero-card h2 {
      margin: 10px 0 6px;
      font-size: 20px;
      line-height: 1.15;
    }
    .hero-card p {
      margin: 0;
      max-width: 980px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.6;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 12px;
      padding: 16px 20px 0;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
      box-shadow: none;
      min-width: 0;
    }
    .stat .label {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .stat .value {
      margin-top: 8px;
      font-size: 22px;
      font-weight: 800;
      color: var(--text);
      word-break: break-word;
    }
    .stat .meta {
      margin-top: 4px;
      font-size: 12px;
      color: var(--muted);
    }
    .content {
      padding: 14px 16px 18px;
    }
    .table-shell {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      box-shadow: none;
    }
    .table-wrap { overflow: auto; max-height: 72vh; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 5;
      background: #f8fbff;
      color: #0f2f4f;
      border-bottom: 1px solid var(--border);
      box-shadow: inset 0 -1px 0 var(--border);
    }
    th, td {
      border-bottom: 1px solid var(--border);
      padding: 8px 10px;
      font-size: 11px;
      text-align: left;
      vertical-align: top;
      word-break: break-word;
      white-space: normal;
    }
    tbody tr:nth-child(even) { background: #fafcff; }
    tbody tr:hover { background: #eff6ff; }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 12px 20px 14px;
      border-top: 1px solid var(--border);
      background: #ffffff;
      color: var(--muted);
      font-size: 12px;
    }
    .footer-main {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .footer-main strong {
      color: var(--text);
      font-size: 12px;
    }
    .pill-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 10px;
      border-radius: 999px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 700;
      color: #0f2f4f;
    }
    .pill.success { background: #ecfdf3; color: var(--success); border-color: #bbf7d0; }
    .pill.warning { background: #fffaeb; color: var(--warning); border-color: #fde68a; }
    .pill.danger { background: #fef3f2; color: var(--danger); border-color: #fecaca; }
    @media print { body { margin: 8px; } }
    @media (max-width: 1200px) {
      .stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 720px) {
      .page { padding: 10px; }
      .topbar, .footer { padding-left: 14px; padding-right: 14px; }
      .hero, .content { padding-left: 14px; padding-right: 14px; }
      .menu-bar { padding-left: 14px; padding-right: 14px; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); padding-left: 14px; padding-right: 14px; }
      .topbar { flex-direction: column; align-items: flex-start; }
      .topbar-meta, .toolbar { width: 100%; justify-content: flex-start; }
      .hero-card h2 { font-size: 18px; }
      .stat .value { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="shell">
      <div class="topbar">
        <div class="brand">
          <div class="brand-mark">HDP</div>
          <div class="brand-copy">
            <h1>${title}</h1>
            <p>Browser view mode. Use Download for the formatted Excel file.</p>
          </div>
        </div>
        <div class="topbar-meta">
          <span class="meta-chip"><strong>Logged in:</strong> OSD Administrator</span>
          <span class="meta-chip"><strong>Access:</strong> Admin Reports</span>
          <div class="toolbar">
            <a class="btn" href="?format=csv&view=1">Refresh View</a>
            <a class="btn primary" href="?format=xlsx">Download Excel</a>
          </div>
        </div>
      </div>

      <div class="menu-bar">
        <span class="crumb">Reports</span>
        <span class="crumb">Admin / OSD</span>
        <span class="crumb active">Project Progress & Performance Review</span>
      </div>

      <div class="hero">
        <div class="hero-card">
          <div class="eyebrow">Project Progress & Performance Review</div>
          <h2>Hierarchical performance snapshot for senior review</h2>
          <p>This view starts at Administrative Department and progressively drills into Implementing Agency, Project, and Indicator detail. It is optimized for quick scanning, with summary counts up top and readable row grouping below.</p>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="label">Administrative Departments</div><div class="value">${numberFormatter.format(adminCount)}</div><div class="meta">Top-level groups</div></div>
        <div class="stat"><div class="label">Implementing Agencies</div><div class="value">${numberFormatter.format(agencyCount)}</div><div class="meta">Unique agencies</div></div>
        <div class="stat"><div class="label">Projects</div><div class="value">${numberFormatter.format(projectCount)}</div><div class="meta">Project records</div></div>
        <div class="stat"><div class="label">Indicators</div><div class="value">${numberFormatter.format(indicatorCount)}</div><div class="meta">Indicator records</div></div>
        <div class="stat"><div class="label">Lagging Rows</div><div class="value">${numberFormatter.format(laggingCount)}</div><div class="meta">Need attention</div></div>
        <div class="stat"><div class="label">Pending Verification</div><div class="value">${numberFormatter.format(pendingVerificationCount)}</div><div class="meta">Awaiting review</div></div>
      </div>

      <div class="content">
        <div class="table-shell">
          <div class="table-wrap">
            <table>
              <thead><tr>${headers.map((h) => `<th>${safeCell(h)}</th>`).join("")}</tr></thead>
              <tbody>
                ${rows.map((r) => `<tr>${r.map((c) => `<td>${safeCell(c)}</td>`).join("")}</tr>`).join("\n")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div class="footer">
        <div class="footer-main">
          <strong>Project Progress & Performance Review Report</strong>
          <div>Generated at ${safeCell(formatDateTime())} · ${numberFormatter.format(totalRows)} data rows</div>
        </div>
        <div class="pill-row">
          <span class="pill success">On Track</span>
          <span class="pill warning">Pending Verification</span>
          <span class="pill danger">Lagging</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

type TabularReport = {
  headers: string[];
  rows: unknown[][];
};

function buildSimpleWorkbook(
  title: string,
  headers: string[],
  rows: unknown[][],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HDP Portal";
  workbook.company = "Kerala CMO";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet(title.slice(0, 31));
  const columnCount = headers.length;

  sheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.max(14, Math.min(32, header.length + 4)),
  }));
  sheet.mergeCells(1, 1, 1, columnCount);
  sheet.getCell(1, 1).value = title;
  sheet.getCell(1, 1).font = {
    size: 16,
    bold: true,
    color: { argb: "FF123A6F" },
  };
  sheet.getCell(1, 1).alignment = { horizontal: "center" };
  sheet.getCell(2, 1).value = `Generated on ${formatDateTime()}`;
  sheet.mergeCells(2, 1, 2, columnCount);
  sheet.getCell(2, 1).alignment = { horizontal: "center" };
  sheet.getCell(2, 1).font = {
    size: 10,
    italic: true,
    color: { argb: "FF6B7280" },
  };

  sheet.addRow([]);
  const headerRow = sheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F4C81" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB7C7D6" } },
      left: { style: "thin", color: { argb: "FFB7C7D6" } },
      bottom: { style: "thin", color: { argb: "FFB7C7D6" } },
      right: { style: "thin", color: { argb: "FFB7C7D6" } },
    };
  });

  rows.forEach((rowValues, index) => {
    const row = sheet.addRow(rowValues);
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: colNumber === 1 ? "center" : "left",
      };
      if (index % 2 === 1) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FBFD" },
        };
      }
    });
  });

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: columnCount },
  };
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  sheet.headerFooter = {
    oddHeader: '&C&"Arial,Bold"&KCCCCCC H D P  |  KERALA CMO',
    oddFooter: '&C&"Arial,Italic"&K808080 Generated by HDP Portal',
  };

  return workbook;
}

type LaggingFlatRow = {
  administrative_department: unknown;
  department_name: unknown;
  hod_names: unknown;
  project_id: unknown;
  project_code: unknown;
  project_name: unknown;
  indicator_id: unknown;
  indicator_name: unknown;
  physical_progress: unknown;
  financial_progress: unknown;
  financial_achievement: unknown;
  submitted_date: unknown;
  verified_date: unknown;
  completed_date: unknown;
  last_progress_update: unknown;
  is_stale: unknown;
  has_no_progress: unknown;
  image_count: unknown;
  video_count: unknown;
  document_count: unknown;
  project_cost: unknown;
};

type LaggingProject = {
  code: string;
  name: string;
  projectCost: number;
  indicators: TabularRow[];
};

type LaggingDepartment = {
  name: string;
  hodNames: string;
  projects: Map<number, LaggingProject>;
};

function toDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : fallback;
}

function buildLaggingWorkbook(rows: LaggingFlatRow[]) {
  const byAdmin = new Map<string, Map<string, LaggingDepartment>>();

  for (const row of rows) {
    const adminName = toText(row.administrative_department, "Unassigned");
    const deptName = toText(row.department_name, "Unassigned");
    const hodNames = toText(row.hod_names, "Unassigned");
    const projectId = toNumber(row.project_id);

    if (!byAdmin.has(adminName)) {
      byAdmin.set(adminName, new Map());
    }

    const deptMap = byAdmin.get(adminName);
    if (!deptMap) continue;

    if (!deptMap.has(deptName)) {
      deptMap.set(deptName, {
        name: deptName,
        hodNames,
        projects: new Map(),
      });
    }

    const dept = deptMap.get(deptName);
    if (!dept) continue;

    if (!dept.projects.has(projectId)) {
      dept.projects.set(projectId, {
        code: toText(row.project_code, "-"),
        name: toText(row.project_name, "Untitled project"),
        projectCost: toNumber(row.project_cost),
        indicators: [],
      });
    }

    const project = dept.projects.get(projectId);
    if (!project) continue;

    const indicatorId = toNumber(row.indicator_id);
    if (indicatorId <= 0) continue;

    project.indicators.push({
      indicator_id: indicatorId,
      administrative_department: adminName,
      department_name: deptName,
      hod_names: hodNames,
      project_code: project.code,
      project_name: project.name,
      indicator_name: toText(row.indicator_name, "Untitled indicator"),
      physical_progress: toNumber(row.physical_progress),
      financial_progress: row.financial_progress == null ? null : toNumber(row.financial_progress),
      financial_achievement: toNumber(row.financial_achievement),
      submitted_date: toDate(row.submitted_date),
      verified_date: toDate(row.verified_date),
      completed_date: toDate(row.completed_date),
      last_progress_update: toDate(row.last_progress_update),
      is_stale: Boolean(row.is_stale),
      has_no_progress: Boolean(row.has_no_progress),
      image_count: toNumber(row.image_count),
      video_count: toNumber(row.video_count),
      document_count: toNumber(row.document_count),
      // This export doesn't fetch project completion status (not used by this sheet's columns).
      project_is_completed: false,
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HDP Portal";
  workbook.company = "Kerala CMO";

  const sheet = workbook.addWorksheet("Lagging Analysis");
  sheet.properties.outlineProperties = {
    summaryBelow: false,
    summaryRight: false,
  };

  sheet.columns = [
    { header: "Hierarchy", key: "hierarchy", width: 48 },
    { header: "Implementing Agency / HOD", key: "agency", width: 28 },
    { header: "Physical Progress (%)", key: "physical", width: 16 },
    { header: "Financial Progress (%)", key: "financial", width: 16 },
    { header: "Verification Status", key: "verification", width: 20 },
    { header: "Status", key: "status", width: 14 },
    { header: "Last Progress Update", key: "lastUpdate", width: 24 },
    { header: "Images", key: "images", width: 10 },
    { header: "Videos", key: "videos", width: 10 },
    { header: "Documents", key: "documents", width: 12 },
  ];

  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = "Lagging Analysis Report";
  sheet.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: "FF123A6F" },
  };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("A2:J2");
  sheet.getCell("A2").value = `Generated on ${formatDateTime()}`;
  sheet.getCell("A2").font = {
    size: 10,
    italic: true,
    color: { argb: "FF6B7280" },
  };

  const headerRow = sheet.getRow(4);
  headerRow.values = [
    "Hierarchy",
    "Implementing Agency / HOD",
    "Physical Progress (%)",
    "Financial Progress (%)",
    "Verification Status",
    "Status",
    "Last Progress Update",
    "Images",
    "Videos",
    "Documents",
  ];

  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F4C81" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  });

  let currentRow = 5;
  let adminIndex = 0;

  for (const [adminName, deptMap] of byAdmin.entries()) {
    adminIndex += 1;
    const adminNumber = String(adminIndex);
    const adminProjects = Array.from(deptMap.values()).flatMap((dept) => Array.from(dept.projects.values()));
    const adminIndicators = adminProjects.flatMap((p) => p.indicators);
    const adminSummary = aggregate(adminIndicators);
    const adminLastUpdate = rollupLastUpdate(adminIndicators);

    const adminRow = sheet.getRow(currentRow);
    adminRow.values = [
      `${adminNumber}. ${adminName}`,
      "",
      physicalRollup(adminProjects),
      financialRollup(adminProjects),
      rollupVerification(adminIndicators),
      rollupStatus(adminIndicators),
      adminLastUpdate ? formatDateTime(adminLastUpdate) : "-",
      adminSummary.images,
      adminSummary.videos,
      adminSummary.documents,
    ];
    adminRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF0B3558" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAF4FF" },
      };
    });
    currentRow += 1;

    let deptIndex = 0;
    for (const dept of deptMap.values()) {
      deptIndex += 1;
      const deptNumber = `${adminNumber}.${deptIndex}`;
      const projects = Array.from(dept.projects.values());
      const deptIndicators = projects.flatMap((p) => p.indicators);
      const deptSummary = aggregate(deptIndicators);
      const deptLastUpdate = rollupLastUpdate(deptIndicators);

      const deptRow = sheet.getRow(currentRow);
      deptRow.values = [
        `${deptNumber} ${dept.name}`,
        dept.hodNames,
        physicalRollup(projects),
        financialRollup(projects),
        rollupVerification(deptIndicators),
        rollupStatus(deptIndicators),
        deptLastUpdate ? formatDateTime(deptLastUpdate) : "-",
        deptSummary.images,
        deptSummary.videos,
        deptSummary.documents,
      ];
      deptRow.eachCell((cell) => {
        cell.font = { bold: true };
      });
      deptRow.getCell(1).alignment = { horizontal: "left", indent: 1 };
      currentRow += 1;

      let projIndex = 0;
      for (const project of projects) {
        projIndex += 1;
        const projectNumber = `${deptNumber}.${projIndex}`;
        const summary = aggregate(project.indicators);
        const lastUpdate = rollupLastUpdate(project.indicators);

        const projectRow = sheet.getRow(currentRow);
        projectRow.values = [
          `${projectNumber} ${project.name} (${project.code})`,
          "",
          summary.physical,
          financialRollup([project]),
          rollupVerification(project.indicators),
          rollupStatus(project.indicators),
          lastUpdate ? formatDateTime(lastUpdate) : "-",
          summary.images,
          summary.videos,
          summary.documents,
        ];
        projectRow.getCell(1).alignment = { horizontal: "left", indent: 2 };
        currentRow += 1;

        let indIndex = 0;
        for (const indicator of project.indicators) {
          indIndex += 1;
          const indicatorNumber = `${projectNumber}.${indIndex}`;
          const verification = indicator.verified_date
            ? "Verified"
            : indicator.submitted_date
              ? "Pending Verification"
              : "No Update";
          const isLagging = indicator.is_stale || indicator.has_no_progress;

          const indicatorRow = sheet.getRow(currentRow);
          indicatorRow.values = [
            `${indicatorNumber} ${indicator.indicator_name}`,
            "",
            indicator.physical_progress,
            indicator.financial_progress,
            verification,
            isLagging ? "Lagging" : "On Track",
            indicator.last_progress_update
              ? formatDateTime(indicator.last_progress_update)
              : "-",
            indicator.image_count,
            indicator.video_count,
            indicator.document_count,
          ];
          indicatorRow.outlineLevel = 1;
          indicatorRow.hidden = true;
          indicatorRow.getCell(1).alignment = { horizontal: "left", indent: 3 };
          currentRow += 1;
        }
      }
    }
  }

  sheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: 10 },
  };
  sheet.views = [{ state: "frozen", ySplit: 4 }];

  return workbook;
}

async function buildAdminLaggingAnalysisExport() {
  const { indicatorStaleDays } = getDefaulterThresholds();
  const now = new Date();

  const result = await db.execute(sql`
    WITH secretary_projects AS (
      SELECT DISTINCT
        ms.sec_id,
        COALESCE(ms.secretary_name, 'Unassigned') AS administrative_department,
        mp.project_id,
        COALESCE(mp.project_code, '-') AS project_code,
        COALESCE(mp.project_name, 'Untitled project') AS project_name,
        COALESCE(mp.project_cost, 0) AS project_cost
      FROM hdp.master_projects mp
      LEFT JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
      LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
      WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    ),
    dept_hods AS (
      SELECT
        ud.dept_id,
        STRING_AGG(ud.user_name, ', ' ORDER BY ud.user_name) AS hod_names
      FROM hdp.user_details ud
      WHERE ud.role_id = 6
        AND ud.status = 1
      GROUP BY ud.dept_id
    ),
    dept_map AS (
      SELECT DISTINCT
        sp.administrative_department,
        sp.project_id,
        sp.project_code,
        sp.project_name,
        sp.project_cost,
        COALESCE(md.dept_name, 'Unassigned') AS department_name,
        COALESCE(dh.hod_names, 'Unassigned') AS hod_names
      FROM secretary_projects sp
      LEFT JOIN hdp.project_department pd ON pd.project_id = sp.project_id
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      LEFT JOIN dept_hods dh ON dh.dept_id = pd.dept_id
    )
    SELECT
      dm.administrative_department,
      dm.department_name,
      dm.hod_names,
      dm.project_id,
      dm.project_code,
      dm.project_name,
      dm.project_cost,
      i.indicator_id,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      ROUND(COALESCE(i.verified_percentage, 0)::numeric, 0) AS physical_progress,
      CASE
        WHEN COALESCE(i.financial_target, 0) <= 0 THEN NULL
        ELSE ROUND(((COALESCE(i.verified_financial_achievement, 0) / i.financial_target) * 100)::numeric, 0)
      END AS financial_progress,
      COALESCE(i.verified_financial_achievement, 0) AS financial_achievement,
      i.submitted_date,
      i.verified_date,
      i.completed_date,
      COALESCE(i.verified_date, i.submitted_date) AS last_progress_update,
      CASE
        WHEN i.indicator_id IS NULL THEN true
        WHEN COALESCE(i.verified_date, i.submitted_date) IS NULL THEN true
        WHEN COALESCE(i.verified_date, i.submitted_date) < ${now}::timestamptz - (${indicatorStaleDays} * INTERVAL '1 day') THEN true
        ELSE false
      END AS is_stale,
      CASE
        WHEN i.indicator_id IS NOT NULL
          AND COALESCE(i.verified_date, i.submitted_date) IS NULL THEN true
        ELSE false
      END AS has_no_progress,
      COALESCE((
        SELECT COUNT(*)::int
        FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id
          AND COALESCE(g.is_verified, false) = true
          AND g.gallery_type = 1
      ), 0) AS image_count,
      COALESCE((
        SELECT COUNT(*)::int
        FROM hdp.gallery g
        WHERE g.indicator_id = i.indicator_id
          AND COALESCE(g.is_verified, false) = true
          AND g.gallery_type = 2
      ), 0) AS video_count,
      COALESCE((
        SELECT COUNT(*)::int
        FROM hdp.documents d
        WHERE d.indicator_id = i.indicator_id
      ), 0) AS document_count
    FROM dept_map dm
    LEFT JOIN hdp.indicators i ON i.project_id = dm.project_id
    ORDER BY dm.administrative_department ASC, dm.department_name ASC, dm.project_name ASC, indicator_name ASC
  `);

  return buildLaggingWorkbook(result.rows as LaggingFlatRow[]);
}

async function generateLaggingAnalysisTable() {
  const { indicatorStaleDays } = getDefaulterThresholds();
  const now = new Date();

  const result = await db.execute(sql`
    WITH secretary_projects AS (
      SELECT DISTINCT
        ms.sec_id,
        COALESCE(ms.secretary_name, 'Unassigned') AS administrative_department,
        mp.project_id,
        COALESCE(mp.project_code, '-') AS project_code,
        COALESCE(mp.project_name, 'Untitled project') AS project_name
      FROM hdp.master_projects mp
      LEFT JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
      LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
      WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    ),
    dept_hods AS (
      SELECT
        ud.dept_id,
        STRING_AGG(ud.user_name, ', ' ORDER BY ud.user_name) AS hod_names
      FROM hdp.user_details ud
      WHERE ud.role_id = 6
        AND ud.status = 1
      GROUP BY ud.dept_id
    ),
    dept_map AS (
      SELECT DISTINCT
        sp.administrative_department,
        sp.project_id,
        sp.project_code,
        sp.project_name,
        COALESCE(md.dept_name, 'Unassigned') AS department_name,
        COALESCE(dh.hod_names, 'Unassigned') AS hod_names
      FROM secretary_projects sp
      LEFT JOIN hdp.project_department pd ON pd.project_id = sp.project_id
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      LEFT JOIN dept_hods dh ON dh.dept_id = pd.dept_id
    )
    SELECT
      dm.administrative_department,
      dm.department_name,
      dm.hod_names,
      dm.project_code,
      dm.project_name,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      ROUND(COALESCE(i.verified_percentage, 0)::numeric, 0) AS physical_progress,
      CASE
        WHEN COALESCE(i.financial_target, 0) <= 0 THEN NULL
        ELSE ROUND(((COALESCE(i.verified_financial_achievement, 0) / i.financial_target) * 100)::numeric, 0)
      END AS financial_progress,
      i.submitted_date,
      i.verified_date,
      i.completed_date,
      COALESCE(i.verified_date, i.submitted_date) AS last_progress_update,
      CASE
        WHEN i.indicator_id IS NULL THEN true
        WHEN COALESCE(i.verified_date, i.submitted_date) IS NULL THEN true
        WHEN COALESCE(i.verified_date, i.submitted_date) < ${now}::timestamptz - (${indicatorStaleDays} * INTERVAL '1 day') THEN true
        ELSE false
      END AS is_stale,
      CASE
        WHEN i.indicator_id IS NOT NULL
          AND COALESCE(i.verified_date, i.submitted_date) IS NULL THEN true
        ELSE false
      END AS has_no_progress
    FROM dept_map dm
    LEFT JOIN hdp.indicators i ON i.project_id = dm.project_id
    ORDER BY dm.administrative_department ASC, dm.department_name ASC, dm.project_name ASC, indicator_name ASC
  `);

  const headers = [
    "Administrative Department",
    "Implementing Agency",
    "HOD(s)",
    "Project Code",
    "Project Name",
    "Indicator",
    "Physical %",
    "Financial %",
    "Verification Status",
    "Last Update",
    "Status",
  ];

  const rows = (result.rows as Record<string, unknown>[]).map((r) => {
    const submittedDate = toDate(r.submitted_date);
    const verifiedDate = toDate(r.verified_date);
    const verification = verifiedDate
      ? "Verified"
      : submittedDate
        ? "Pending Verification"
        : "No Update";
    const isLagging = Boolean(r.is_stale) || Boolean(r.has_no_progress);
    const lastUpdate = toDate(r.last_progress_update);

    return [
      String(r.administrative_department ?? "Unassigned"),
      String(r.department_name ?? "Unassigned"),
      String(r.hod_names ?? "Unassigned"),
      String(r.project_code ?? "-"),
      String(r.project_name ?? "Untitled project"),
      String(r.indicator_name ?? "Untitled indicator"),
      toNumber(r.physical_progress),
      r.financial_progress == null ? "" : toNumber(r.financial_progress),
      verification,
      lastUpdate ? formatDateTime(lastUpdate) : "-",
      isLagging ? "Lagging" : "On Track",
    ];
  });

  return { headers, rows } satisfies TabularReport;
}

async function generateLaggingAnalysisCSV() {
  const table = await generateLaggingAnalysisTable();
  return toCsv(table.headers, table.rows);
}

function buildWorkbookHeader(sheet: ExcelJS.Worksheet) {
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = "കേരള സർക്കാർ|100 ദിന പദ്ധതികൾ";
  sheet.getCell("A1").font = {
    size: 16,
    bold: true,
    color: { argb: "FF123A6F" },
  };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = {
    type: "gradient",
    gradient: "angle",
    degree: 0,
    stops: [
      { position: 0, color: { argb: "FFF7FBFF" } },
      { position: 1, color: { argb: "FFEAF4FF" } },
    ],
  };

  sheet.mergeCells("A2:J2");
  sheet.getCell("A2").value = "Department-wise Project Report";
  sheet.getCell("A2").font = {
    size: 12,
    bold: true,
    color: { argb: "FF2C3E50" },
  };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("A3:J3");
  sheet.getCell("A3").value = `Generated on ${formatDateTime()}`;
  sheet.getCell("A3").font = {
    size: 10,
    italic: true,
    color: { argb: "FF6B7280" },
  };
  sheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

  ["A1", "A2", "A3"].forEach((cellRef) => {
    sheet.getCell(cellRef).alignment = {
      horizontal: "center",
      vertical: "middle",
      textRotation: 0,
      wrapText: false,
    };
  });

  sheet.mergeCells("A4:J4");
  sheet.getCell("A4").value = "";

  const headerRow = sheet.getRow(5);
  headerRow.values = [
    "Sl. No",
    "Administrative Department",
    "Implementing Department",
    "Project Code",
    "Project Name",
    "No. of Indicators",
    "Project Status",
    "Project Outlay",
    "Source of Funding",
    "Nature of Project",
  ];
  headerRow.height = 24;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F4C81" },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFB7C7D6" } },
      left: { style: "thin", color: { argb: "FFB7C7D6" } },
      bottom: { style: "thin", color: { argb: "FFB7C7D6" } },
      right: { style: "thin", color: { argb: "FFB7C7D6" } },
    };
  });

  sheet.autoFilter = { from: "A5", to: "J5" };
  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.properties.defaultRowHeight = 20;
  sheet.headerFooter = {
    oddHeader: '&C&"Arial,Bold"&KCCCCCC H D P  |  KERALA CMO',
    oddFooter: '&C&"Arial,Italic"&K808080 Generated by HDP Portal',
  };
}

function buildDepartmentWiseWorkbook(rows: ReportRow[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HDP Portal";
  workbook.company = "Kerala CMO";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Department-wise Report");
  sheet.columns = [
    { header: "Sl. No", key: "slNo", width: 8 },
    {
      header: "Administrative Department",
      key: "administrativeDepartment",
      width: 28,
    },
    {
      header: "Implementing Department",
      key: "implementingDepartment",
      width: 30,
    },
    { header: "Project Code", key: "projectCode", width: 16 },
    { header: "Project Name", key: "projectName", width: 34 },
    { header: "No. of Indicators", key: "noIndicators", width: 16 },
    { header: "Project Status", key: "projectStatus", width: 16 },
    { header: "Project Outlay", key: "projectOutlay", width: 16 },
    { header: "Source of Funding", key: "sourceOfFunding", width: 22 },
    { header: "Nature of Project", key: "natureOfProject", width: 18 },
  ];

  buildWorkbookHeader(sheet);

  sheet.addRows(
    rows.map((row, index) => ({
      slNo: index + 1,
      administrativeDepartment:
        String(row.administrative_department ?? "-") || "-",
      implementingDepartment: String(row.implementing_department ?? "-") || "-",
      projectCode: String(row.project_code ?? "-") || "-",
      projectName: String(row.project_name ?? "-") || "-",
      noIndicators: toNumber(row.no_indicators),
      projectStatus: String(row.project_status ?? "-") || "-",
      projectOutlay: toNumber(row.project_outlay),
      sourceOfFunding: String(row.source_of_funding ?? "-") || "-",
      natureOfProject: String(row.nature_of_project ?? "-") || "-",
    })),
  );

  const dataStartRow = 6;
  const dataEndRow = dataStartRow + rows.length - 1;

  for (let rowIndex = dataStartRow; rowIndex <= dataEndRow; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
        horizontal: [1, 6, 7, 8].includes(columnNumber) ? "center" : "left",
      };
      if (rowIndex % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF9FBFD" },
        };
      }
    });
  }

  sheet.getColumn(1).alignment = { horizontal: "center" };
  sheet.getColumn(6).alignment = { horizontal: "center" };
  sheet.getColumn(7).alignment = { horizontal: "center" };
  sheet.getColumn(8).alignment = { horizontal: "right" };
  sheet.getColumn(8).numFmt = '"Rs" #,##0.00';

  return workbook;
}

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

async function generateDepartmentWiseReportRows() {
  const result = await db.execute(sql`
    SELECT
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(ms.secretary_name, 'Unassigned'), COALESCE(mp.project_name, 'Untitled project')
      ) AS sl_no,
      COALESCE(ms.secretary_name, 'Unassigned') AS administrative_department,
      COALESCE(
        STRING_AGG(DISTINCT md.dept_name, ', ' ORDER BY md.dept_name),
        'Unassigned'
      ) AS implementing_department,
      COALESCE(mp.project_code, '') AS project_code,
      COALESCE(mp.project_name, 'Untitled project') AS project_name,
      COUNT(DISTINCT i.indicator_id)::int AS no_indicators,
      CASE
        WHEN COALESCE(mp.is_completed, 0) = 2 THEN 'Completed'
        WHEN COALESCE(mp.is_completed, 0) = 1 THEN 'In Progress'
        ELSE 'Not Started'
      END AS project_status,
      COALESCE(mp.project_cost, 0) AS project_outlay,
      COALESCE(msf.source_of_funding_name, '') AS source_of_funding,
      CASE
        WHEN mp.nature_of_project = 1 THEN 'Livelihood'
        WHEN mp.nature_of_project = 2 THEN 'Infrastructure'
        ELSE 'Not Specified'
      END AS nature_of_project
    FROM hdp.master_projects mp
    LEFT JOIN hdp.project_secretary ps ON ps.project_id = mp.project_id
    LEFT JOIN hdp.master_secretary ms ON ms.sec_id = ps.sec_id
    LEFT JOIN hdp.project_department pd ON pd.project_id = mp.project_id
    LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
    LEFT JOIN hdp.master_source_of_funding msf ON msf.source_of_funding_id = mp.source_of_funding_id
    LEFT JOIN hdp.indicators i ON i.project_id = mp.project_id
    WHERE COALESCE(mp.is_archived, false) = false
    GROUP BY
      mp.project_id,
      ms.secretary_name,
      mp.project_code,
      mp.project_name,
      mp.is_completed,
      mp.project_cost,
      msf.source_of_funding_name,
      mp.nature_of_project
    ORDER BY administrative_department, project_name
  `);

  return result.rows as ReportRow[];
}

/**
 * Generate CSV content for department-wise report
 */
async function generateDepartmentWiseReportCSV() {
  const rows = await generateDepartmentWiseReportRows();
  const headers = [
    "Sl. No",
    "Administrative Department",
    "Implementing Department",
    "Project Code",
    "Project Name",
    "No of Indicators",
    "Project Status",
    "Project Outlay",
    "Source of Funding",
    "Nature of Project",
  ];

  const csvRows = rows.map((row, index) => [
    index + 1,
    String(row.administrative_department ?? ""),
    String(row.implementing_department ?? ""),
    String(row.project_code ?? ""),
    String(row.project_name ?? ""),
    Number(row.no_indicators ?? 0),
    String(row.project_status ?? ""),
    Number(row.project_outlay ?? 0),
    String(row.source_of_funding ?? ""),
    String(row.nature_of_project ?? ""),
  ]);

  return toCsv(headers, csvRows);
}

/**
 * Generate CSV content for completed projects report
 */
async function generateCompletedProjectsReportCSV() {
  const result = await db.execute(sql`
    SELECT
      mp.project_code,
      mp.project_name,
      COALESCE(msf.source_of_funding_name, '') AS source_of_funding,
      ms.secretary_name,
      COUNT(i.indicator_id) as indicator_count,
      COALESCE(SUM(CASE WHEN i.verified_date IS NOT NULL THEN 1 ELSE 0 END), 0) as verified_indicators,
      mp.project_cost
    FROM hdp.master_projects mp
    LEFT JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
    LEFT JOIN hdp.master_source_of_funding msf
      ON msf.source_of_funding_id = mp.source_of_funding_id
    LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id
    WHERE mp.is_completed = 1
        AND COALESCE(mp.is_archived, false) = false
    GROUP BY
      mp.project_id,
      mp.project_code,
      mp.project_name,
      msf.source_of_funding_name,
      ms.secretary_name,
      mp.project_cost
    ORDER BY mp.project_name
  `);

  const headers = [
    "Code",
    "Project Name",
    "Source Of Funding",
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
      String(r.source_of_funding ?? ""),
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
  const viewMode = req.nextUrl.searchParams.get("view") === "1";
  const embedMode = req.nextUrl.searchParams.get("embed") === "1";

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
        if (format === "xlsx") {
          const rows = await generateDepartmentWiseReportRows();
          const workbook = buildDepartmentWiseWorkbook(rows);
          const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
          const timestamp = formatFileTimestamp();
          return new NextResponse(Buffer.from(buffer), {
            headers: {
              "content-type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "content-disposition": `attachment; filename="HDP-Department wise project report ${timestamp}.xlsx"`,
            },
          });
        }
        csv = await generateDepartmentWiseReportCSV();
        break;
      case "lagging-analysis":
        if (format === "xlsx") {
          const workbook = await buildAdminLaggingAnalysisExport();
          const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
          const timestamp = formatFileTimestamp();
          return new NextResponse(Buffer.from(buffer), {
            headers: {
              "content-type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "content-disposition": `attachment; filename="HDP-Lagging analysis report ${timestamp}.xlsx"`,
            },
          });
        }
        if (viewMode) {
          if (!embedMode) {
            const shellPath =
              sessionOrResponse.roleId === 4
                ? `/admin/osd/reports/${reportId}/view`
                : `/admin/reports/${reportId}/view`;

            return NextResponse.redirect(new URL(shellPath, req.url));
          }
          const table = await generateLaggingAnalysisTable();
          return new NextResponse(
            csvToHtmlTable(
              table.headers,
              table.rows,
              "Project Progress & Performance Review Report",
            ),
            {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "content-disposition": `inline; filename="Project Progress & Performance Review Report.html"`,
              },
            },
          );
        }
        csv = await generateLaggingAnalysisCSV();
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
      // Fallback for non-department reports: preserve current CSV output for now.
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
