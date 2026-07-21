import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { ROLE, isSession, requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getDefaulterThresholds } from "@/lib/config/defaulter-thresholds";

export const runtime = "nodejs";

type FlatRow = {
  administrative_department: unknown;
  dept_id: unknown;
  department_name: unknown;
  hod_names: unknown;
  project_id: unknown;
  project_code: unknown;
  project_name: unknown;
  indicator_id: unknown;
  indicator_name: unknown;
  physical_progress: unknown;
  financial_progress: unknown;
  submitted_date: unknown;
  verified_date: unknown;
  last_progress_update: unknown;
  is_stale: unknown;
  is_pending_verification: unknown;
  has_no_progress: unknown;
};

type IndicatorNode = {
  indicatorId: number;
  indicatorName: string;
  physicalProgress: number;
  financialProgress: number;
  verificationStatus: string;
  lastProgressUpdate: Date | null;
  isStale: boolean;
  hasNoProgress: boolean;
  status: string;
};

type ProjectNode = {
  projectId: number;
  projectCode: string;
  projectName: string;
  indicators: IndicatorNode[];
};

type DepartmentNode = {
  deptId: number;
  departmentName: string;
  hodNames: string;
  projects: Map<number, ProjectNode>;
};

type Aggregate = {
  totalIndicators: number;
  updatedIndicators: number;
  pendingIndicators: number;
  staleIndicators: number;
  physicalAvg: number;
  financialAvg: number;
  status: string;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: unknown) {
  return Boolean(value);
}

function toDate(value: unknown) {
  if (!(value instanceof Date)) return null;
  if (Number.isNaN(value.getTime())) return null;
  return value;
}

