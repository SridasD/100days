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
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
        departmentPublicId: string | null;
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

function daysSince(value: string | null) {
    if (!value) return null;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return null;
    const diffMs = Date.now() - ts;
    return Math.max(0, Math.floor(diffMs / 86400000));
}

function freshnessTone(days: number | null) {
    if (days === null) return { label: 'No updates', className: 'border-slate-300 bg-slate-100 text-slate-700' };
    if (days <= 7) return { label: 'Fresh', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' };
    if (days <= 21) return { label: 'Watch', className: 'border-amber-300 bg-amber-50 text-amber-800' };
    return { label: 'Stale', className: 'border-rose-300 bg-rose-50 text-rose-800' };
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
    const [departmentQuery, setDepartmentQuery] = useState('');
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

    const visibleDepartments = useMemo(() => {
        const q = departmentQuery.trim().toLowerCase();
        if (!q) return sortedDepartments;
        return sortedDepartments.filter((row) => row.departmentName.toLowerCase().includes(q));
    }, [sortedDepartments, departmentQuery]);

    const staleCount = useMemo(
        () => visibleDepartments.filter((row) => (daysSince(row.lastUpdated) ?? 999) > 21).length,
        [visibleDepartments],
    );

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

    const toggleDepartment = async (secId: number, departmentPublicId?: string | null) => {
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
            const endpoints = [
                departmentPublicId
                    ? `/api/public/departments/${encodeURIComponent(departmentPublicId)}`
                    : null,
                `/api/public/department/${encodeURIComponent(String(secId))}`,
                `/api/public/departments/${encodeURIComponent(String(secId))}`,
            ];

            let body: (Partial<DepartmentDetailResponse> & { error?: string }) | null = null;
            let lastError: string | null = null;

            for (const endpoint of endpoints) {
                if (!endpoint) continue;
                try {
                    const res = await fetch(endpoint, { cache: 'no-store' });
                    const parsed = (await res.json().catch(() => ({}))) as Partial<DepartmentDetailResponse> & { error?: string };
                    if (!res.ok || !parsed.department) {
                        lastError = parsed.error ?? `HTTP ${res.status}`;
                        continue;
                    }
                    body = parsed;
                    break;
                } catch (endpointError) {
                    lastError = endpointError instanceof Error ? endpointError.message : 'Failed to fetch';
                }
            }

            if (!body?.department) {
                throw new Error(lastError ?? 'Failed to load department projects');
            }

            setExpandedDepartments((prev) => ({
                ...prev,
                [secId]: {
                    loading: false,
                    projects: body.department.projects ?? [],
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
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Input
                                        value={departmentQuery}
                                        onChange={(event) => setDepartmentQuery(event.target.value)}
                                        placeholder="Search department..."
                                        className="h-9 w-full max-w-xs bg-white"
                                        aria-label="Search department"
                                    />
                                    <Badge variant="outline">{formatNumber(visibleDepartments.length)} shown</Badge>
                                    {staleCount > 0 ? (
                                        <Badge variant="warning">{formatNumber(staleCount)} stale</Badge>
                                    ) : (
                                        <Badge variant="success">All active</Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                {visibleDepartments.length === 0 ? (
                                    <div className="flex items-center gap-2 px-6 py-10 text-sm text-muted-foreground">
                                        <Loader2 className="h-4 w-4" />
                                        {departmentQuery.trim()
                                            ? 'No department matches your search.'
                                            : 'No department summary is available yet.'}
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
                                                    <TableHead className="text-right">Freshness</TableHead>
                                                    <TableHead className="text-right">Expand</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {visibleDepartments.map((row) => {
                                                    const isExpanded = expandedDepartmentId === row.secId;
                                                    const expanded = expandedDepartments[row.secId];
                                                    const age = daysSince(row.lastUpdated);
                                                    const tone = freshnessTone(age);
                                                    return (
                                                        <Fragment key={row.secId}>
                                                            <TableRow
                                                                tabIndex={0}
                                                                className="cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50"
                                                                onClick={() => void toggleDepartment(row.secId, row.departmentPublicId)}
                                                                onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                                        event.preventDefault();
                                                                        void toggleDepartment(row.secId, row.departmentPublicId);
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
                                                                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.className}`}>
                                                                        {tone.label}
                                                                        {age !== null ? ` • ${age}d` : ''}
                                                                    </span>
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 px-2"
                                                                        aria-label={isExpanded ? `Collapse ${row.departmentName}` : `Expand ${row.departmentName}`}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            void toggleDepartment(row.secId, row.departmentPublicId);
                                                                        }}
                                                                    >
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
                                                                    <TableCell colSpan={5} className="px-5 py-5">
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
                                                                                <div className="space-y-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-emerald-50/50 px-4 py-4">
                                                                                    <div>
                                                                                        <p className="text-sm font-semibold text-foreground">
                                                                                            {row.departmentName} Projects
                                                                                        </p>
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            Portfolio health snapshot with progress and verification posture.
                                                                                        </p>
                                                                                    </div>
                                                                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                                                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Projects</p>
                                                                                            <p className="mt-1 text-lg font-semibold text-slate-900">{formatNumber(expanded.projects.length)}</p>
                                                                                        </div>
                                                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Verified Activity</p>
                                                                                            <p className="mt-1 text-lg font-semibold text-slate-900">
                                                                                                {formatNumber(expanded.projects.filter((project) => project.verified).length)}
                                                                                            </p>
                                                                                        </div>
                                                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Avg Physical</p>
                                                                                            <p className="mt-1 text-lg font-semibold text-slate-900">
                                                                                                {Math.round(
                                                                                                    expanded.projects.reduce((acc, project) => acc + project.physicalPct, 0) /
                                                                                                    Math.max(1, expanded.projects.length),
                                                                                                )}
                                                                                                %
                                                                                            </p>
                                                                                        </div>
                                                                                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Avg Financial</p>
                                                                                            <p className="mt-1 text-lg font-semibold text-slate-900">
                                                                                                {Math.round(
                                                                                                    expanded.projects.reduce((acc, project) => acc + project.financialPct, 0) /
                                                                                                    Math.max(1, expanded.projects.length),
                                                                                                )}
                                                                                                %
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
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
                                                                                            const physical = Math.max(0, Math.min(100, project.physicalPct));
                                                                                            const financial = Math.max(0, Math.min(100, project.financialPct));
                                                                                            return (
                                                                                                <TableRow key={project.projectId} className="hover:bg-slate-50/70">
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
                                                                                                    <TableCell className="min-w-[120px] text-right">
                                                                                                        <div className="space-y-1">
                                                                                                            <p className="text-xs font-semibold text-slate-700">{physical}%</p>
                                                                                                            <Progress value={physical} className="h-1.5" />
                                                                                                        </div>
                                                                                                    </TableCell>
                                                                                                    <TableCell className="min-w-[120px] text-right">
                                                                                                        <div className="space-y-1">
                                                                                                            <p className="text-xs font-semibold text-slate-700">{financial}%</p>
                                                                                                            <Progress value={financial} className="h-1.5" />
                                                                                                        </div>
                                                                                                    </TableCell>
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

