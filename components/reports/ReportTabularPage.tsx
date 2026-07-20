import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { getDefaulterThresholds } from '@/lib/config/defaulter-thresholds';
import { TabularReportShell } from '@/components/reports/tabular/TabularReportShell';

type Props = {
    reportId: string;
    title: string;
    isOsd: boolean;
};

type TabularRow = {
    indicator_id: number | null;
    administrative_department: string;
    department_name: string;
    hod_names: string;
    project_code: string;
    project_name: string;
    indicator_name: string;
    physical_progress: number;
    financial_progress: number | null;
    financial_achievement: number;
    submitted_date: Date | null;
    verified_date: Date | null;
    completed_date: Date | null;
    last_progress_update: Date | null;
    is_stale: boolean;
    has_no_progress: boolean;
    image_count: number;
    video_count: number;
    document_count: number;
    project_is_completed: boolean;
    project_completion_date: Date | null;
    project_cost: number;
};

type ProjectGroup = {
    key: string;
    agencyName: string;
    hodNames: string;
    projectCode: string;
    projectName: string;
    isCompleted: boolean;
    completedDate: Date | null;
    projectCost: number;
    indicators: TabularRow[];
};

type DepartmentGroup = {
    name: string;
    projects: ProjectGroup[];
};

function formatDateTime(value: Date = new Date()) {
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(value);
}

function toNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

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

// Physical/financial % are always shown as whole numbers, matching the public site.
function roundPct(value: number) {
    return Math.round(value);
}

function containsMalayalam(value: string) {
    return /[\u0D00-\u0D7F]/.test(value);
}

function verificationStatus(row: TabularRow) {
    if (row.verified_date) return 'Verified';
    if (row.submitted_date) return 'Pending Verification';
    return 'No Update';
}

function indicatorStatus(row: TabularRow) {
    return row.is_stale || row.has_no_progress ? 'Lagging' : 'On Track';
}

function isIndicatorCompleted(row: TabularRow) {
    return row.physical_progress >= 100 && row.verified_date !== null;
}

// Physical: average of this set's own indicators' verified_percentage. Correct as
// "project physical %" when called with one project's indicators (spec: average of
// all indicator verified_percentage values). Do NOT call this with a multi-project
// flat list for department/report-level physical — use physicalRollup() instead,
// which averages per-project figures rather than per-indicator ones.
function aggregate(rows: TabularRow[]) {
    const indicatorRows = rows.filter((row) => row.indicator_id !== null);
    const totalIndicators = indicatorRows.length;
    const completedIndicators = indicatorRows.filter((row) => isIndicatorCompleted(row)).length;
    const lagging = rows.filter((row) => row.is_stale || row.has_no_progress).length;
    const pending = rows.filter((row) => !row.verified_date && !!row.submitted_date).length;
    const images = rows.reduce((sum, row) => sum + row.image_count, 0);
    const videos = rows.reduce((sum, row) => sum + row.video_count, 0);
    const documents = rows.reduce((sum, row) => sum + row.document_count, 0);
    const physical = totalIndicators > 0
        ? roundPct(indicatorRows.reduce((sum, row) => sum + row.physical_progress, 0) / totalIndicators)
        : 0;

    return {
        totalIndicators,
        completedIndicators,
        lagging,
        pending,
        images,
        videos,
        documents,
        physical,
    };
}

// Financial %: sum of verified_financial_achievement across the given projects,
// divided by the sum of their project_cost — never an average of percentages.
// Projects with no recorded cost are excluded from both sides (their achievement
// can't be attributed a %); returns null ("N/A") when no project has a usable cost.
function financialRollup(projects: ProjectGroup[]): number | null {
    const validProjects = projects.filter((project) => project.projectCost > 0);
    if (validProjects.length === 0) return null;

    const totalAchievement = validProjects.reduce(
        (sum, project) => sum + project.indicators.reduce((s, row) => s + row.financial_achievement, 0),
        0,
    );
    const totalCost = validProjects.reduce((sum, project) => sum + project.projectCost, 0);
    return totalCost > 0 ? roundPct((totalAchievement / totalCost) * 100) : null;
}

// Physical % at department/report level: average of each project's own physical %
// (every project weighted equally, regardless of indicator count). Uses each
// project's full-precision average rather than aggregate()'s rounded display
// value — rounding per project before averaging would drift the department
// figure away from a plain average of the raw underlying numbers.
function physicalRollup(projects: ProjectGroup[]): number {
    if (projects.length === 0) return 0;
    const total = projects.reduce((sum, project) => {
        const indicatorRows = project.indicators.filter((row) => row.indicator_id !== null);
        if (indicatorRows.length === 0) return sum;
        return sum + indicatorRows.reduce((s, row) => s + row.physical_progress, 0) / indicatorRows.length;
    }, 0);
    return roundPct(total / projects.length);
}

