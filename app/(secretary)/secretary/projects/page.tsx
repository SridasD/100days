"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { KeralaHeader } from "@/components/layout/KeralaHeader";
import { OfficerUserMenu } from "@/components/layout/OfficerUserMenu";
import { SecretaryNav } from "@/components/layout/SecretaryNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Project = {
    projectId: number;
    projectCode: string | null;
    projectName: string | null;
    isOwned?: boolean;
    sectorName: string;
    departmentNames: string;
    districtNames: string;
    isCompleted: number;
    physicalProgress: number;
    financialProgress: number;
    indicators: number;
    lastUpdated: string | null;
};

type Payload = { projects: Project[] };
type ProjectStatusKey = "all" | "not-started" | "in-progress" | "completed";
type ProjectSortKey =
    | "name-asc"
    | "name-desc"
    | "status"
    | "physical-desc"
    | "financial-desc"
    | "recently-updated";

function statusLabel(v: number) {
    if (v === 2) return "completed";
    if (v === 1) return "in-progress";
    return "not-started";
}

function fmt(value: number) {
    return new Intl.NumberFormat("en-IN").format(value || 0);
}

function fmtPct(value: number) {
    return `${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value || 0)}%`;
}

function fmtDate(value: string | null) {
    if (!value) return "-";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-IN");
}

