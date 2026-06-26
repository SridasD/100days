'use client';

import { Fragment, type KeyboardEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowUpRight,
    Building2,
    ChevronDown,
    ChevronUp,
    ChevronsUpDown,
    CircleDot,
    FileStack,
    FolderKanban,
    Loader2,
    ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

type DepartmentProject = {
    projectId: number;
    projectCode: string | null;
    name: string;
    indicatorsTotal: number;
    indicatorsCompleted: number;
    physicalPct: number;
    financialPct: number;
    status: 'completed' | 'in-progress' | 'not-started';
    verified: boolean;
};

type SummaryResponse = {
    timestamp: string;
    stats: {
        totalDepartments: number;
        totalProjects: number;
        completedProjects: number;
        inProgressProjects: number;
    };
    departments: Array<{
        secId: number;
        departmentName: string;
        projectCount: number;
        indicatorCount: number;
        lastUpdated: string | null;
    }>;
};

type DepartmentDetailResponse = {
    department: {
        secId: number;
        nameMal: string;
        projects: DepartmentProject[];
    };
};

type SortKey = 'departmentName' | 'projectCount' | 'indicatorCount';

type ExpandedDepartmentState = {
    loading: boolean;
    projects: DepartmentProject[];
    error: string | null;
};

const numberFormatter = new Intl.NumberFormat('en-IN');

function formatNumber(value: number) {
    return numberFormatter.format(value || 0);
}

function formatDate(value: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

function statusMeta(status: DepartmentProject['status']) {
    if (status === 'completed') {
        return { label: 'Completed', variant: 'success' as const };
    }
    if (status === 'in-progress') {
        return { label: 'In Progress', variant: 'warning' as const };
    }
    return { label: 'Not Started', variant: 'neutral' as const };
}

function SortHeader({
    active,
    direction,
    label,
    onClick,
    align = 'left',
}: {
    active: boolean;
    direction: 'asc' | 'desc';
    label: string;
    onClick: () => void;
    align?: 'left' | 'right';
}) {
    const Icon = !active ? ChevronsUpDown : direction === 'asc' ? ChevronUp : ChevronDown;
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground ${align === 'right' ? 'ml-auto' : ''}`}
        >
            <span>{label}</span>
            <Icon className="h-3.5 w-3.5" />
        </button>
    );
}

function SummaryCard({
    title,
    value,
    note,
}: {
    title: string;
    value: number;
    note: string;
}) {
    return (
        <Card className="shadow-sm">
            <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    {title}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                    {formatNumber(value)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{note}</p>
            </CardContent>
        </Card>
    );
}

export default function OsdDashboardPage() {
    const [data, setData] = useState<SummaryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('projectCount');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [expandedDepartmentId, setExpandedDepartmentId] = useState<number | null>(null);
    const [expandedDepartments, setExpandedDepartments] = useState<Record<number, ExpandedDepartmentState>>({});

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/admin/osd/summary', {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                    throw new Error(body.error ?? `HTTP ${res.status}`);
                }
                setData(body as SummaryResponse);
            } catch (e) {
                if (controller.signal.aborted) return;
                setError(e instanceof Error ? e.message : 'Failed to load dashboard');
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        void load();
        return () => controller.abort();
    }, []);

    const sortedDepartments = useMemo(() => {
        if (!data) return [];
        const rows = [...data.departments];
        rows.sort((left, right) => {
            const leftValue = left[sortKey];
            const rightValue = right[sortKey];

            if (typeof leftValue === 'string' && typeof rightValue === 'string') {
                const result = leftValue.localeCompare(rightValue);
                return sortDirection === 'asc' ? result : -result;
            }

            const result = Number(leftValue) - Number(rightValue);
            return sortDirection === 'asc' ? result : -result;
        });
        return rows;
    }, [data, sortDirection, sortKey]);

    const handleSort = (key: SortKey) => {
        setSortKey((current) => {
            if (current === key) {
                setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'));
                return current;
            }
            setSortDirection(key === 'departmentName' ? 'asc' : 'desc');
            return key;
        });
    };

    const toggleDepartment = async (secId: number) => {
        if (expandedDepartmentId === secId) {
            setExpandedDepartmentId(null);
            return;
        }

        setExpandedDepartmentId(secId);
        if (expandedDepartments[secId]) return;

        setExpandedDepartments((prev) => ({
            ...prev,
            [secId]: { loading: true, projects: [], error: null },
        }));

        try {
            const res = await fetch(`/api/public/department/${secId}`, {
                cache: 'no-store',
            });
            const body = (await res.json().catch(() => ({}))) as Partial<DepartmentDetailResponse> & { error?: string };
            if (!res.ok || !body.department) {
                throw new Error(body.error ?? `HTTP ${res.status}`);
            }
            setExpandedDepartments((prev) => ({
                ...prev,
                [secId]: {
                    loading: false,
                    projects: body.department?.projects ?? [],
                    error: null,
                },
            }));
        } catch (fetchError) {
            setExpandedDepartments((prev) => ({
                ...prev,
                [secId]: {
                    loading: false,
                    projects: [],
                    error:
                        fetchError instanceof Error
                            ? fetchError.message
                            : 'Failed to load department projects',
                },
            }));
        }
    };

    return (
        <main className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(247,249,252,1)_58%,rgba(242,246,240,1)_100%)] shadow-sm">
                <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            OSD Administrator Dashboard
                        </div>
                        <div className="max-w-3xl space-y-2">
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                                Simple executive view for project administration and monitoring.
                            </h1>
                            <p className="text-sm leading-6 text-muted-foreground lg:text-base">
                                Focused on current portfolio status, department coverage, and direct navigation into project work.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
                                <Building2 className="h-4 w-4 text-emerald-700" />
                                Single-screen management summary
                            </span>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 shadow-sm ring-1 ring-slate-200">
                                <FileStack className="h-4 w-4 text-amber-700" />
                                Inline department drill-down
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button asChild variant="outline" size="sm">
                            <Link href="/admin/osd/reports">
                                <ArrowUpRight className="h-4 w-4" />
                                Reports
                            </Link>
                        </Button>
                        <Button asChild size="sm">
                            <Link href="/admin/osd/projects">
                                <FolderKanban className="h-4 w-4" />
                                Manage Projects
                            </Link>
                        </Button>
                    </div>
                </div>
            </section>

            {loading && (
                <div className="space-y-4" aria-label="Loading OSD summary">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {[0, 1, 2, 3].map((item) => (
                            <Card key={item} className="animate-pulse">
                                <CardContent className="p-5">
                                    <div className="h-4 w-28 rounded bg-muted" />
                                    <div className="mt-3 h-10 w-24 rounded bg-muted" />
                                    <div className="mt-3 h-4 w-36 rounded bg-muted" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                    <Card className="animate-pulse">
                        <CardContent className="p-6">
                            <div className="h-4 w-40 rounded bg-muted" />
                            <div className="mt-4 space-y-3">
                                {[0, 1, 2, 3].map((item) => (
                                    <div key={item} className="h-10 rounded bg-muted" />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex items-center gap-3 py-8 text-sm text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                        {error}
                    </CardContent>
                </Card>
            )}

            {!loading && !error && data && (
                <>
                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            title="Total Departments"
                            value={data.stats.totalDepartments}
                            note="Departments with active projects"
                        />
                        <SummaryCard
                            title="Total Projects"
                            value={data.stats.totalProjects}
                            note="Active portfolio size"
                        />
                        <SummaryCard
                            title="Completed Projects"
                            value={data.stats.completedProjects}
                            note="Projects marked complete"
                        />
                        <SummaryCard
                            title="Projects In Progress"
                            value={data.stats.inProgressProjects}
                            note="Projects currently underway"
                        />
                    </section>

                    <section>
                        <Card className="overflow-hidden border-slate-200 shadow-sm">
                            <CardHeader className="border-b border-slate-100 bg-slate-50/70 pb-4">
                                <CardTitle className="text-xl">Department-wise Summary</CardTitle>
                                <CardDescription>
                                    Click any department row to expand its projects, indicator counts, and delivery status inline.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                {sortedDepartments.length === 0 ? (
                                    <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4" />
                                        No department summary is available yet.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>
                                                        <SortHeader
                                                            active={sortKey === 'departmentName'}
                                                            direction={sortDirection}
                                                            label="Department Name"
                                                            onClick={() => handleSort('departmentName')}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <SortHeader
                                                            active={sortKey === 'projectCount'}
                                                            direction={sortDirection}
                                                            label="Projects"
                                                            align="right"
                                                            onClick={() => handleSort('projectCount')}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <SortHeader
                                                            active={sortKey === 'indicatorCount'}
                                                            direction={sortDirection}
                                                            label="Indicators"
                                                            align="right"
                                                            onClick={() => handleSort('indicatorCount')}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-right">Expand</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {sortedDepartments.map((row) => {
                                                    const isExpanded = expandedDepartmentId === row.secId;
                                                    const expanded = expandedDepartments[row.secId];
                                                    return (
                                                        <Fragment key={row.secId}>
                                                            <TableRow
                                                                tabIndex={0}
                                                                className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
                                                                onClick={() => void toggleDepartment(row.secId)}
                                                                onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        void toggleDepartment(row.secId);
                                                                    }
                                                                }}
                                                            >
                                                                <TableCell className="font-medium text-foreground">
                                                                    <div className="flex items-center gap-3">
                                                                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100">
                                                                            {row.departmentName.slice(0, 2).toUpperCase()}
                                                                        </span>
                                                                        <div>
                                                                            <p>{row.departmentName}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Updated {formatDate(row.lastUpdated)}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="outline">
                                                                        {formatNumber(row.projectCount)}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Badge variant="outline">
                                                                        {formatNumber(row.indicatorCount)}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button variant="ghost" size="sm" className="h-8 px-2">
                                                                        {isExpanded ? (
                                                                            <ChevronUp className="h-4 w-4" />
                                                                        ) : (
                                                                            <ChevronDown className="h-4 w-4" />
                                                                        )}
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>

                                                            {isExpanded ? (
                                                                <TableRow className="bg-slate-50/60">
                                                                    <TableCell colSpan={4} className="px-5 py-5">
                                                                        {expanded?.loading ? (
                                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                                Loading projects for {row.departmentName}…
                                                                            </div>
                                                                        ) : expanded?.error ? (
                                                                            <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                                                                                {expanded.error}
                                                                            </div>
                                                                        ) : expanded?.projects.length ? (
                                                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                                                                <div className="border-b border-slate-100 px-4 py-3">
                                                                                    <p className="text-sm font-semibold text-foreground">
                                                                                        {row.departmentName} Projects
                                                                                    </p>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        Project portfolio, indicator count, verification posture, and delivery status.
                                                                                    </p>
                                                                                </div>
                                                                                <Table>
                                                                                    <TableHeader>
                                                                                        <TableRow>
                                                                                            <TableHead>Project</TableHead>
                                                                                            <TableHead className="text-right">Indicators</TableHead>
                                                                                            <TableHead className="text-right">Completed</TableHead>
                                                                                            <TableHead className="text-right">Physical</TableHead>
                                                                                            <TableHead className="text-right">Financial</TableHead>
                                                                                            <TableHead className="text-right">Status</TableHead>
                                                                                        </TableRow>
                                                                                    </TableHeader>
                                                                                    <TableBody>
                                                                                        {expanded.projects.map((project) => {
                                                                                            const meta = statusMeta(project.status);
                                                                                            return (
                                                                                                <TableRow key={project.projectId}>
                                                                                                    <TableCell>
                                                                                                        <div className="space-y-1">
                                                                                                            <p className="font-medium text-foreground">
                                                                                                                {project.name}
                                                                                                            </p>
                                                                                                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                                                                                {project.projectCode ? (
                                                                                                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                                                                                                                        {project.projectCode}
                                                                                                                    </span>
                                                                                                                ) : null}
                                                                                                                <span className="inline-flex items-center gap-1">
                                                                                                                    <CircleDot className="h-3.5 w-3.5 text-emerald-700" />
                                                                                                                    {project.verified ? 'Verified activity available' : 'Awaiting verified activity'}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="text-right">{formatNumber(project.indicatorsTotal)}</TableCell>
                                                                                                    <TableCell className="text-right">{formatNumber(project.indicatorsCompleted)}</TableCell>
                                                                                                    <TableCell className="text-right">{project.physicalPct}%</TableCell>
                                                                                                    <TableCell className="text-right">{project.financialPct}%</TableCell>
                                                                                                    <TableCell className="text-right">
                                                                                                        <Badge variant={meta.variant}>{meta.label}</Badge>
                                                                                                    </TableCell>
                                                                                                </TableRow>
                                                                                            );
                                                                                        })}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-muted-foreground">
                                                                                No projects found for this department.
                                                                            </div>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ) : null}
                                                        </Fragment>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </section>
                </>
            )}
        </main>
    );
}

