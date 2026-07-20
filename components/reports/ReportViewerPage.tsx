import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Building2, ChevronRight, CircleCheck, Clock3, Download, FileBarChart2, Landmark, Search, X } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { db } from '@/lib/db/client';
import { getDefaulterThresholds } from '@/lib/config/defaulter-thresholds';

type Props = {
    reportId: string;
    title: string;
    isOsd: boolean;
    searchQuery?: string;
    riskFilter?: string;
};

type RiskFilter = 'all' | 'lagging' | 'pending' | 'noupdate';

type LaggingRow = {
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
    last_progress_update: Date | null;
    is_stale: boolean;
    has_no_progress: boolean;
    project_cost: number;
};

type ProjectNode = {
    key: string;
    project_code: string;
    project_name: string;
    projectCost: number;
    indicators: LaggingRow[];
};

type AgencyNode = {
    key: string;
    department_name: string;
    hod_names: string;
    projects: ProjectNode[];
};

type AdminNode = {
    key: string;
    administrative_department: string;
    agencies: AgencyNode[];
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
    return value instanceof Date && !Number.isNaN(value.getTime()) ? value : null;
}

// Physical/financial % are always shown as whole numbers, matching the public site.
function roundPct(value: number) {
    return Math.round(value);
}

function buildHierarchy(rows: LaggingRow[]): AdminNode[] {
    const adminMap = new Map<string, {
        administrative_department: string;
        agencies: Map<string, {
            department_name: string;
            hod_names: string;
            projects: Map<string, ProjectNode>;
        }>;
    }>();

    for (const row of rows) {
        const adminKey = row.administrative_department;
        if (!adminMap.has(adminKey)) {
            adminMap.set(adminKey, {
                administrative_department: row.administrative_department,
                agencies: new Map(),
            });
        }

        const admin = adminMap.get(adminKey);
        if (!admin) continue;

        const agencyKey = `${row.department_name}|${row.hod_names}`;
        if (!admin.agencies.has(agencyKey)) {
            admin.agencies.set(agencyKey, {
                department_name: row.department_name,
                hod_names: row.hod_names,
                projects: new Map(),
            });
        }

        const agency = admin.agencies.get(agencyKey);
        if (!agency) continue;

        const projectKey = `${row.project_code}|${row.project_name}`;
        if (!agency.projects.has(projectKey)) {
            agency.projects.set(projectKey, {
                key: projectKey,
                project_code: row.project_code,
                project_name: row.project_name,
                projectCost: row.project_cost,
                indicators: [],
            });
        }

        const project = agency.projects.get(projectKey);
        if (!project) continue;
        project.indicators.push(row);
    }

    return Array.from(adminMap.entries()).map(([adminKey, admin]) => ({
        key: adminKey,
        administrative_department: admin.administrative_department,
        agencies: Array.from(admin.agencies.entries()).map(([agencyKey, agency]) => ({
            key: agencyKey,
            department_name: agency.department_name,
            hod_names: agency.hod_names,
            projects: Array.from(agency.projects.values()),
        })),
    }));
}

function getVerification(row: LaggingRow) {
    if (row.verified_date) return 'Verified';
    if (row.submitted_date) return 'Pending Verification';
    return 'No Update';
}

function getStatus(row: LaggingRow) {
    return row.is_stale || row.has_no_progress ? 'Needs Attention' : 'On Track';
}

function summarizeRows(rows: LaggingRow[]) {
    const indicatorRows = rows.filter((row) => row.indicator_id !== null);
    const implementingAgencies = new Set(rows.map((row) => row.department_name).filter(Boolean)).size;
    const totalProjects = new Set(rows.map((row) => `${row.project_code}|${row.project_name}`)).size;
    const totalIndicators = indicatorRows.length;
    const laggingRows = rows.filter((row) => row.is_stale || row.has_no_progress).length;
    const pendingVerification = rows.filter((row) => !row.verified_date && !!row.submitted_date).length;

    return {
        implementingAgencies,
        totalProjects,
        totalIndicators,
        laggingRows,
        pendingVerification,
    };
}

