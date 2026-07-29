"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Loader2 } from "lucide-react";
import { KeralaHeader } from "@/components/layout/KeralaHeader";
import { OfficerUserMenu } from "@/components/layout/OfficerUserMenu";
import { SecretaryNav } from "@/components/layout/SecretaryNav";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type ProjectStatusKey = "all" | "not-started" | "in-progress" | "completed";

type Payload = {
    scope: {
        secretaryName: string | null;
    };
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
};

type Filters = {
    projectStatus: ProjectStatusKey;
    sector: string;
    district: string;
    department: string;
};

const numberFmt = new Intl.NumberFormat("en-IN");
const percentFmt = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
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

function statusFromCompleted(value: number): ProjectStatusKey {
    if (value === 2) return "completed";
    if (value === 1) return "in-progress";
    return "not-started";
}

export default function SecretarySupportingDashboardPage() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [filters, setFilters] = useState<Filters>({
        projectStatus: "all",
        sector: "all",
        district: "all",
        department: "all",
    });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            try {
                const res = await fetch("/api/secretary/supporting-dashboard", { cache: "no-store" });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
                if (!cancelled) {
                    setData(body as Payload);
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

    const rows = data?.supportingParticipationIndicators ?? [];

    const sectorOptions = useMemo(
        () => Array.from(new Set(rows.map((r) => r.sectorName).filter(Boolean))).sort(),
        [rows],
    );

    const districtOptions = useMemo(
        () => Array.from(new Set(rows.map((r) => r.districtName).filter(Boolean))).sort(),
        [rows],
    );

    const departmentOptions = useMemo(() => {
        return Array.from(
            new Set(
                rows
                    .flatMap((r) => r.departmentNames.split(",").map((v) => v.trim()))
                    .filter(Boolean),
            ),
        ).sort();
    }, [rows]);

    const filtered = useMemo(() => {
        return rows.filter((row) => {
            if (filters.projectStatus !== "all" && statusFromCompleted(row.isCompleted) !== filters.projectStatus) {
                return false;
            }
            if (filters.sector !== "all" && row.sectorName !== filters.sector) {
                return false;
            }
            if (filters.district !== "all" && row.districtName !== filters.district) {
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
    }, [rows, filters]);

    const supportingProjectCount = useMemo(
        () => new Set(filtered.map((r) => r.projectId)).size,
        [filtered],
    );

    return (
        <div className="flex min-h-screen flex-col bg-[#F3F4F6]">
            <KeralaHeader
                homeHref="/secretary/dashboard"
                right={<OfficerUserMenu roleLabel="Secretary" />}
            />
            <SecretaryNav />

            <main className="container mx-auto flex-1 space-y-5 px-4 py-6">
                <section className="rounded-2xl border border-[#EAD7A6] bg-[#FFF8E1] p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7A5A00]">
                                Co-Implementation Dashboard
                            </p>
                            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                                {data?.scope.secretaryName ?? "Administrative Department"}
                            </h1>
                            <p className="mt-1 text-sm text-[#7A5A00]">
                                Indicator-level supporting participation only. Owned projects are kept in the main dashboard.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#7A5A00]">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {fmtNumber(filtered.length)} indicators across {fmtNumber(supportingProjectCount)} projects
                        </div>
                    </div>
                </section>

                {isLoading && (
                    <Card>
                        <CardContent className="flex items-center gap-2 py-8 text-sm text-slate-600">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading supporting dashboard data...
                        </CardContent>
                    </Card>
                )}

                {error && (
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-8 text-sm text-destructive">{error.message}</CardContent>
                    </Card>
                )}

                {data && (
                    <>
                        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <SelectField
                                    label="Project Status"
                                    value={filters.projectStatus}
                                    onChange={(value) =>
                                        setFilters((prev) => ({ ...prev, projectStatus: value as ProjectStatusKey }))
                                    }
                                    options={["all", "not-started", "in-progress", "completed"]}
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
                                    label="Project's Implementing Department"
                                    value={filters.department}
                                    onChange={(value) => setFilters((prev) => ({ ...prev, department: value }))}
                                    options={["all", ...departmentOptions]}
                                    searchable
                                />
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-[#EAD7A6] bg-white">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-[#FFF8E1]">
                                            <TableHead>Supporting Indicator</TableHead>
                                            <TableHead>Project</TableHead>
                                            <TableHead>Project&apos;s Implementing Department</TableHead>
                                            <TableHead>District</TableHead>
                                            <TableHead className="text-right">Physical %</TableHead>
                                            <TableHead className="text-right">Financial %</TableHead>
                                            <TableHead>Last Updated</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.map((row) => (
                                            <TableRow key={row.indicatorId}>
                                                <TableCell className="font-medium">{row.indicatorName}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{row.projectName}</div>
                                                    <div className="text-xs text-slate-500">{row.projectCode ?? "-"}</div>
                                                    <div className="text-xs text-slate-500">{statusFromCompleted(row.isCompleted)}</div>
                                                </TableCell>
                                                <TableCell>{row.departmentNames}</TableCell>
                                                <TableCell>{row.districtName}</TableCell>
                                                <TableCell className="text-right">{fmtPercent(row.physicalProgress)}</TableCell>
                                                <TableCell className="text-right">{fmtPercent(row.financialProgress)}</TableCell>
                                                <TableCell>{fmtDateTime(row.lastUpdated)}</TableCell>
                                            </TableRow>
                                        ))}
                                        {filtered.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-slate-500">
                                                    No supporting participation indicators match current filters.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </section>

                        <Link href="/secretary/dashboard" className="text-sm text-kerala-blue underline-offset-4 hover:underline">
                            Back to main dashboard
                        </Link>
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
                    placeholder="Type implementing department name..."
                />
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
