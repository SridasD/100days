"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import { KeralaHeader } from "@/components/layout/KeralaHeader";
import { OfficerUserMenu } from "@/components/layout/OfficerUserMenu";
import { SecretaryNav } from "@/components/layout/SecretaryNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Payload = {
    summary: {
        deptId: number;
        department: string;
        totalProjects: number;
        totalIndicators: number;
        physicalProgress: number;
        financialProgress: number;
        imagesUploaded: number;
        videosUploaded: number;
        lastUpdated: string | null;
    };
    projects: Array<{
        projectId: number;
        projectCode: string;
        projectName: string;
        status: string;
        physicalProgress: number;
        financialProgress: number;
        assignedHod: string;
        lastUpdated: string | null;
    }>;
    indicators: Array<{
        indicatorId: number;
        indicatorName: string;
        projectCode: string;
        projectName: string;
        progress: number;
        imagesCount: number;
        videosCount: number;
        lastUpdated: string | null;
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

export default function SecretaryDepartmentDetailsPage({
    params,
}: {
    params: Promise<{ deptId: string }>;
}) {
    const { deptId } = use(params);
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/secretary/departments/${deptId}`, { cache: "no-store" })
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
    }, [deptId]);

    return (
        <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
            <KeralaHeader homeHref="/secretary/dashboard" right={<OfficerUserMenu roleLabel="Secretary" />} />
            <SecretaryNav />
            <main className="container mx-auto flex-1 space-y-4 px-4 py-6">
                {error && (
                    <Card>
                        <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
                    </Card>
                )}

                {data && (
                    <>
                        <Card>
                            <CardContent className="py-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <h1 className="text-xl font-semibold">{data.summary.department}</h1>
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
                                </div>
                                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                                    <p>Total Projects: {fmt(data.summary.totalProjects)}</p>
                                    <p>Total Indicators: {fmt(data.summary.totalIndicators)}</p>
                                    <p>Physical: {fmtPct(data.summary.physicalProgress)}</p>
                                    <p>Financial: {fmtPct(data.summary.financialProgress)}</p>
                                    <p>Images: {fmt(data.summary.imagesUploaded)}</p>
                                    <p>Videos: {fmt(data.summary.videosUploaded)}</p>
                                    <p>Last Updated: {fmtDate(data.summary.lastUpdated)}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <h2 className="mb-3 text-base font-semibold">Project List</h2>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Project</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Physical %</TableHead>
                                                <TableHead className="text-right">Financial %</TableHead>
                                                <TableHead>Assigned HOD</TableHead>
                                                <TableHead>Last Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.projects.map((row) => (
                                                <TableRow key={row.projectId}>
                                                    <TableCell>
                                                        <p>{row.projectName}</p>
                                                        <p className="text-xs text-slate-500">{row.projectCode || "-"}</p>
                                                    </TableCell>
                                                    <TableCell>{row.status}</TableCell>
                                                    <TableCell className="text-right">{fmtPct(row.physicalProgress)}</TableCell>
                                                    <TableCell className="text-right">{fmtPct(row.financialProgress)}</TableCell>
                                                    <TableCell>{row.assignedHod}</TableCell>
                                                    <TableCell>{fmtDate(row.lastUpdated)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <h2 className="mb-3 text-base font-semibold">Indicator Summary</h2>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Indicator</TableHead>
                                                <TableHead>Project</TableHead>
                                                <TableHead className="text-right">Progress %</TableHead>
                                                <TableHead>Last Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.indicators.map((row) => (
                                                <TableRow key={row.indicatorId}>
                                                    <TableCell>{row.indicatorName}</TableCell>
                                                    <TableCell>
                                                        <p>{row.projectName}</p>
                                                        <p className="text-xs text-slate-500">{row.projectCode || "-"}</p>
                                                    </TableCell>
                                                    <TableCell className="text-right">{fmtPct(row.progress)}</TableCell>
                                                    <TableCell>{fmtDate(row.lastUpdated)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                <Link href="/secretary/departments" className="text-sm text-kerala-blue underline-offset-4 hover:underline">
                    Back to departments
                </Link>
            </main>
            <SiteFooter />
        </div>
    );
}