function buildDepartments(rows: TabularRow[]) {
    const departmentMap = new Map<string, Map<string, ProjectGroup>>();

    for (const row of rows) {
        if (!departmentMap.has(row.administrative_department)) {
            departmentMap.set(row.administrative_department, new Map());
        }
        const projectMap = departmentMap.get(row.administrative_department);
        if (!projectMap) continue;

        const projectKey = `${row.department_name}|${row.project_code}|${row.project_name}`;
        if (!projectMap.has(projectKey)) {
            projectMap.set(projectKey, {
                key: projectKey,
                agencyName: row.department_name,
                hodNames: row.hod_names,
                projectCode: row.project_code,
                projectName: row.project_name,
                isCompleted: row.project_is_completed,
                completedDate: row.project_completion_date,
                projectCost: row.project_cost,
                indicators: [],
            });
        }

        projectMap.get(projectKey)?.indicators.push(row);
    }

    return Array.from(departmentMap.entries()).map(([name, projectMap]) => ({
        name,
        projects: Array.from(projectMap.values()),
    }));
}

async function loadTabularRows(): Promise<TabularRow[]> {
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
        COALESCE(mp.is_completed, 0) AS is_completed,
        mp.completion_date,
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
        sp.is_completed,
        sp.completion_date,
        sp.project_cost,
        COALESCE(md.dept_name, 'Unassigned') AS department_name,
        COALESCE(dh.hod_names, 'Unassigned') AS hod_names
      FROM secretary_projects sp
      LEFT JOIN hdp.project_department pd ON pd.project_id = sp.project_id
      LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
      LEFT JOIN dept_hods dh ON dh.dept_id = pd.dept_id
    )
    SELECT
      i.indicator_id,
      dm.administrative_department,
      dm.department_name,
      dm.hod_names,
      dm.project_code,
      dm.project_name,
      dm.is_completed AS project_is_completed,
      dm.completion_date AS project_completion_date,
      dm.project_cost,
      CASE
        WHEN i.indicator_id IS NULL THEN 'No indicator mapped'
        WHEN NULLIF(BTRIM(i.indicator_name), '') IS NULL THEN 'Untitled indicator'
        ELSE i.indicator_name
      END AS indicator_name,
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

    return result.rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
            indicator_id: r.indicator_id == null ? null : Number(r.indicator_id),
            administrative_department: String(r.administrative_department ?? 'Unassigned'),
            department_name: String(r.department_name ?? 'Unassigned'),
            hod_names: String(r.hod_names ?? 'Unassigned'),
            project_code: String(r.project_code ?? '-'),
            project_name: String(r.project_name ?? 'Untitled project'),
            indicator_name: String(r.indicator_name ?? 'Untitled indicator'),
            physical_progress: toNumber(r.physical_progress),
            financial_progress: r.financial_progress == null ? null : toNumber(r.financial_progress),
            financial_achievement: toNumber(r.financial_achievement),
            submitted_date: toDate(r.submitted_date),
            verified_date: toDate(r.verified_date),
            completed_date: toDate(r.completed_date),
            last_progress_update: toDate(r.last_progress_update),
            is_stale: Boolean(r.is_stale),
            has_no_progress: Boolean(r.has_no_progress),
            image_count: toNumber(r.image_count),
            video_count: toNumber(r.video_count),
            document_count: toNumber(r.document_count),
            project_is_completed: toNumber(r.project_is_completed) === 2,
            project_completion_date: toDate(r.project_completion_date),
            project_cost: toNumber(r.project_cost),
        };
    });
}

export async function ReportTabularPage({ reportId, title, isOsd }: Props) {
    const rows = reportId === 'lagging-analysis' ? await loadTabularRows() : [];
    const departments = buildDepartments(rows);
    const reportHref = isOsd ? '/admin/osd/reports' : '/admin/reports';
    const viewHref = isOsd ? `/admin/osd/reports/${reportId}/view` : `/admin/reports/${reportId}/view`;
    const allProjects = departments.flatMap((department) => department.projects);
    const summary = {
        ...aggregate(rows),
        physical: physicalRollup(allProjects),
        financial: financialRollup(allProjects),
    };
    const projectCount = allProjects.length;
    const generatedAt = formatDateTime();

    return (
        <TabularReportShell
            departments={departments}
            summary={summary}
            projectCount={projectCount}
            generatedAt={generatedAt}
            reportId={reportId}
            title={title}
            reportHref={reportHref}
            viewHref={viewHref}
        />
    );
}
