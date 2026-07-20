'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
    AlertTriangle,
    ArrowUpRight,
    CheckCircle2,
    ClipboardList,
    Download,
    Filter,
    Loader2,
    Search,
    ShieldAlert,
    TriangleAlert,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

type Severity = 'critical' | 'warning' | 'info';

type SummaryRow = {
    key: string;
    label: string;
    count: number;
    severity: Severity;
};

type DepartmentRow = {
    departmentName: string;
    totalExceptions: number;
    criticalExceptions: number;
};

type QueueRow = {
    exceptionType: string;
    severity: Severity;
    projectId: number;
    projectPublicId: string | null;
    projectName: string;
    departmentName: string;
    secretaryName: string;
    indicatorId: number | null;
    indicatorPublicId: string | null;
    indicatorName: string | null;
    districtName: string | null;
    ageDays: number | null;
    note: string;
};

type ApiData = {
    timestamp: string;
    summary: SummaryRow[];
    departments: DepartmentRow[];
    queue: QueueRow[];
};

const numberFormatter = new Intl.NumberFormat('en-IN');

function formatNumber(value: number) {
    return numberFormatter.format(value || 0);
}

function csvCell(value: string | number | null | undefined) {
    const normalized = value == null ? '' : String(value);
    return `"${normalized.replaceAll('"', '""')}"`;
}

function severityBadge(severity: Severity) {
    if (severity === 'critical') return 'warning' as const;
    if (severity === 'warning') return 'warning' as const;
    return 'info' as const;
}

function severityTone(severity: Severity) {
    if (severity === 'critical') return 'border-destructive/25 bg-destructive/5';
    if (severity === 'warning') return 'border-warning-amber/25 bg-warning-amber/10';
    return 'border-kerala-blue/20 bg-kerala-blue/5';
}

function ExceptionMonitorContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queueSectionRef = useRef<HTMLElement | null>(null);
    const [data, setData] = useState<ApiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>(searchParams.get('type') ?? 'all');
    const [departmentFilter, setDepartmentFilter] = useState<string>(searchParams.get('department') ?? 'all');
    const [severityFilter, setSeverityFilter] = useState<string>(searchParams.get('severity') ?? 'priority');

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/admin/osd/analytics/exceptions', {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
                setData(body as ApiData);
            } catch (e) {
                if (controller.signal.aborted) return;
                setError(e instanceof Error ? e.message : 'Failed to load exception monitor');
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, []);

    useEffect(() => {
        setTypeFilter(searchParams.get('type') ?? 'all');
        setDepartmentFilter(searchParams.get('department') ?? 'all');
        setSeverityFilter(searchParams.get('severity') ?? 'priority');
    }, [searchParams]);

    const updateFilters = (
        next: { type?: string; department?: string; severity?: string },
        options?: { jumpToResults?: boolean },
    ) => {
        const params = new URLSearchParams(searchParams.toString());

        const nextType = next.type ?? typeFilter;
        const nextDepartment = next.department ?? departmentFilter;
        const nextSeverity = next.severity ?? severityFilter;

        if (nextType === 'all') params.delete('type');
        else params.set('type', nextType);

        if (nextDepartment === 'all') params.delete('department');
        else params.set('department', nextDepartment);

        if (nextSeverity === 'priority') params.delete('severity');
        else params.set('severity', nextSeverity);

        const target = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
        router.replace(target, { scroll: false });

        if (options?.jumpToResults) {
            setTimeout(() => {
                queueSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 0);
        }
    };

    const filteredQueue = useMemo(() => {
        const rows = data?.queue ?? [];
        const q = query.trim().toLowerCase();
        return rows.filter((row) => {
            const typeOk = typeFilter === 'all' || row.exceptionType === typeFilter;
            if (!typeOk) return false;
            const departmentOk = departmentFilter === 'all' || row.departmentName === departmentFilter;
            if (!departmentOk) return false;
            const severityOk =
                severityFilter === 'all' ||
                (severityFilter === 'priority'
                    ? row.severity === 'critical' || row.severity === 'warning'
                    : row.severity === severityFilter);
            if (!severityOk) return false;
            if (!q) return true;
            return [
                row.projectName,
                row.departmentName,
                row.secretaryName,
                row.indicatorName ?? '',
                row.districtName ?? '',
                row.note,
            ].some((value) => value.toLowerCase().includes(q));
        });
    }, [data?.queue, query, typeFilter, departmentFilter, severityFilter]);

    const exceptionTypes = data?.summary.map((item) => ({
        value: item.key,
        label: item.label,
    })) ?? [];

    const departmentOptions = useMemo(() => {
        const names = new Set((data?.queue ?? []).map((row) => row.departmentName));
        return Array.from(names).sort((left, right) => left.localeCompare(right));
    }, [data?.queue]);

    const returnTo = useMemo(() => {
        const qs = searchParams.toString();
        const target = qs ? `${pathname}?${qs}` : pathname;
        return encodeURIComponent(target);
    }, [pathname, searchParams]);

    const hasActiveQueueFilters =
        typeFilter !== 'all' ||
        departmentFilter !== 'all' ||
        severityFilter !== 'priority' ||
        query.trim().length > 0;

    const uniqueProjectCount = useMemo(
        () => new Set(filteredQueue.map((row) => row.projectId)).size,
        [filteredQueue],
    );

    const criticalRows = useMemo(
        () => filteredQueue.filter((row) => row.severity === 'critical').length,
        [filteredQueue],
    );

    const warningRows = useMemo(
        () => filteredQueue.filter((row) => row.severity === 'warning').length,
        [filteredQueue],
    );

    const infoRows = useMemo(
        () => filteredQueue.filter((row) => row.severity === 'info').length,
        [filteredQueue],
    );

    const exportQueue = () => {
        if (filteredQueue.length === 0) return;

        const headers = [
            'exception_type',
            'severity',
            'project_id',
            'project_public_id',
            'project_name',
            'department_name',
            'secretary_name',
            'indicator_id',
            'indicator_public_id',
            'indicator_name',
            'district_name',
            'age_days',
            'note',
        ];

        const rows = filteredQueue.map((row) => [
            row.exceptionType,
            row.severity,
            row.projectId,
            row.projectPublicId,
            row.projectName,
            row.departmentName,
            row.secretaryName,
            row.indicatorId,
            row.indicatorPublicId,
            row.indicatorName,
            row.districtName,
            row.ageDays != null ? row.ageDays.toFixed(1) : '',
            row.note,
        ]);

        const csv = [headers, ...rows]
            .map((line) => line.map((value) => csvCell(value)).join(','))
            .join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const suffix = new Date().toISOString().slice(0, 10);

        anchor.href = url;
        anchor.download = `osd-exception-queue-${suffix}.csv`;
        anchor.click();

        URL.revokeObjectURL(url);
    };

    return (
        <main className="space-y-6">
            <section className="overflow-hidden rounded-[2rem] border border-kerala-blue/15 bg-gradient-to-br from-kerala-blue/10 via-background to-warning-amber/10 shadow-[0_18px_50px_rgba(14,23,38,0.09)]">
                <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1.45fr_0.95fr]">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-kerala-blue/20 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-kerala-blue shadow-sm">
                            <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                            OSD Exception Monitor
                        </div>
                        <div>
                            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl xl:text-[2.65rem] xl:leading-tight">
                                Governance exceptions, workflow gaps, and closure inconsistencies in one operational view.
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                                Separate from the executive dashboard by design. This screen focuses on missing mappings, stalled setup, pending verification, evidence gaps, and project closure inconsistencies.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="info">Read-only monitoring module</Badge>
                            <Badge variant="neutral">Existing OSD dashboard workflow unchanged</Badge>
                            <Badge variant="neutral">Updated {data ? new Date(data.timestamp).toLocaleString('en-IN') : '—'}</Badge>
                        </div>
                    </div>

                    <Card className="border-warning-amber/20 bg-warning-amber/10 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardDescription className="text-[11px] uppercase tracking-[0.26em] text-warning-amber">Critical Exceptions</CardDescription>
                            <CardTitle className="text-5xl leading-none text-foreground">
                                {loading ? '—' : formatNumber((data?.summary ?? []).filter((row) => row.severity === 'critical').reduce((sum, row) => sum + row.count, 0))}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-xs leading-5 text-muted-foreground">
                                Immediate intervention candidates spanning unmapped projects, unverified latest submissions, and invalid completion states.
                            </p>
                            <Button asChild size="sm" className="cursor-pointer">
                                <Link href="/admin/osd/dashboard/v2">
                                    <ArrowUpRight className="h-4 w-4" />
                                    Back to Analytical Dashboard
                                </Link>
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading exception monitor…
                </div>
            )}

            {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex items-center gap-2 py-6 text-sm text-destructive">
                        <TriangleAlert className="h-4 w-4" />
                        {error}
                    </CardContent>
                </Card>
            )}

            {!loading && !error && data && (
                <>
                    <section className="grid gap-4 md:grid-cols-3">
                        <Card className="border-destructive/25 bg-destructive/5 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-destructive">
                                    <ShieldAlert className="h-4 w-4" />
                                    <p className="text-sm font-semibold">Critical Governance Gaps</p>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Unmapped projects, invalid completed projects, and unverified latest submissions should be reviewed first.
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-warning-amber/25 bg-warning-amber/10 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-warning-amber">
                                    <AlertTriangle className="h-4 w-4" />
                                    <p className="text-sm font-semibold">Workflow Gaps</p>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Projects without indicators, indicators without progress, and missing completion dates indicate stalled execution flow.
                                </p>
                            </CardContent>
                        </Card>
                        <Card className="border-kerala-blue/20 bg-kerala-blue/5 shadow-sm">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 text-kerala-blue">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <p className="text-sm font-semibold">Evidence Signals</p>
                                </div>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Missing image and video evidence are kept visible here without crowding the executive dashboard.
                                </p>
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {data.summary.map((item) => (
                            <div key={item.key}>
                                <Card className={`overflow-hidden border shadow-sm transition-transform duration-200 hover:-translate-y-0.5 ${severityTone(item.severity)} ${typeFilter === item.key ? 'ring-2 ring-kerala-blue/30' : ''}`}>
                                    <CardContent className="p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                                            <Badge variant={severityBadge(item.severity)}>{item.severity.toUpperCase()}</Badge>
                                        </div>
                                        <p className="mt-3 text-3xl font-semibold text-foreground">{formatNumber(item.count)}</p>
                                        <div className="mt-3 flex items-center justify-between gap-2">
                                            <p className="text-xs text-muted-foreground">
                                                {typeFilter === item.key ? 'Type filter active' : 'Use button to filter queue'}
                                            </p>
                                            {typeFilter === item.key ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    className="cursor-pointer"
                                                    onClick={() => updateFilters({ type: 'all' }, { jumpToResults: true })}
                                                >
                                                    Clear
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="cursor-pointer"
                                                    onClick={() => updateFilters({ type: item.key }, { jumpToResults: true })}
                                                >
                                                    Filter
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </section>

                    <section>
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-destructive via-warning-amber to-kerala-blue" />
                            <CardHeader>
                                <CardTitle className="text-xl">Department Exception Concentration</CardTitle>
                                <CardDescription>
                                    Departments with the highest exception volume and criticality. Click a department to filter the queue.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Total</TableHead>
                                            <TableHead>Critical</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {data.departments.map((row) => (
                                            <TableRow
                                                key={row.departmentName}
                                                className={departmentFilter === row.departmentName ? 'bg-kerala-blue/5' : ''}
                                            >
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateFilters({
                                                            department: departmentFilter === row.departmentName ? 'all' : row.departmentName,
                                                        }, { jumpToResults: true })}
                                                        className="font-medium text-foreground transition-colors hover:text-kerala-blue"
                                                    >
                                                        {row.departmentName}
                                                    </button>
                                                </TableCell>
                                                <TableCell>{formatNumber(row.totalExceptions)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={departmentFilter === row.departmentName ? 'info' : row.criticalExceptions > 0 ? 'warning' : 'neutral'}>
                                                        {formatNumber(row.criticalExceptions)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>

                    <section ref={queueSectionRef} id="exception-queue">
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-destructive via-warning-amber to-success-green" />
                            <CardHeader>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <CardTitle className="text-xl">Exception Queue</CardTitle>
                                        <CardDescription>
                                            Record-level queue for follow-up. This is intentionally separated from the executive command center to keep the existing workflow stable.
                                        </CardDescription>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="cursor-pointer"
                                        onClick={exportQueue}
                                        disabled={filteredQueue.length === 0}
                                    >
                                        <Download className="h-4 w-4" />
                                        Export CSV
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="mb-5 space-y-3 rounded-xl border border-kerala-blue/15 bg-kerala-blue/5 p-4">
                                    <div className="grid gap-3 md:grid-cols-[1.25fr_0.75fr]">
                                        <div className="rounded-lg border border-warning-amber/25 bg-warning-amber/10 px-3 py-2 text-xs text-muted-foreground">
                                            <p className="flex items-center gap-2 font-semibold text-foreground">
                                                <ShieldAlert className="h-4 w-4 text-warning-amber" />
                                                What You Are Viewing
                                            </p>
                                            <p className="mt-1">Each row is an exception record, not a unique project.</p>
                                            <p>Default focus is Critical + Warning for decision urgency.</p>
                                            <p>Switch to All severities when you want full operational context.</p>
                                        </div>
                                        <div className="rounded-lg border border-kerala-blue/20 bg-background/85 px-3 py-2 text-xs text-muted-foreground">
                                            <p className="font-semibold text-foreground">Priority Snapshot</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                <Badge variant="warning">Critical {formatNumber(criticalRows)}</Badge>
                                                <Badge variant="warning">Warning {formatNumber(warningRows)}</Badge>
                                                <Badge variant="info">Info {formatNumber(infoRows)}</Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="neutral">Queue rows: {formatNumber(filteredQueue.length)}</Badge>
                                        <Badge variant="neutral">Unique projects: {formatNumber(uniqueProjectCount)}</Badge>
                                        {severityFilter !== 'priority' && <Badge variant="info">Severity: {severityFilter}</Badge>}
                                        {typeFilter !== 'all' && <Badge variant="info">Type: {typeFilter.replaceAll('_', ' ')}</Badge>}
                                        {departmentFilter !== 'all' && <Badge variant="info">Department: {departmentFilter}</Badge>}
                                        {query.trim() && <Badge variant="info">Search: {query.trim()}</Badge>}
                                        {hasActiveQueueFilters && (
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="ghost"
                                                className="cursor-pointer"
                                                onClick={() => {
                                                    setQuery('');
                                                    updateFilters({ severity: 'priority', type: 'all', department: 'all' }, { jumpToResults: true });
                                                }}
                                            >
                                                <X className="h-3.5 w-3.5" />
                                                Clear all filters
                                            </Button>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { value: 'priority', label: 'Critical + Warning' },
                                            { value: 'critical', label: 'Critical' },
                                            { value: 'warning', label: 'Warning' },
                                            { value: 'info', label: 'Info' },
                                            { value: 'all', label: 'All severities' },
                                        ].map((option) => (
                                            <Button
                                                key={option.value}
                                                type="button"
                                                variant={severityFilter === option.value ? 'default' : 'outline'}
                                                size="sm"
                                                className="cursor-pointer"
                                                onClick={() => updateFilters({ severity: option.value }, { jumpToResults: true })}
                                            >
                                                {option.label}
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="grid gap-3 lg:grid-cols-[1fr_260px_260px]">
                                        <div className="relative">
                                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Search project, indicator, department, district..."
                                                className="pl-9"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-muted-foreground" />
                                            <Select value={typeFilter} onValueChange={(value) => updateFilters({ type: value }, { jumpToResults: true })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All exception types" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All exception types</SelectItem>
                                                    {exceptionTypes.map((item) => (
                                                        <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Filter className="h-4 w-4 text-muted-foreground" />
                                            <Select value={departmentFilter} onValueChange={(value) => updateFilters({ department: value }, { jumpToResults: true })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="All departments" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All departments</SelectItem>
                                                    {departmentOptions.map((departmentName) => (
                                                        <SelectItem key={departmentName} value={departmentName}>{departmentName}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Project</TableHead>
                                            <TableHead>Indicator</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>District</TableHead>
                                            <TableHead>Age</TableHead>
                                            <TableHead>Action Note</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredQueue.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                                                    No exception rows match the current filter.
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredQueue.map((row, index) => (
                                            <TableRow
                                                key={`${row.exceptionType}-${row.projectId}-${row.indicatorId ?? 'project'}-${index}`}
                                                className={
                                                    row.severity === 'critical'
                                                        ? 'bg-destructive/5'
                                                        : row.severity === 'warning'
                                                            ? 'bg-warning-amber/10'
                                                            : ''
                                                }
                                            >
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <Badge variant={severityBadge(row.severity)}>{row.exceptionType.replaceAll('_', ' ')}</Badge>
                                                        <p className="text-[11px] text-muted-foreground">{row.severity}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        <p className="font-medium text-foreground">{row.projectName}</p>
                                                        <p className="text-xs text-muted-foreground">Project ID {row.projectId}</p>
                                                        <p className="text-xs text-muted-foreground">Secretary: {row.secretaryName}</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {row.indicatorName ? (
                                                        <div className="space-y-1">
                                                            <p className="text-sm text-foreground">{row.indicatorName}</p>
                                                            <p className="text-xs text-muted-foreground">ID {row.indicatorId}</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground">Project-level issue</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>{row.departmentName}</TableCell>
                                                <TableCell>{row.districtName ?? '—'}</TableCell>
                                                <TableCell>
                                                    {row.ageDays != null ? `${row.ageDays.toFixed(1)} days` : '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="max-w-[360px] text-sm text-muted-foreground">{row.note}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end gap-2">
                                                        <Button asChild size="sm" variant="outline" className="cursor-pointer">
                                                            <Link href={`/admin/osd/projects/${row.projectId}?returnTo=${returnTo}`}>
                                                                <ArrowUpRight className="h-4 w-4" />
                                                                View Project
                                                            </Link>
                                                        </Button>
                                                        {row.indicatorId != null && (
                                                            <Button asChild size="sm" variant="ghost" className="cursor-pointer">
                                                                <Link href={`/admin/osd/indicators/${row.indicatorId}?returnTo=${returnTo}`}>
                                                                    <ArrowUpRight className="h-4 w-4" />
                                                                    View Indicator
                                                                </Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>

                </>
            )}
        </main>
    );
}

function ExceptionMonitorFallback() {
    return (
        <main className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading exception monitor…
        </main>
    );
}

export default function OsdExceptionMonitorPage() {
    return (
        <Suspense fallback={<ExceptionMonitorFallback />}>
            <ExceptionMonitorContent />
        </Suspense>
    );
}