function toText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function formatDateTime(value: Date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatDateCell(value: Date | null) {
  if (!value) return "-";
  return formatDateTime(value);
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

function verificationStatus(
  submittedDate: Date | null,
  verifiedDate: Date | null,
) {
  if (verifiedDate) return "Verified";
  if (submittedDate) return "Pending Verification";
  return "No Update";
}

function indicatorStatus(
  hasNoProgress: boolean,
  isStale: boolean,
  submittedDate: Date | null,
  verifiedDate: Date | null,
  physicalProgress: number,
  financialProgress: number,
) {
  if (hasNoProgress || isStale) return "Lagging";
  if (submittedDate && !verifiedDate) return "Pending Verification";
  if (physicalProgress >= 100 && financialProgress >= 100) return "On Track";
  return "In Progress";
}

function aggregateIndicators(indicators: IndicatorNode[]): Aggregate {
  const totalIndicators = indicators.length;

  if (totalIndicators === 0) {
    return {
      totalIndicators,
      updatedIndicators: 0,
      pendingIndicators: 0,
      staleIndicators: 0,
      physicalAvg: 0,
      financialAvg: 0,
      status: "No Indicators",
    };
  }

  const updatedIndicators = indicators.filter(
    (i) => i.lastProgressUpdate,
  ).length;
  const pendingIndicators = totalIndicators - updatedIndicators;
  const staleIndicators = indicators.filter(
    (i) => i.isStale || i.hasNoProgress,
  ).length;
  const physicalAvg = roundOne(
    indicators.reduce((sum, i) => sum + i.physicalProgress, 0) /
      totalIndicators,
  );
  const financialAvg = roundOne(
    indicators.reduce((sum, i) => sum + i.financialProgress, 0) /
      totalIndicators,
  );

  let status = "In Progress";
  if (staleIndicators > 0 || pendingIndicators > 0) {
    status = "Lagging";
  } else if (physicalAvg >= 100 && financialAvg >= 100) {
    status = "On Track";
  }

  return {
    totalIndicators,
    updatedIndicators,
    pendingIndicators,
    staleIndicators,
    physicalAvg,
    financialAvg,
    status,
  };
}

async function loadLaggingRows(secId: number) {
  const { indicatorStaleDays } = getDefaulterThresholds();
  const now = new Date();

  const result = await db.execute(sql`
    WITH secretary_scope AS (
      SELECT COALESCE(ms.secretary_name, 'Secretary') AS secretary_name
      FROM hdp.master_secretary ms
      WHERE ms.sec_id = ${secId}
      LIMIT 1
    ),
    secretary_departments AS (
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
    ),
    dept_project_map AS (
      SELECT DISTINCT
        COALESCE(pd.dept_id, 0) AS dept_id,
        COALESCE(md.dept_name, 'Unassigned') AS department_name,
        mp.project_id,
        COALESCE(mp.project_code, '-') AS project_code,
        COALESCE(mp.project_name, 'Untitled project') AS project_name
      FROM hdp.master_projects mp
      INNER JOIN scoped_projects sp ON sp.project_id = mp.project_id
      LEFT JOIN hdp.project_department pd ON pd.project_id = mp.project_id
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      WHERE COALESCE(mp.is_archived, false) = false
    ),
    dept_hods AS (
      SELECT
        ud.dept_id,
        STRING_AGG(ud.user_name, ', ' ORDER BY ud.user_name) AS hod_names
      FROM hdp.user_details ud
      WHERE ud.role_id = 6
        AND ud.status = 1
      GROUP BY ud.dept_id
    )
    SELECT
      ss.secretary_name AS administrative_department,
      dpm.dept_id,
      dpm.department_name,
      COALESCE(dh.hod_names, 'Unassigned') AS hod_names,
      dpm.project_id,
      dpm.project_code,
      dpm.project_name,
      i.indicator_id,
      COALESCE(i.indicator_name, 'Untitled indicator') AS indicator_name,
      COALESCE(i.verified_percentage, i.percentage, 0) AS physical_progress,
      COALESCE(i.verified_financial_achievement, i.financial_achievement, 0) AS financial_progress,
      i.submitted_date,
      i.verified_date,
      COALESCE(i.verified_date, i.submitted_date) AS last_progress_update,
      CASE
        WHEN i.indicator_id IS NULL THEN true
        WHEN COALESCE(i.verified_date, i.submitted_date) IS NULL THEN true
        WHEN COALESCE(i.verified_date, i.submitted_date) < ${now}::timestamptz - (${indicatorStaleDays} * INTERVAL '1 day') THEN true
        ELSE false
      END AS is_stale,
      CASE
        WHEN i.indicator_id IS NOT NULL
          AND i.submitted_date IS NOT NULL
          AND i.verified_date IS NULL THEN true
        ELSE false
      END AS is_pending_verification,
      CASE
        WHEN i.indicator_id IS NOT NULL
          AND COALESCE(i.verified_date, i.submitted_date) IS NULL THEN true
        ELSE false
      END AS has_no_progress
    FROM dept_project_map dpm
    CROSS JOIN secretary_scope ss
    LEFT JOIN dept_hods dh ON dh.dept_id = dpm.dept_id
    LEFT JOIN scoped_indicators i ON i.project_id = dpm.project_id
    ORDER BY dpm.department_name ASC, dpm.project_name ASC, indicator_name ASC
  `);

  return result.rows as FlatRow[];
}

function buildHierarchy(rows: FlatRow[]) {
  const departments = new Map<number, DepartmentNode>();
  const administrativeDepartment = toText(
    rows[0]?.administrative_department,
    "Secretary",
  );

  for (const row of rows) {
    const deptId = toNumber(row.dept_id);
    const departmentName = toText(row.department_name, "Unassigned");
    const hodNames = toText(row.hod_names, "Unassigned");
    const projectId = toNumber(row.project_id);

    if (!departments.has(deptId)) {
      departments.set(deptId, {
        deptId,
        departmentName,
        hodNames,
        projects: new Map<number, ProjectNode>(),
      });
    }

    const departmentNode = departments.get(deptId);
    if (!departmentNode) continue;

    if (!departmentNode.projects.has(projectId)) {
      departmentNode.projects.set(projectId, {
        projectId,
        projectCode: toText(row.project_code, "-"),
        projectName: toText(row.project_name, "Untitled project"),
        indicators: [],
      });
    }

    const projectNode = departmentNode.projects.get(projectId);
    if (!projectNode) continue;

    const indicatorId = toNumber(row.indicator_id);
    if (indicatorId <= 0) {
      continue;
    }

    const submittedDate = toDate(row.submitted_date);
    const verifiedDate = toDate(row.verified_date);
    const lastProgressUpdate = toDate(row.last_progress_update);
    const physicalProgress = toNumber(row.physical_progress);
    const financialProgress = toNumber(row.financial_progress);
    const isStale = toBoolean(row.is_stale);
    const hasNoProgress = toBoolean(row.has_no_progress);

    projectNode.indicators.push({
      indicatorId,
      indicatorName: toText(row.indicator_name, "Untitled indicator"),
      physicalProgress,
      financialProgress,
      verificationStatus: verificationStatus(submittedDate, verifiedDate),
      lastProgressUpdate,
      isStale,
      hasNoProgress,
      status: indicatorStatus(
        hasNoProgress,
        isStale,
        submittedDate,
        verifiedDate,
        physicalProgress,
        financialProgress,
      ),
    });
  }

  return {
    administrativeDepartment,
    departments: Array.from(departments.values()).sort((a, b) =>
      a.departmentName.localeCompare(b.departmentName),
    ),
  };
}

function buildLaggingWorkbook(
  administrativeDepartment: string,
  departments: DepartmentNode[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HDP Portal";
  workbook.company = "Kerala CMO";
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheet = workbook.addWorksheet("Lagging Analysis");
  sheet.properties.outlineProperties = {
    summaryBelow: false,
    summaryRight: false,
  };

  sheet.columns = [
    { header: "Level", key: "level", width: 12 },
    { header: "Department / Project / Indicator", key: "name", width: 46 },
    { header: "HOD(s)", key: "hod", width: 26 },
    { header: "Project Code", key: "projectCode", width: 16 },
    { header: "Total Indicators", key: "total", width: 16 },
    { header: "Updated", key: "updated", width: 12 },
    { header: "Pending / No Progress", key: "pending", width: 20 },
    { header: "Physical %", key: "physical", width: 12 },
    { header: "Financial %", key: "financial", width: 12 },
    { header: "Verification", key: "verification", width: 22 },
    { header: "Last Progress Update", key: "lastUpdate", width: 24 },
    { header: "Lagging Status", key: "lagging", width: 16 },
  ];

  sheet.mergeCells("A1:L1");
  sheet.getCell("A1").value =
    "Secretary Analytical Report - Lagging Projects and Indicators";
  sheet.getCell("A1").font = {
    size: 14,
    bold: true,
    color: { argb: "FF123A6F" },
  };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  sheet.mergeCells("A2:L2");
  sheet.getCell("A2").value =
    `Administrative Department: ${administrativeDepartment}`;
  sheet.getCell("A2").font = {
    size: 11,
    bold: true,
    color: { argb: "FF1F2937" },
  };
  sheet.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };

  sheet.mergeCells("A3:L3");
  sheet.getCell("A3").value = `Generated on ${formatDateTime()}`;
  sheet.getCell("A3").font = {
    size: 10,
    italic: true,
    color: { argb: "FF6B7280" },
  };
  sheet.getCell("A3").alignment = { horizontal: "left", vertical: "middle" };

  const headerRow = sheet.getRow(5);
  headerRow.values = [
    "Level",
    "Department / Project / Indicator",
    "HOD(s)",
    "Project Code",
    "Total Indicators",
    "Updated",
    "Pending / No Progress",
    "Physical %",
    "Financial %",
    "Verification",
    "Last Progress Update",
    "Lagging Status",
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
    cell.border = {
      top: { style: "thin", color: { argb: "FFB7C7D6" } },
      left: { style: "thin", color: { argb: "FFB7C7D6" } },
      bottom: { style: "thin", color: { argb: "FFB7C7D6" } },
      right: { style: "thin", color: { argb: "FFB7C7D6" } },
    };
  });

  let currentRow = 6;

  for (const department of departments) {
    const projectNodes = Array.from(department.projects.values()).sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );

    const allDepartmentIndicators = projectNodes.flatMap((p) => p.indicators);
    const departmentAgg = aggregateIndicators(allDepartmentIndicators);

    const departmentRow = sheet.getRow(currentRow);
    departmentRow.values = [
      "Department",
      department.departmentName,
      department.hodNames,
      "-",
      projectNodes.length,
      departmentAgg.updatedIndicators,
      departmentAgg.pendingIndicators,
      departmentAgg.physicalAvg,
      departmentAgg.financialAvg,
      "-",
      "-",
      departmentAgg.status,
    ];
    departmentRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: "FF0B3558" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEAF4FF" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9E5F2" } },
        left: { style: "thin", color: { argb: "FFD9E5F2" } },
        bottom: { style: "thin", color: { argb: "FFD9E5F2" } },
        right: { style: "thin", color: { argb: "FFD9E5F2" } },
      };
      cell.alignment = {
        horizontal: colNumber >= 5 && colNumber <= 9 ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
    });
    currentRow += 1;

    for (const project of projectNodes) {
      const projectAgg = aggregateIndicators(project.indicators);
      const projectRow = sheet.getRow(currentRow);
      projectRow.values = [
        "Project",
        project.projectName,
        "",
        project.projectCode,
        projectAgg.totalIndicators,
        projectAgg.updatedIndicators,
        projectAgg.pendingIndicators,
        projectAgg.physicalAvg,
        projectAgg.financialAvg,
        "-",
        project.indicators[0]?.lastProgressUpdate
          ? formatDateCell(
              project.indicators
                .map((i) => i.lastProgressUpdate)
                .filter((v): v is Date => Boolean(v))
                .sort((a, b) => b.getTime() - a.getTime())[0] ?? null,
            )
          : "-",
        projectAgg.status,
      ];
      projectRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
        cell.alignment = {
          horizontal: colNumber >= 5 && colNumber <= 9 ? "center" : "left",
          vertical: "middle",
          wrapText: true,
        };
      });
      projectRow.getCell(2).font = { bold: true, color: { argb: "FF111827" } };
      projectRow.getCell(2).alignment = {
        horizontal: "left",
        vertical: "middle",
        indent: 1,
      };

      currentRow += 1;

      for (const indicator of project.indicators) {
        const indicatorRow = sheet.getRow(currentRow);
        indicatorRow.values = [
          "Indicator",
          indicator.indicatorName,
          "",
          "",
          "",
          "",
          indicator.hasNoProgress ? 1 : 0,
          indicator.physicalProgress,
          indicator.financialProgress,
          indicator.verificationStatus,
          formatDateCell(indicator.lastProgressUpdate),
          indicator.status,
        ];

        indicatorRow.outlineLevel = 1;
        indicatorRow.hidden = true;

        indicatorRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFF1F5F9" } },
            left: { style: "thin", color: { argb: "FFF1F5F9" } },
            bottom: { style: "thin", color: { argb: "FFF1F5F9" } },
            right: { style: "thin", color: { argb: "FFF1F5F9" } },
          };
          cell.alignment = {
            horizontal: colNumber >= 5 && colNumber <= 9 ? "center" : "left",
            vertical: "middle",
            wrapText: true,
          };
        });

        indicatorRow.getCell(2).alignment = {
          horizontal: "left",
          vertical: "middle",
          indent: 2,
        };

        currentRow += 1;
      }
    }
  }

  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: 12 },
  };

  sheet.views = [{ state: "frozen", ySplit: 5 }];

  return workbook;
}

export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;

  if (sessionOrResponse.roleId !== ROLE.SECRETARY) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const format = req.nextUrl.searchParams.get("format") ?? "xlsx";
  if (format !== "xlsx") {
    return NextResponse.json(
      { error: "Invalid format. Use xlsx" },
      { status: 400 },
    );
  }

  try {
    const rows = await loadLaggingRows(sessionOrResponse.secId);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No scoped project data found for this secretary" },
        { status: 404 },
      );
    }

    const hierarchy = buildHierarchy(rows);
    const workbook = buildLaggingWorkbook(
      hierarchy.administrativeDepartment,
      hierarchy.departments,
    );

    const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
    const timestamp = formatFileTimestamp();

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="Secretary-Lagging-Analytical-Report ${timestamp}.xlsx"`,
      },
    });
  } catch (err) {
    console.error("GET /api/secretary/reports/lagging-analysis failed", err);
    return NextResponse.json(
      { error: "Failed to generate lagging analytical report" },
      { status: 500 },
    );
  }
}