function SecretaryProjectsPageContent() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<ProjectStatusKey>("all");
    const [sectorFilter, setSectorFilter] = useState<string>("all");
    const [districtFilter, setDistrictFilter] = useState<string>("all");
    const [departmentFilter, setDepartmentFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<ProjectSortKey>("name-asc");
    const searchParams = useSearchParams();

    useEffect(() => {
        let cancelled = false;
        fetch("/api/secretary/dashboard", { cache: "no-store" })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
                if (!cancelled) setData({ projects: (body.projects ?? []) as Project[] });
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const projectIdFilter = Number(searchParams.get("projectId") ?? "0");

    const projects = useMemo(() => {
        const rows = data?.projects ?? [];
        const idFiltered = projectIdFilter > 0 ? rows.filter((r) => r.projectId === projectIdFilter) : rows;

        const scoped = idFiltered.filter((row) => {
            if (statusFilter !== "all" && statusLabel(row.isCompleted) !== statusFilter) {
                return false;
            }
            if (sectorFilter !== "all" && row.sectorName !== sectorFilter) {
                return false;
            }
            if (
                districtFilter !== "all" &&
                !row.districtNames
                    .split(",")
                    .map((d) => d.trim())
                    .includes(districtFilter)
            ) {
                return false;
            }
            if (
                departmentFilter !== "all" &&
                !row.departmentNames
                    .split(",")
                    .map((d) => d.trim())
                    .includes(departmentFilter)
            ) {
                return false;
            }
            return true;
        });

        return scoped.slice().sort((a, b) => {
            if (sortBy === "name-asc") {
                return (a.projectName ?? "").localeCompare(b.projectName ?? "");
            }
            if (sortBy === "name-desc") {
                return (b.projectName ?? "").localeCompare(a.projectName ?? "");
            }
            if (sortBy === "status") {
                const order: Record<string, number> = { "not-started": 0, "in-progress": 1, completed: 2 };
                const sa = order[statusLabel(a.isCompleted)] ?? 99;
                const sb = order[statusLabel(b.isCompleted)] ?? 99;
                if (sa !== sb) return sa - sb;
                return (a.projectName ?? "").localeCompare(b.projectName ?? "");
            }
            if (sortBy === "physical-desc") {
                if (b.physicalProgress !== a.physicalProgress) return b.physicalProgress - a.physicalProgress;
                return (a.projectName ?? "").localeCompare(b.projectName ?? "");
            }
            if (sortBy === "financial-desc") {
                if (b.financialProgress !== a.financialProgress) return b.financialProgress - a.financialProgress;
                return (a.projectName ?? "").localeCompare(b.projectName ?? "");
            }

            const ta = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const tb = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return tb - ta;
        });
    }, [data, projectIdFilter, statusFilter, sectorFilter, districtFilter, departmentFilter, sortBy]);

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
        const rows = data?.projects ?? [];
        return Array.from(
            new Set(
                rows
                    .flatMap((r) => r.departmentNames.split(",").map((v) => v.trim()))
                    .filter((v) => v && v !== "Unassigned")
            )
        ).sort();
    }, [data]);

    return (
        <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
            <KeralaHeader homeHref="/secretary/dashboard" right={<OfficerUserMenu roleLabel="Secretary" />} />
            <SecretaryNav />
            <main className="container mx-auto flex-1 space-y-4 px-4 py-6">
                <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div>
                            <h1 className="text-xl font-semibold">Projects</h1>
                            <p className="text-sm text-slate-600">Secretary project view with latest progress and verification state.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm" className="gap-1">
                                <Link href="/api/secretary/reports/lagging-analysis?format=xlsx" target="_blank">
                                    <FileSpreadsheet className="h-4 w-4" /> Lagging Analysis Excel
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="gap-1">
                                <Link href="/api/secretary/reports/project-summary?format=xlsx" target="_blank">
                                    <FileSpreadsheet className="h-4 w-4" /> Export Excel
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="gap-1">
                                <Link href="/api/secretary/reports/project-summary?format=pdf" target="_blank">
                                    <Download className="h-4 w-4" /> Export PDF
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {error && (
                    <Card>
                        <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
                    </Card>
                )}

                {data && (
                    <>
                        <Card>
                            <CardContent className="grid gap-3 py-4 md:grid-cols-2 xl:grid-cols-5">
                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">Project Status</span>
                                    <select
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as ProjectStatusKey)}
                                    >
                                        <option value="all">All</option>
                                        <option value="not-started">Not Started</option>
                                        <option value="in-progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">Sector</span>
                                    <select
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                                        value={sectorFilter}
                                        onChange={(e) => setSectorFilter(e.target.value)}
                                    >
                                        <option value="all">All</option>
                                        {sectorOptions.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">District</span>
                                    <select
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                                        value={districtFilter}
                                        onChange={(e) => setDistrictFilter(e.target.value)}
                                    >
                                        <option value="all">All</option>
                                        {districtOptions.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">Department</span>
                                    <select
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                                        value={departmentFilter}
                                        onChange={(e) => setDepartmentFilter(e.target.value)}
                                    >
                                        <option value="all">All</option>
                                        {departmentOptions.map((opt) => (
                                            <option key={opt} value={opt}>
                                                {opt}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1 text-xs">
                                    <span className="font-semibold uppercase tracking-[0.14em] text-slate-500">Sort By</span>
                                    <select
                                        className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as ProjectSortKey)}
                                    >
                                        <option value="name-asc">Project Name (A-Z)</option>
                                        <option value="name-desc">Project Name (Z-A)</option>
                                        <option value="status">Status</option>
                                        <option value="physical-desc">Physical Progress (High-Low)</option>
                                        <option value="financial-desc">Financial Progress (High-Low)</option>
                                        <option value="recently-updated">Recently Updated</option>
                                    </select>
                                </label>
                            </CardContent>
                        </Card>

                        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50">
                                        <TableHead>Project</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Physical %</TableHead>
                                        <TableHead className="text-right">Financial %</TableHead>
                                        <TableHead className="text-right">Indicators</TableHead>
                                        <TableHead>Last Updated</TableHead>
                                        <TableHead>Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {projects.map((project) => (
                                        <TableRow key={project.projectId}>
                                            <TableCell>
                                                <Link
                                                    href={`/secretary/projects/${project.projectId}/indicators`}
                                                    className="font-medium underline-offset-4 hover:underline"
                                                >
                                                    {project.projectName ?? "Untitled project"}
                                                </Link>
                                                {project.isOwned === false && (
                                                    <div className="mt-1">
                                                        <Badge variant="outline" className="border-[#C8A951] bg-[#FFF8E1] text-[#7A5A00]">
                                                            Supporting Participation
                                                        </Badge>
                                                    </div>
                                                )}
                                                <div className="text-xs text-slate-500">{project.projectCode ?? "-"}</div>
                                            </TableCell>
                                            <TableCell>{project.departmentNames || "Unassigned"}</TableCell>
                                            <TableCell>{statusLabel(project.isCompleted)}</TableCell>
                                            <TableCell className="text-right">{fmtPct(project.physicalProgress)}</TableCell>
                                            <TableCell className="text-right">{fmtPct(project.financialProgress)}</TableCell>
                                            <TableCell className="text-right">{fmt(project.indicators)}</TableCell>
                                            <TableCell>{fmtDate(project.lastUpdated)}</TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/secretary/projects/${project.projectId}/indicators`}
                                                    className="text-sm font-medium text-kerala-blue underline-offset-4 hover:underline"
                                                >
                                                    View Indicators
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {projects.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-slate-500">
                                                No projects found.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}

                <Link href="/secretary/dashboard" className="text-sm text-kerala-blue underline-offset-4 hover:underline">
                    Back to dashboard
                </Link>
            </main>
            <SiteFooter />
        </div>
    );
}

export default function SecretaryProjectsPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
                    <KeralaHeader homeHref="/secretary/dashboard" right={<OfficerUserMenu roleLabel="Secretary" />} />
                    <SecretaryNav />
                    <main className="container mx-auto flex-1 px-4 py-6">
                        <Card>
                            <CardContent className="py-6 text-sm text-slate-600">Loading projects...</CardContent>
                        </Card>
                    </main>
                    <SiteFooter />
                </div>
            }
        >
            <SecretaryProjectsPageContent />
        </Suspense>
    );
}
