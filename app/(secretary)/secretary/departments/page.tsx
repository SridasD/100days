"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet } from "lucide-react";
import { KeralaHeader } from "@/components/layout/KeralaHeader";
import { OfficerUserMenu } from "@/components/layout/OfficerUserMenu";
import { SecretaryNav } from "@/components/layout/SecretaryNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Payload = {
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
};

type DepartmentDetails = {
    summary: {
        deptId: number;
        department: string;
        totalProjects: number;
        totalIndicators: number;
        physicalProgress: number;
        financialProgress: number;
        lastUpdated: string | null;
    };
    projects: Array<{
        projectId: number;
        projectPublicId: string | null;
        projectCode: string;
        projectName: string;
        status: string;
        physicalProgress: number;
        financialProgress: number;
    }>;
};

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

export default function SecretaryDepartmentsPage() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expandedDeptId, setExpandedDeptId] = useState<number | null>(null);
    const [detailsByDept, setDetailsByDept] = useState<Record<number, DepartmentDetails | undefined>>({});
    const [loadingDeptId, setLoadingDeptId] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/secretary/dashboard", { cache: "no-store" })
            .then(async (res) => {
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
                if (!cancelled) setData(body as Payload);
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const toggleExpand = async (deptId: number) => {
        if (expandedDeptId === deptId) {
            setExpandedDeptId(null);
            return;
        }

        setExpandedDeptId(deptId);
        if (detailsByDept[deptId]) return;

        try {
            setLoadingDeptId(deptId);
            const res = await fetch(`/api/secretary/departments/${deptId}`, { cache: "no-store" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
            setDetailsByDept((prev) => ({ ...prev, [deptId]: body as DepartmentDetails }));
        } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to load department details";
            setDetailsByDept((prev) => ({
                ...prev,
                [deptId]: {
                    summary: {
                        deptId,
                        department: "Department",
                        totalProjects: 0,
                        totalIndicators: 0,
                        physicalProgress: 0,
                        financialProgress: 0,
                        lastUpdated: null,
                    },
                    projects: [],
                },
            }));
            setError(message);
        } finally {
            setLoadingDeptId(null);
        }
    };

    const deptInitials = (name: string) => {
        const words = name.split(/\s+/).filter(Boolean);
        const a = words[0]?.[0] ?? "D";
        const b = words[1]?.[0] ?? "P";
        return `${a}${b}`.toUpperCase();
    };

    const totals = useMemo(() => {
        const rows = data?.departmentPerformance ?? [];
        return rows.reduce(
            (acc, row) => {
                acc.projects += row.projects || 0;
                acc.indicators += row.indicators || 0;
                return acc;
            },
            { projects: 0, indicators: 0 },
        );
    }, [data]);

    return (
        <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
            <KeralaHeader homeHref="/secretary/dashboard" right={<OfficerUserMenu roleLabel="Secretary" />} />
            <SecretaryNav />
            <main className="container mx-auto flex-1 space-y-4 px-4 py-6">
                <Card>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                        <div>
                            <h1 className="text-xl font-semibold">Departments</h1>
                            <p className="text-sm text-slate-600">Secretary-scoped department performance and drill-down.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button asChild variant="outline" size="sm" className="gap-1">
                                <Link href="/api/secretary/reports/department-summary?format=xlsx" target="_blank">
                                    <FileSpreadsheet className="h-4 w-4" /> Export Excel
                                </Link>
                            </Button>
                            <Button asChild variant="outline" size="sm" className="gap-1">
                                <Link href="/api/secretary/reports/department-summary?format=pdf" target="_blank">
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
                    <Card className="overflow-hidden border border-slate-200">
                        <CardContent className="p-0">
                            <div className="border-b border-slate-200 px-6 py-5">
                                <h2 className="text-3xl font-semibold text-slate-900">Department-wise Summary</h2>
                                <p className="mt-2 text-lg text-slate-600">
                                    Click any department row to expand its projects, indicator counts, and delivery status inline.
                                </p>
                            </div>

                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50">
                                            <TableHead className="text-xs uppercase tracking-[0.18em] text-slate-500">Department Name</TableHead>
                                            <TableHead className="text-right text-xs uppercase tracking-[0.18em] text-slate-500">Projects</TableHead>
                                            <TableHead className="text-right text-xs uppercase tracking-[0.18em] text-slate-500">Indicators</TableHead>
                                            <TableHead className="text-right text-xs uppercase tracking-[0.18em] text-slate-500">Expand</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.departmentPerformance.map((row) => {
                                            const expanded = expandedDeptId === row.deptId;
                                            const details = detailsByDept[row.deptId];
                                            return (
                                                <Fragment key={row.deptId || row.department}>
                                                    <TableRow
                                                        className="cursor-pointer hover:bg-slate-50"
                                                        onClick={() => void toggleExpand(row.deptId)}
                                                    >
                                                        <TableCell>
                                                            <div className="flex items-center gap-3">
                                                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-xs font-semibold text-emerald-700">
                                                                    {deptInitials(row.department)}
                                                                </span>
                                                                <div>
                                                                    <p className="text-lg font-medium text-slate-900">{row.department}</p>
                                                                    <p className="text-sm text-slate-500">Updated {fmtDate(row.lastUpdated)}</p>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-slate-300 px-3 py-1 text-sm font-medium">
                                                                {fmt(row.projects)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <span className="inline-flex min-w-10 items-center justify-center rounded-full border border-slate-300 px-3 py-1 text-sm font-medium">
                                                                {fmt(row.indicators)}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {expanded ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />}
                                                        </TableCell>
                                                    </TableRow>

                                                    {expanded && (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="bg-slate-50/70 p-4">
                                                                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                                                                    <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                                                                        <p>Physical: {fmtPct(row.physicalProgress)}</p>
                                                                        <p>Financial: {fmtPct(row.financialProgress)}</p>
                                                                        <p>Projects: {fmt(row.projects)}</p>
                                                                        <p>Indicators: {fmt(row.indicators)}</p>
                                                                    </div>

                                                                    {loadingDeptId === row.deptId && <p className="text-sm text-slate-500">Loading details...</p>}

                                                                    {details && details.projects.length > 0 && (
                                                                        <div className="space-y-2">
                                                                            <p className="text-sm font-semibold text-slate-700">Top Projects</p>
                                                                            {details.projects.slice(0, 6).map((project) => (
                                                                                <div key={project.projectId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                                                                                    <div>
                                                                                        <Link href={`/secretary/projects/${project.projectPublicId ?? project.projectId}/indicators`} className="font-medium text-slate-900 underline-offset-4 hover:underline">
                                                                                            {project.projectName}
                                                                                        </Link>
                                                                                        <p className="text-xs text-slate-500">{project.projectCode || "-"}</p>
                                                                                    </div>
                                                                                    <div className="text-xs text-slate-600">
                                                                                        {project.status} · P {fmtPct(project.physicalProgress)} · F {fmtPct(project.financialProgress)}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    <div className="flex flex-wrap gap-3 pt-1 text-sm">
                                                                        <Link href={`/secretary/departments/${row.deptPublicId ?? row.deptId}`} className="font-medium text-kerala-blue underline-offset-4 hover:underline">
                                                                            Open Full Department Details
                                                                        </Link>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                        <TableRow className="bg-slate-100/90 font-semibold text-slate-900">
                                            <TableCell>Total</TableCell>
                                            <TableCell className="text-right">{fmt(totals.projects)}</TableCell>
                                            <TableCell className="text-right">{fmt(totals.indicators)}</TableCell>
                                            <TableCell className="text-right text-slate-500">-</TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </main>
            <SiteFooter />
        </div>
    );
}