// Physical % at report/admin/agency/project level: average of each project's own
// physical % (avg of its indicators' verified_percentage), every project weighted
// equally regardless of indicator count. Averages full-precision per-project values
// rather than a pre-rounded one — rounding per project before averaging would drift
// the rollup figure away from a plain average of the raw underlying numbers.
function physicalRollup(projects: ProjectNode[]): number {
    if (projects.length === 0) return 0;
    const total = projects.reduce((sum, project) => {
        const indicatorRows = project.indicators.filter((row) => row.indicator_id !== null);
        if (indicatorRows.length === 0) return sum;
        return sum + indicatorRows.reduce((s, row) => s + row.physical_progress, 0) / indicatorRows.length;
    }, 0);
    return roundPct(total / projects.length);
}

// Financial %: sum of verified_financial_achievement across the given projects,
// divided by the sum of their project_cost — never an average of percentages.
// Projects with no recorded cost are excluded from both sides; returns null ("N/A")
// when none of the given projects have a usable cost.
function financialRollup(projects: ProjectNode[]): number | null {
    const validProjects = projects.filter((project) => project.projectCost > 0);
    if (validProjects.length === 0) return null;

    const totalAchievement = validProjects.reduce(
        (sum, project) => sum + project.indicators.reduce((s, row) => s + row.financial_achievement, 0),
        0,
    );
    const totalCost = validProjects.reduce((sum, project) => sum + project.projectCost, 0);
    return totalCost > 0 ? roundPct((totalAchievement / totalCost) * 100) : null;
}

function clampPercent(value: number) {
    return Math.max(0, Math.min(100, value));
}

function containsMalayalam(value: string) {
    return /[\u0D00-\u0D7F]/.test(value);
}

function StatusBadge({ status, ratio }: { status: string; ratio?: string }) {
    const classes = status === 'Needs Attention'
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : status === 'Pending Verification'
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : status === 'No Update'
                ? 'border-slate-200 bg-slate-100 text-slate-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700';

    return (
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}>
            {ratio ? `${ratio} ` : ''}{status}
        </span>
    );
}

function isRowMatchingRisk(row: LaggingRow, filter: RiskFilter) {
    if (filter === 'lagging') return row.is_stale || row.has_no_progress;
    if (filter === 'pending') return !row.verified_date && !!row.submitted_date;
    if (filter === 'noupdate') return !row.verified_date && !row.submitted_date;
    return true;
}

async function loadLaggingAnalysisRows(): Promise<LaggingRow[]> {
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
        -- Correlated subqueries (not a JOIN) so a project linked to more than
        -- one hdp.project_department row still produces exactly one row here
        -- — a plain LEFT JOIN would fan out and double-count that project
        -- (and every one of its indicators) once per extra department.
        SELECT DISTINCT
          sp.administrative_department,
          sp.project_id,
          sp.project_code,
          sp.project_name,
          sp.project_cost,
          COALESCE((
            SELECT STRING_AGG(DISTINCT md.dept_name, ', ' ORDER BY md.dept_name)
            FROM hdp.project_department pd
            LEFT JOIN hdp.master_department md ON md.dept_id = pd.dept_id
            WHERE pd.project_id = sp.project_id
          ), 'Unassigned') AS department_name,
          COALESCE((
            SELECT STRING_AGG(DISTINCT dh.hod_names, ', ' ORDER BY dh.hod_names)
            FROM hdp.project_department pd
            LEFT JOIN dept_hods dh ON dh.dept_id = pd.dept_id
            WHERE pd.project_id = sp.project_id
          ), 'Unassigned') AS hod_names
        FROM secretary_projects sp
      )
      SELECT
                i.indicator_id,
        dm.administrative_department,
        dm.department_name,
        dm.hod_names,
        dm.project_code,
        dm.project_name,
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
            last_progress_update: toDate(r.last_progress_update),
            is_stale: Boolean(r.is_stale),
            has_no_progress: Boolean(r.has_no_progress),
            project_cost: toNumber(r.project_cost),
        };
    });
}

