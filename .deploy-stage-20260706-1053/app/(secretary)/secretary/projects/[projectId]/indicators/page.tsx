"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { KeralaHeader } from "@/components/layout/KeralaHeader";
import { OfficerUserMenu } from "@/components/layout/OfficerUserMenu";
import { SecretaryNav } from "@/components/layout/SecretaryNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Payload = {
    project: {
        projectId: number;
        projectCode: string;
        projectName: string;
        isOwned: boolean;
        status: string;
        departmentNames: string;
        sectorName: string;
        districtNames: string;
    };
    indicators: Array<{
        indicatorId: number;
        indicatorName: string;
        physicalProgress: number;
        financialProgress: number;
        isSupportingParticipation: boolean;
        district: string;
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

export default function SecretaryProjectIndicatorsPage({
    params,
}: {
    params: Promise<{ projectId: string }>;
}) {
    const { projectId } = use(params);
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/secretary/projects/${projectId}/indicators`, { cache: "no-store" })
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
    }, [projectId]);

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
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-xl font-semibold">{data.project.projectName}</h1>
                                    {data.project.isOwned === false && (
                                        <Badge variant="outline" className="border-[#C8A951] bg-[#FFF8E1] text-[#7A5A00]">
                                            Supporting Participation
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-sm text-slate-600">{data.project.projectCode}</p>
                                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2 xl:grid-cols-4">
                                    <p>Status: {data.project.status}</p>
                                    <p>Department: {data.project.departmentNames}</p>
                                    <p>Sector: {data.project.sectorName}</p>
                                    <p>Districts: {data.project.districtNames}</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-4">
                                <h2 className="mb-3 text-base font-semibold">Indicators</h2>
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-slate-50">
                                                <TableHead>Indicator</TableHead>
                                                <TableHead>District</TableHead>
                                                <TableHead className="text-right">Images</TableHead>
                                                <TableHead className="text-right">Videos</TableHead>
                                                <TableHead className="text-right">Physical %</TableHead>
                                                <TableHead className="text-right">Financial %</TableHead>
                                                <TableHead>Last Updated</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.indicators.map((row) => (
                                                <TableRow key={row.indicatorId}>
                                                    <TableCell>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span>{row.indicatorName}</span>
                                                            {row.isSupportingParticipation && (
                                                                <Badge variant="outline" className="border-[#C8A951] bg-[#FFF8E1] text-[#7A5A00]">
                                                                    Supporting Participation
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>{row.district}</TableCell>
                                                    <TableCell className="text-right">{fmt(row.imagesCount)}</TableCell>
                                                    <TableCell className="text-right">{fmt(row.videosCount)}</TableCell>
                                                    <TableCell className="text-right">{fmtPct(row.physicalProgress)}</TableCell>
                                                    <TableCell className="text-right">{fmtPct(row.financialProgress)}</TableCell>
                                                    <TableCell>{fmtDate(row.lastUpdated)}</TableCell>
                                                </TableRow>
                                            ))}
                                            {data.indicators.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="text-slate-500">
                                                        No indicators found for this project.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}

                <Link href="/secretary/projects" className="text-sm text-kerala-blue underline-offset-4 hover:underline">
                    Back to projects
                </Link>
            </main>
            <SiteFooter />
        </div>
    );
}
