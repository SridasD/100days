"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowUpDown,
    Bell,
    CalendarClock,
    FileText,
    Filter,
    FolderOpen,
    Image,
    Loader2,
    Paperclip,
    PlayCircle,
    ShieldAlert,
    TableProperties,
} from "lucide-react";
import { KeralaHeader } from "@/components/layout/KeralaHeader";
import { OfficerUserMenu } from "@/components/layout/OfficerUserMenu";
import { SecretaryNav } from "@/components/layout/SecretaryNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ProjectStatusKey = "all" | "not-started" | "in-progress" | "completed";
type DeptSort = "lowest-progress" | "recently-updated" | "alphabetical";
type AlertTab =
    | "pending-progress"
    | "pending-verification"
    | "no-activity"
    | "stale-indicators";

type DashboardPayload = {
    timestamp: string;
    scope: {
        secId: number;
        secretaryName: string | null;
    };
    summary: {
        totalDepartments: number;
        totalProjects: number;
        totalIndicators: number;
        physicalProgress: number;
        financialProgress: number;
        imagesUploaded: number;
        videosUploaded: number;
        documentsUploaded: number;
        lastDataUpdate: string | null;
    };
    projectStatus: {
        notStarted: number;
        inProgress: number;
        completed: number;
        archived: number;
    };
    projects: Array<{
        projectId: number;
        projectPublicId: string | null;
        projectCode: string | null;
        projectName: string | null;
        isOwned?: boolean;
        isArchived: boolean;
        isCompleted: number;
        completionDate: string | null;
        sectorName: string;
        departmentNames: string;
        districtNames: string;
        physicalProgress: number;
        financialProgress: number;
        indicators: number;
        pendingVerification: number;
        lastUpdated: string | null;
    }>;
    supportingParticipationIndicators: Array<{
        indicatorId: number;
        indicatorName: string;
        projectId: number;
        projectName: string;
        projectCode: string | null;
        sectorName: string;
        districtName: string;
        departmentNames: string;
        isCompleted: number;
        physicalProgress: number;
        financialProgress: number;
        lastUpdated: string | null;
    }>;
    departmentPerformance: Array<{
        deptId: number;
        deptPublicId: string | null;
        department: string;
        projects: number;
        indicators: number;
        physicalProgress: number;
        financialProgress: number;
        lastUpdated: string | null;
    }>;
    alerts: {
        pendingProgressUpdates: Array<{ department: string; pendingDays: number }>;
        pendingVerificationCount: number;
        noRecentActivity: Array<{ department: string; inactiveDays: number }>;
        indicatorsWithoutUpdates: Array<{
            indicatorId: number;
            indicatorName: string;
            projectName: string;
            department: string;
            staleDays: number;
        }>;
    };
    recentActivity: Array<{
        eventId: number;
        action: string;
        entity: string | null;
        entityId: number;
        actor: string;
        loggedOn: string | null;
    }>;
    thresholds: {
        pendingDays: number;
        inactivityDays: number;
        indicatorStaleDays: number;
    };
};

type Filters = {
    projectStatus: ProjectStatusKey;
    sector: string;
    district: string;
    department: string;
};

const numberFmt = new Intl.NumberFormat("en-IN");
const percentFmt = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

function fmtNumber(value: number) {
    return numberFmt.format(value || 0);
}

function fmtPercent(value: number) {
    return `${percentFmt.format(value || 0)}%`;
}

function fmtDateTime(value: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-IN");
}

function eventLabel(action: string) {
    switch (action) {
        case "PROJECT_CREATED":
            return "New Project Created";
        case "INDICATOR_CREATED":
            return "Indicator Added";
        case "INDICATOR_SUBMITTED":
            return "Progress Updated";
        case "INDICATOR_APPROVED":
            return "Verification Completed";
        case "MEDIA_UPLOADED":
            return "Image Uploaded";
        case "VIDEO_EMBEDDED":
            return "Video Uploaded";
        default:
            return action.replaceAll("_", " ");
    }
}

function statusFromRow(project: DashboardPayload["projects"][number]): ProjectStatusKey {
    if (project.isCompleted === 2) return "completed";
    if (project.isCompleted === 1) return "in-progress";
    return "not-started";
}