export async function ReportViewerPage({ reportId, title, isOsd, searchQuery: rawSearchQuery = '', riskFilter: rawRiskFilter = 'all' }: Props) {
    const { indicatorStaleDays } = getDefaulterThresholds();
    const searchQuery = rawSearchQuery.trim();
    const riskFilter: RiskFilter =
        rawRiskFilter === 'lagging' || rawRiskFilter === 'pending' || rawRiskFilter === 'noupdate'
            ? rawRiskFilter
            : 'all';
    const reportsHref = isOsd ? '/admin/osd/reports' : '/admin/reports';
    const allRows = reportId === 'lagging-analysis' ? await loadLaggingAnalysisRows() : [];
    const normalizedQuery = searchQuery.toLocaleLowerCase();
    const queryFilteredRows = normalizedQuery.length === 0
        ? allRows
        : allRows.filter((row) => {
            const haystack = [
                row.administrative_department,
                row.department_name,
                row.hod_names,
                row.project_code,
                row.project_name,
                row.indicator_name,
            ]
                .join(' ')
                .toLocaleLowerCase();
            return haystack.includes(normalizedQuery);
        });
    const rows = queryFilteredRows.filter((row) => isRowMatchingRisk(row, riskFilter));
    const hierarchy = buildHierarchy(rows);
    const allProjects = hierarchy.flatMap((admin) => admin.agencies.flatMap((agency) => agency.projects));
    const overallPhysical = physicalRollup(allProjects);
    const overallFinancial = financialRollup(allProjects);
    const sortedHierarchy = [...hierarchy].sort((a, b) => {
        const aRows = a.agencies.flatMap((agency) => agency.projects.flatMap((project) => project.indicators));
        const bRows = b.agencies.flatMap((agency) => agency.projects.flatMap((project) => project.indicators));
        const aSummary = summarizeRows(aRows);
        const bSummary = summarizeRows(bRows);
        const aScore = aSummary.laggingRows + aSummary.pendingVerification;
        const bScore = bSummary.laggingRows + bSummary.pendingVerification;
        if (bScore !== aScore) return bScore - aScore;
        return a.administrative_department.localeCompare(b.administrative_department);
    });
    const totalRows = rows.length;
    const adminCount = new Set(rows.map((row) => row.administrative_department).filter(Boolean)).size;
    const projectCount = new Set(rows.map((row) => `${row.project_code}|${row.project_name}`)).size;
    const indicatorCount = rows.filter((row) => row.indicator_id !== null).length;
    const laggingCount = rows.filter((row) => row.is_stale || row.has_no_progress).length;
    const pendingVerificationCount = rows.filter((row) => row.verified_date == null && row.submitted_date != null).length;
    const overallSummary = summarizeRows(rows);
    const buildHref = (q: string, risk: RiskFilter) => {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (risk !== 'all') params.set('risk', risk);
        const qs = params.toString();
        return qs ? `?${qs}` : '?';
    };
    const topExceptions = sortedHierarchy
        .map((admin) => {
            const adminRows = admin.agencies.flatMap((agency) => agency.projects.flatMap((project) => project.indicators));
            const summary = summarizeRows(adminRows);
            return {
                name: admin.administrative_department,
                lagging: summary.laggingRows,
                total: summary.totalIndicators,
                pending: summary.pendingVerification,
            };
        })
        .filter((item) => item.lagging > 0 || item.pending > 0)
        .sort((a, b) => (b.lagging + b.pending) - (a.lagging + a.pending))
        .slice(0, 5);

    return (
        <main className="space-y-5">
            <section className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(247,249,252,1)_58%,rgba(241,246,240,1)_100%)] shadow-sm">
                <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                    <div className="space-y-3">
                        <Button asChild variant="outline" size="sm" className="mb-2 w-fit">
                            <Link href={reportsHref}>
                                <ArrowLeft className="h-4 w-4" />
                                Back to Reports
                            </Link>
                        </Button>
                        <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
                            <FileBarChart2 className="h-3.5 w-3.5 text-kerala-blue" />
                            {isOsd ? 'Executive Reports' : 'Reports & Analytics'}
                        </div>
                        <div className="space-y-1">
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
                            <p className="text-sm text-muted-foreground">Executive view with summary, exceptions, and progressive drill-down.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="sticky top-20 z-10 rounded-xl border bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Search className="h-4 w-4 text-slate-500" />
                        Filters
                    </div>

                    <div className="flex w-full flex-col gap-2 lg:w-auto lg:flex-row lg:items-center">
                        <form method="get" className="flex w-full items-center gap-2 lg:w-[560px]">
                            <input type="hidden" name="risk" value={riskFilter} />
                            <div className="relative flex-1">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    name="q"
                                    defaultValue={searchQuery}
                                    placeholder="Search department, agency, project code/name, indicator, or HOD"
                                    className="h-9 w-full rounded-md border bg-white pl-9 pr-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                            <Button type="submit" variant="outline" size="sm">Apply</Button>
                            {searchQuery ? (
                                <Button asChild variant="ghost" size="sm" className="shrink-0">
                                    <Link href={buildHref('', riskFilter)}>
                                        <X className="h-4 w-4" />
                                        Clear
                                    </Link>
                                </Button>
                            ) : null}
                        </form>

                        <div className="flex flex-wrap items-center gap-2">
                            {([
                                ['all', 'All'],
                                ['lagging', 'Needs Attention only'],
                                ['pending', 'Pending only'],
                                ['noupdate', 'No update only'],
                            ] as Array<[RiskFilter, string]>).map(([value, label]) => {
                                const active = riskFilter === value;
                                return (
                                    <Link
                                        key={value}
                                        href={buildHref(searchQuery, value)}
                                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${active
                                            ? 'border-kerala-blue bg-kerala-blue text-white shadow-sm'
                                            : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                                            }`}
                                    >
                                        {label}
                                    </Link>
                                );
                            })}
                        </div>

                        <Button asChild variant="outline" size="sm" className="shrink-0">
                            <Link href={`/api/admin/reports/${reportId}?format=xlsx`}>
                                <Download className="h-4 w-4" />
                                Download Excel
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {reportId === 'lagging-analysis' ? (
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="border-b bg-white">
                        <CardTitle className="text-base">Report</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 p-4">
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                                ['Administrative Departments', adminCount],
                                ['Projects', projectCount],
                                ['Indicators', indicatorCount],
                                ['Needs Attention', laggingCount],
                            ].map(([label, value]) => (
                                <div key={label as string} className="rounded-lg border bg-slate-50/70 p-3">
                                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {label as string}
                                    </div>
                                    <div className="mt-2 text-2xl font-bold text-foreground">{value as number}</div>
                                </div>
                            ))}
                        </div>

                        <div className="rounded-lg border bg-white px-3 py-2 text-xs text-slate-700">
                            <span className="font-semibold">Secondary metrics:</span>
                            <span className="ml-2">Implementing Agencies: {overallSummary.implementingAgencies}</span>
                            <span className="ml-3">Pending Verification: {pendingVerificationCount}</span>
                            <span className="ml-3">Physical: {overallPhysical}%</span>
                            <span className="ml-3">Financial: {overallFinancial === null ? '—' : `${overallFinancial}%`}</span>
                        </div>

                        <div className="rounded-lg border bg-slate-50/60 px-3 py-2 text-xs text-muted-foreground">
                            Collapsed by default. Expand Administrative Department to drill into Implementing Agencies, Projects, and Indicators.
                            <span className="ml-2 font-medium">Total rows: {totalRows}</span>
                            {searchQuery ? (
                                <span className="ml-2 font-medium">Filtered by: &quot;{searchQuery}&quot;</span>
                            ) : null}
                            <span className="ml-2 font-medium">Scope: {adminCount} departments · {projectCount} projects · {indicatorCount} indicators</span>
                            {riskFilter !== 'all' ? (
                                <span className="ml-2 font-medium">Risk filter: {riskFilter}</span>
                            ) : null}
                            <span className="ml-2">Needs Attention means no progress update or last update older than {indicatorStaleDays} days.</span>
                        </div>

                        {searchQuery && rows.length === 0 ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                                No matching records found for &quot;{searchQuery}&quot;.
                            </div>
                        ) : null}

                        {topExceptions.length > 0 ? (
                            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900">
                                    <AlertTriangle className="h-4 w-4" />
                                    Departments Requiring Attention
                                </div>
                                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                    {topExceptions.map((item) => (
                                        <div key={item.name} className="rounded-md border border-amber-100 bg-white px-3 py-2 text-xs">
                                            <div className="font-semibold text-slate-800">{item.name}</div>
                                            <div className="mt-1 flex gap-2">
                                                <StatusBadge status="Needs Attention" ratio={`${item.lagging}/${item.total}`} />
                                                <StatusBadge status="Pending Verification" />
                                                <span className="text-amber-700 font-semibold">{item.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-900">
                                <div className="flex items-center gap-2 font-semibold">
                                    <CircleCheck className="h-4 w-4" />
                                    No immediate department-level exceptions detected.
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            {sortedHierarchy.map((admin) => {
                                const adminRows = admin.agencies.flatMap((agency) =>
                                    agency.projects.flatMap((project) => project.indicators),
                                );
                                const adminSummary = summarizeRows(adminRows);
                                const adminProjects = admin.agencies.flatMap((agency) => agency.projects);
                                const adminPhysical = physicalRollup(adminProjects);
                                const adminFinancial = financialRollup(adminProjects);

                                return (
                                    <details key={admin.key} className="group overflow-hidden rounded-lg border bg-white shadow-sm">
                                        <summary className="cursor-pointer list-none p-3 hover:bg-slate-50/60">
                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                <div className="flex items-start gap-2">
                                                    <ChevronRight className="mt-0.5 h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
                                                    <Landmark className="mt-0.5 h-4 w-4 text-kerala-blue" />
                                                    <div>
                                                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                            Administrative Department
                                                        </div>
                                                        <div className="text-base font-semibold text-foreground">
                                                            {admin.administrative_department}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 xl:grid-cols-4">
                                                    <div className="rounded-md border bg-slate-50 px-2 py-1">Projects: {adminSummary.totalProjects}</div>
                                                    <div className="rounded-md border bg-slate-50 px-2 py-1">Indicators: {adminSummary.totalIndicators}</div>
                                                    <div className="rounded-md border bg-rose-50 px-2 py-1 text-rose-700">Needs Attention: {adminSummary.laggingRows}/{adminSummary.totalIndicators}</div>
                                                    <div className="rounded-md border bg-amber-50 px-2 py-1 text-amber-700">Pending: {adminSummary.pendingVerification}</div>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                <div>
                                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Physical Progress</div>
                                                    <div className="h-2 rounded-full bg-slate-200">
                                                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${clampPercent(adminPhysical)}%` }} />
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financial Progress</div>
                                                    <div className="h-2 rounded-full bg-slate-200">
                                                        <div className="h-2 rounded-full bg-emerald-600" style={{ width: `${clampPercent(adminFinancial ?? 0)}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </summary>

                                        <div className="space-y-2 border-t p-2.5">
                                            {admin.agencies.map((agency) => {
                                                const agencyRows = agency.projects.flatMap((project) => project.indicators);
                                                const agencySummary = summarizeRows(agencyRows);
                                                const agencyPhysical = physicalRollup(agency.projects);
                                                const agencyFinancial = financialRollup(agency.projects);

                                                return (
                                                    <details key={agency.key} className="group overflow-hidden rounded-md border bg-slate-50/60">
                                                        <summary className="cursor-pointer list-none p-2.5 hover:bg-slate-100/60">
                                                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                                                <div className="flex items-start gap-2">
                                                                    <ChevronRight className="mt-0.5 h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
                                                                    <Building2 className="mt-0.5 h-4 w-4 text-slate-600" />
                                                                    <div>
                                                                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Implementing Agency</div>
                                                                        <div className="font-medium text-foreground">{agency.department_name}</div>
                                                                        <div className="text-xs text-muted-foreground">HOD(s): {agency.hod_names}</div>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                                                                    <div className="rounded-md border bg-white px-2 py-1">Projects: {agencySummary.totalProjects}</div>
                                                                    <div className="rounded-md border bg-white px-2 py-1">Indicators: {agencySummary.totalIndicators}</div>
                                                                    <div className="rounded-md border bg-rose-50 px-2 py-1 text-rose-700">Needs Attention: {agencySummary.laggingRows}/{agencySummary.totalIndicators}</div>
                                                                    <div className="rounded-md border bg-amber-50 px-2 py-1 text-amber-700">Pending: {agencySummary.pendingVerification}</div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 text-[11px] text-muted-foreground">
                                                                Progress: Physical {agencyPhysical}% | Financial {agencyFinancial === null ? '—' : `${agencyFinancial}%`}
                                                            </div>
                                                        </summary>

                                                        <div className="space-y-2 border-t p-2">
                                                            {agency.projects.map((project) => {
                                                                const projectSummary = summarizeRows(project.indicators);
                                                                const projectPhysicalPct = physicalRollup([project]);
                                                                const projectFinancialPct = financialRollup([project]);

                                                                return (
                                                                    <details key={project.key} className="group overflow-hidden rounded-md border bg-white">
                                                                        <summary className="cursor-pointer list-none p-2.5 hover:bg-slate-50/60">
                                                                            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                                                                <div className="flex items-start gap-2">
                                                                                    <ChevronRight className="mt-0.5 h-4 w-4 text-slate-500 transition-transform group-open:rotate-90" />
                                                                                    <div>
                                                                                        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Project</div>
                                                                                        <div
                                                                                            lang={containsMalayalam(project.project_name) ? 'ml' : undefined}
                                                                                            className={`font-medium text-foreground ${containsMalayalam(project.project_name) ? 'font-malayalam leading-relaxed tracking-normal' : ''}`}
                                                                                        >
                                                                                            {project.project_name}
                                                                                        </div>
                                                                                        <div className="text-xs text-muted-foreground">Code: {project.project_code}</div>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                                                                                    <div className="rounded-md border bg-muted/20 px-2 py-1">Indicators: {projectSummary.totalIndicators}</div>
                                                                                    <div className="rounded-md border bg-rose-50 px-2 py-1 text-rose-700">Needs Attention: {projectSummary.laggingRows}/{projectSummary.totalIndicators}</div>
                                                                                    <div className="rounded-md border bg-amber-50 px-2 py-1 text-amber-700">Pending: {projectSummary.pendingVerification}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="mt-2 text-[11px] text-muted-foreground">
                                                                                Progress: Physical {projectPhysicalPct}% | Financial {projectFinancialPct === null ? '—' : `${projectFinancialPct}%`}
                                                                            </div>
                                                                        </summary>

                                                                        <div className="overflow-auto border-t">
                                                                            <table className="min-w-[900px] w-full border-collapse text-sm">
                                                                                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                                                                                    <tr>
                                                                                        <th className="border-b px-3 py-2">Indicator</th>
                                                                                        <th className="border-b px-3 py-2">Physical %</th>
                                                                                        <th className="border-b px-3 py-2">Financial %</th>
                                                                                        <th className="border-b px-3 py-2">Verification</th>
                                                                                        <th className="border-b px-3 py-2">Last Update</th>
                                                                                        <th className="border-b px-3 py-2">Status</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {project.indicators.map((indicator, idx) => {
                                                                                        const verification = getVerification(indicator);
                                                                                        const status = getStatus(indicator);
                                                                                        return (
                                                                                            <tr key={`${project.key}-${idx}`} className="align-top odd:bg-white even:bg-slate-50/50">
                                                                                                <td
                                                                                                    lang={containsMalayalam(indicator.indicator_name) ? 'ml' : undefined}
                                                                                                    className={`border-b px-3 py-2 break-words whitespace-normal ${containsMalayalam(indicator.indicator_name) ? 'font-malayalam leading-relaxed tracking-normal text-[0.95rem]' : 'leading-relaxed'}`}
                                                                                                >
                                                                                                    {indicator.indicator_name}
                                                                                                </td>
                                                                                                <td className="border-b px-3 py-2">{indicator.physical_progress}%</td>
                                                                                                <td className="border-b px-3 py-2">
                                                                                                    {indicator.financial_progress === null ? '—' : `${indicator.financial_progress}%`}
                                                                                                </td>
                                                                                                <td className="border-b px-3 py-2">
                                                                                                    {verification === 'Pending Verification' ? (
                                                                                                        <div className="flex items-center gap-1">
                                                                                                            <Clock3 className="h-3.5 w-3.5 text-amber-600" />
                                                                                                            <StatusBadge status={verification} />
                                                                                                        </div>
                                                                                                    ) : (
                                                                                                        <StatusBadge status={verification} />
                                                                                                    )}
                                                                                                </td>
                                                                                                <td className="border-b px-3 py-2">{indicator.last_progress_update ? formatDateTime(indicator.last_progress_update) : '-'}</td>
                                                                                                <td className="border-b px-3 py-2">
                                                                                                    <StatusBadge status={status} />
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </details>
                                                                );
                                                            })}
                                                        </div>
                                                    </details>
                                                );
                                            })}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>

                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-6 text-sm text-muted-foreground">
                        Report preview is not available for this report type yet.
                    </CardContent>
                </Card>
            )}
        </main>
    );
}