export default function SecretaryDashboardPage() {
    const [data, setData] = useState<DashboardPayload | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/secretary/dashboard", { cache: "no-store" });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
                if (!cancelled) {
                    setData(body as DashboardPayload);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e : new Error("Failed to load dashboard"));
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, []);

    const [filters, setFilters] = useState<Filters>({
        projectStatus: "all",
        sector: "all",
        district: "all",
        department: "all",
    });
    const [deptSort, setDeptSort] = useState<DeptSort>("lowest-progress");
    const [alertTab, setAlertTab] = useState<AlertTab>("pending-progress");

    const sectorOptions = useMemo(() => {
        const rows = data?.projects ?? [];
        return Array.from(new Set(rows.map((r) => r.sectorName).filter(Boolean))).sort();
    }, [data]);

    const districtOptions = useMemo(() => {
        const rows = data?.projects ?? [];
        return Array.from(
            new Set(
                rows
                    .flatMap((r) => r.districtNames.split(",").map((v) => v.trim()))
                    .filter((v) => v && v !== "-")
            )
        ).sort();
    }, [data]);

    const departmentOptions = useMemo(() => {
        const rows = data?.departmentPerformance ?? [];
        return Array.from(new Set(rows.map((r) => r.department))).sort();
    }, [data]);

    const scopedProjects = useMemo(() => {
        const rows = data?.projects ?? [];
        return rows.filter((row) => {
            if (row.isArchived) {
                return false;
            }
            if (filters.sector !== "all" && row.sectorName !== filters.sector) {
                return false;
            }
            if (
                filters.district !== "all" &&
                !row.districtNames
                    .split(",")
                    .map((d) => d.trim())
                    .includes(filters.district)
            ) {
                return false;
            }
            if (
                filters.department !== "all" &&
                !row.departmentNames
                    .split(",")
                    .map((d) => d.trim().toLowerCase())
                    .some((d) => d.includes(filters.department.toLowerCase()))
            ) {
                return false;
            }
            return true;
        });
    }, [data, filters.sector, filters.district, filters.department]);

    const statusCounts = useMemo(() => {
        const counts = {
            notStarted: 0,
            inProgress: 0,
            completed: 0,
        };

        for (const project of scopedProjects) {
            const status = statusFromRow(project);
            if (status === "not-started") counts.notStarted += 1;
            else if (status === "in-progress") counts.inProgress += 1;
            else if (status === "completed") counts.completed += 1;
        }

        return counts;
    }, [scopedProjects]);

    const filteredProjects = useMemo(() => {
        if (filters.projectStatus === "all") return scopedProjects;
        return scopedProjects.filter((project) => statusFromRow(project) === filters.projectStatus);
    }, [scopedProjects, filters.projectStatus]);

    const ownedProjects = useMemo(
        () => filteredProjects.filter((project) => project.isOwned !== false),
        [filteredProjects],
    );

    const departmentPerformance = useMemo(() => {
        const rows = (data?.departmentPerformance ?? []).filter((row) => {
            if (
                filters.department !== "all" &&
                !row.department.toLowerCase().includes(filters.department.toLowerCase())
            ) {
                return false;
            }
            return true;
        });

        if (deptSort === "alphabetical") {
            return rows.slice().sort((a, b) => a.department.localeCompare(b.department));
        }
        if (deptSort === "recently-updated") {
            return rows.slice().sort((a, b) => {
                const ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
                const tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
                return tb - ta;
            });
        }
        return rows.slice().sort((a, b) => {
            const sa = a.physicalProgress + a.financialProgress;
            const sb = b.physicalProgress + b.financialProgress;
            if (sa !== sb) return sa - sb;
            return a.department.localeCompare(b.department);
        });
    }, [data, filters.department, deptSort]);

    const alerts = data?.alerts;

    return (
        <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
            <KeralaHeader
                homeHref="/secretary/dashboard"
                right={<OfficerUserMenu roleLabel="Secretary" />}
            />
            <SecretaryNav />

            <main className="container mx-auto flex-1 space-y-5 px-4 py-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Secretary Executive Dashboard
                            </p>
                            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                                {data?.scope.secretaryName ?? "Administrative Department"}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Last data update: {fmtDateTime(data?.summary.lastDataUpdate ?? null)}
                        </div>
                    </div>
                </section>

                {isLoading && (
                    <Card>
                        <CardContent className="flex items-center gap-2 py-8 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading dashboard data...
                        </CardContent>
                    </Card>
                )}

                {error && (
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-8 text-sm text-destructive">
                            {error.message}
                        </CardContent>
                    </Card>
                )}

                {data && (
                    <>
                        <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
                            <span className="font-semibold uppercase tracking-[0.14em]">Global Snapshot:</span>{" "}
                            Top KPI cards are not affected by quick filters.
                        </section>

                        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <KpiRowCard title="Total Departments" value={data.summary.totalDepartments} icon={TableProperties} />
                            <KpiRowCard title="Total Projects" value={data.summary.totalProjects} icon={FolderOpen} />
                            <KpiRowCard title="Total Indicators" value={data.summary.totalIndicators} icon={FileText} />
                            <KpiRowCard title="Physical Progress" value={fmtPercent(data.summary.physicalProgress)} icon={ArrowUpDown} />
                            <KpiRowCard title="Financial Progress" value={fmtPercent(data.summary.financialProgress)} icon={ArrowUpDown} />
                            <KpiRowCard title="Images Uploaded" value={data.summary.imagesUploaded} icon={Image} />
                            <KpiRowCard title="Videos Uploaded" value={data.summary.videosUploaded} icon={PlayCircle} />
                            <KpiRowCard title="Documents Uploaded" value={data.summary.documentsUploaded} icon={Paperclip} />
                        </section>

                        <section className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4 shadow-sm">
                            <div className="rounded-xl border border-sky-200 bg-sky-100/60 px-3 py-2 text-xs text-sky-900">
                                <span className="font-semibold uppercase tracking-[0.14em]">Filtered View:</span>{" "}
                                Sections below respond to Quick Filters and Project Status.
                            </div>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    <Filter className="h-3.5 w-3.5" />
                                    Quick Filters
                                </div>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <SelectField
                                        label="Project Status"
                                        value={filters.projectStatus}
                                        onChange={(value) =>
                                            setFilters((prev) => ({ ...prev, projectStatus: value as ProjectStatusKey }))
                                        }
                                        options={[
                                            "all",
                                            "not-started",
                                            "in-progress",
                                            "completed",
                                        ]}
                                    />
                                    <SelectField
                                        label="Sector"
                                        value={filters.sector}
                                        onChange={(value) => setFilters((prev) => ({ ...prev, sector: value }))}
                                        options={["all", ...sectorOptions]}
                                    />
                                    <SelectField
                                        label="District"
                                        value={filters.district}
                                        onChange={(value) => setFilters((prev) => ({ ...prev, district: value }))}
                                        options={["all", ...districtOptions]}
                                    />
                                    <SelectField
                                        label="Department"
                                        value={filters.department}
                                        onChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}
                                        options={["all", ...departmentOptions]}
                                        searchable
                                    />
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Project Status
                                    </h2>
                                    <span className="text-xs text-slate-500">Not Started, In Progress, Completed</span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    <StatusPill
                                        active={filters.projectStatus === "not-started"}
                                        title="Not Started"
                                        value={statusCounts?.notStarted ?? 0}
                                        tone="slate"
                                        onClick={() => setFilters((prev) => ({ ...prev, projectStatus: "not-started" }))}
                                    />
                                    <StatusPill
                                        active={filters.projectStatus === "in-progress"}
                                        title="In Progress"
                                        value={statusCounts?.inProgress ?? 0}
                                        tone="blue"
                                        onClick={() => setFilters((prev) => ({ ...prev, projectStatus: "in-progress" }))}
                                    />
                                    <StatusPill
                                        active={filters.projectStatus === "completed"}
                                        title="Completed"
                                        value={statusCounts?.completed ?? 0}
                                        tone="green"
                                        onClick={() => setFilters((prev) => ({ ...prev, projectStatus: "completed" }))}
                                    />
                                </div>
                                <div className="mt-3">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setFilters((prev) => ({ ...prev, projectStatus: "all" }))}
                                    >
                                        Clear Status Filter
                                    </Button>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Department Performance
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500">Sort by</span>
                                        <select
                                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs"
                                            value={deptSort}
                                            onChange={(e) => setDeptSort(e.target.value as DeptSort)}
                                        >
                                            <option value="lowest-progress">Lowest progress first</option>
                                            <option value="recently-updated">Recently updated</option>
                                            <option value="alphabetical">Alphabetical</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Department</TableHead>
                                                <TableHead className="text-right">Projects</TableHead>
                                                <TableHead className="text-right">Indicators</TableHead>
                                                <TableHead className="text-right">Physical %</TableHead>
                                                <TableHead className="text-right">Financial %</TableHead>
                                                <TableHead>Last Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {departmentPerformance.map((row) => (
                                                <TableRow key={row.deptId || row.department} className="cursor-pointer hover:bg-slate-50/70">
                                                    <TableCell className="font-medium">
                                                        <Link
                                                            href={`/secretary/departments/${row.deptPublicId ?? row.deptId}`}
                                                            className="underline-offset-4 hover:underline"
                                                        >
                                                            {row.department}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell className="text-right">{fmtNumber(row.projects)}</TableCell>
                                                    <TableCell className="text-right">{fmtNumber(row.indicators)}</TableCell>
                                                    <TableCell className="text-right">{fmtPercent(row.physicalProgress)}</TableCell>
                                                    <TableCell className="text-right">{fmtPercent(row.financialProgress)}</TableCell>
                                                    <TableCell>{fmtDateTime(row.lastUpdated)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Owned Project List
                                    </h2>
                                    <span className="text-xs text-slate-500">{fmtNumber(ownedProjects.length)} projects</span>
                                </div>

                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Project</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Physical %</TableHead>
                                                <TableHead className="text-right">Financial %</TableHead>
                                                <TableHead className="text-right">Indicators</TableHead>
                                                <TableHead>Last Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {ownedProjects.map((project) => (
                                                <TableRow key={project.projectId}>
                                                    <TableCell>
                                                        <Link href={`/secretary/projects?projectId=${project.projectPublicId ?? project.projectId}`} className="font-medium underline-offset-4 hover:underline">
                                                            {project.projectName ?? "Untitled project"}
                                                        </Link>
                                                        <div className="text-xs text-slate-500">{project.projectCode ?? "-"}</div>
                                                        <div className="text-xs text-slate-500">{project.departmentNames}</div>
                                                    </TableCell>
                                                    <TableCell>{statusFromRow(project)}</TableCell>
                                                    <TableCell className="text-right">{fmtPercent(project.physicalProgress)}</TableCell>
                                                    <TableCell className="text-right">{fmtPercent(project.financialProgress)}</TableCell>
                                                    <TableCell className="text-right">{fmtNumber(project.indicators)}</TableCell>
                                                    <TableCell>{fmtDateTime(project.lastUpdated)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {ownedProjects.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-slate-500">
                                                        No owned projects match current filters.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </section>
                        </section>

                        <section className="rounded-2xl border border-amber-300 bg-amber-50/40 p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert className="h-4 w-4 text-amber-700" />
                                    <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
                                        Alerts and Defaulters
                                    </h2>
                                </div>
                                <div className="text-xs text-amber-800">
                                    Focus area for intervention and review
                                </div>
                            </div>

                            <div className="mb-3 flex flex-wrap gap-2">
                                <AlertTabButton active={alertTab === "pending-progress"} onClick={() => setAlertTab("pending-progress")}>
                                    Pending Progress Updates
                                </AlertTabButton>
                                <AlertTabButton active={alertTab === "pending-verification"} onClick={() => setAlertTab("pending-verification")}>
                                    Pending Verification
                                </AlertTabButton>
                                <AlertTabButton active={alertTab === "no-activity"} onClick={() => setAlertTab("no-activity")}>
                                    No Recent Activity
                                </AlertTabButton>
                                <AlertTabButton active={alertTab === "stale-indicators"} onClick={() => setAlertTab("stale-indicators")}>
                                    Indicators Without Updates
                                </AlertTabButton>
                            </div>

                            <div className="mb-3 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900">
                                <span className="font-semibold uppercase tracking-[0.14em]">Alert Rules:</span>{" "}
                                Pending updates &gt; {data.thresholds.pendingDays} days, No activity &gt; {data.thresholds.inactivityDays} days,
                                Indicator stale &gt; {data.thresholds.indicatorStaleDays} days.
                            </div>

                            {alertTab === "pending-progress" && (
                                <SimpleAlertTable
                                    headers={["Department", `Pending Days (>${data.thresholds.pendingDays})`]}
                                    rows={(alerts?.pendingProgressUpdates ?? []).map((row) => [
                                        row.department,
                                        fmtNumber(row.pendingDays),
                                    ])}
                                />
                            )}

                            {alertTab === "pending-verification" && (
                                <Card className="border-amber-300 bg-white">
                                    <CardContent className="flex items-center justify-between py-6">
                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                            <AlertTriangle className="h-4 w-4 text-amber-700" />
                                            Projects/indicators awaiting verification
                                        </div>
                                        <Badge variant="warning" className="text-sm">
                                            {fmtNumber(alerts?.pendingVerificationCount ?? 0)} pending
                                        </Badge>
                                    </CardContent>
                                </Card>
                            )}

                            {alertTab === "no-activity" && (
                                <SimpleAlertTable
                                    headers={["Department", `Inactive Days (>${data.thresholds.inactivityDays})`]}
                                    rows={(alerts?.noRecentActivity ?? []).map((row) => [
                                        row.department,
                                        fmtNumber(row.inactiveDays),
                                    ])}
                                />
                            )}

                            {alertTab === "stale-indicators" && (
                                <SimpleAlertTable
                                    headers={["Indicator", "Project", "Department", `Stale Days (>${data.thresholds.indicatorStaleDays})`]}
                                    rows={(alerts?.indicatorsWithoutUpdates ?? []).map((row) => [
                                        row.indicatorName,
                                        row.projectName,
                                        row.department,
                                        fmtNumber(row.staleDays),
                                    ])}
                                />
                            )}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Recent Activity
                                </h2>
                                <span className="text-xs text-slate-500">Latest 20 events</span>
                            </div>
                            <div className="space-y-2">
                                {data.recentActivity.map((event) => (
                                    <div
                                        key={event.eventId}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Bell className="h-3.5 w-3.5 text-slate-500" />
                                            <span className="font-medium text-slate-800">{eventLabel(event.action)}</span>
                                            <span className="text-slate-500">by {event.actor}</span>
                                        </div>
                                        <span className="text-xs text-slate-500">{fmtDateTime(event.loggedOn)}</span>
                                    </div>
                                ))}
                                {data.recentActivity.length === 0 && (
                                    <div className="rounded-xl border border-slate-200 px-3 py-4 text-sm text-slate-500">
                                        No recent activity in this scope.
                                    </div>
                                )}
                            </div>
                        </section>

                    </>
                )}
            </main>

            <SiteFooter />
        </div>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
    searchable = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    searchable?: boolean;
}) {
    const listId = `${label.toLowerCase().replace(/\s+/g, "-")}-options`;

    if (searchable) {
        return (
            <label className="space-y-1 text-xs">
                <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
                <input
                    type="text"
                    list={listId}
                    className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                    value={value === "all" ? "" : value}
                    onChange={(e) => onChange(e.target.value.trim() || "all")}
                    placeholder="Type department name..."
                />
                <p className="text-[11px] text-slate-500">Type ahead to filter departments.</p>
                <datalist id={listId}>
                    {options
                        .filter((opt) => opt !== "all")
                        .map((opt) => (
                            <option key={opt} value={opt} />
                        ))}
                </datalist>
            </label>
        );
    }

    return (
        <label className="space-y-1 text-xs">
            <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
            <select
                className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                value={value}
                onChange={(e) => onChange(e.target.value)}
            >
                {options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt === "all" ? "All" : opt}
                    </option>
                ))}
            </select>
        </label>
    );
}

function KpiRowCard({
    title,
    value,
    icon: Icon,
}: {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {typeof value === "number" ? fmtNumber(value) : value}
                    </p>
                </div>
                <span className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600">
                    <Icon className="h-4 w-4" />
                </span>
            </div>
        </div>
    );
}

function StatusPill({
    title,
    value,
    active,
    tone,
    onClick,
}: {
    title: string;
    value: number;
    active: boolean;
    tone: "slate" | "blue" | "green" | "amber" | "rose";
    onClick: () => void;
}) {
    const toneClasses: Record<typeof tone, string> = {
        slate: "border-slate-300 bg-slate-50 text-slate-700",
        blue: "border-blue-300 bg-blue-50 text-blue-700",
        green: "border-emerald-300 bg-emerald-50 text-emerald-700",
        amber: "border-amber-300 bg-amber-50 text-amber-700",
        rose: "border-rose-300 bg-rose-50 text-rose-700",
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-xl border px-3 py-2 text-left transition",
                toneClasses[tone],
                active && "ring-2 ring-slate-400"
            )}
        >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{title}</p>
            <p className="mt-1 text-2xl font-semibold">{fmtNumber(value)}</p>
        </button>
    );
}

function AlertTabButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                active
                    ? "border-amber-700 bg-amber-700 text-white"
                    : "border-amber-300 bg-white text-amber-800"
            )}
        >
            {children}
        </button>
    );
}

function SimpleAlertTable({
    headers,
    rows,
}: {
    headers: string[];
    rows: string[][];
}) {
    return (
        <div className="overflow-x-auto rounded-xl border border-amber-300 bg-white">
            <Table>
                <TableHeader>
                    <TableRow className="bg-amber-50">
                        {headers.map((head) => (
                            <TableHead key={head}>{head}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.length > 0 ? (
                        rows.map((row, idx) => (
                            <TableRow key={idx}>
                                {row.map((cell, cIdx) => (
                                    <TableCell key={`${idx}-${cIdx}`}>{cell}</TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell className="text-slate-500" colSpan={headers.length}>
                                No records found for this alert.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
