'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Hash,
  IndianRupee,
  PartyPopper,
  Search,
  Target,
  TriangleAlert,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// API shape returned by GET /api/officer/projects
// ---------------------------------------------------------------------------
export type ProjectStatus = 'in-progress' | 'completed' | 'not-started';

interface ApiProject {
  projectId: number;
  projectPublicId: string | null;
  projectCode: string | null;
  projectName: string | null;
  projectCost: number;
  isCompleted: number; // 0 not-started, 1 in-progress, 2 completed
  department: string | null;
  noDaysEmployedDirect: number;
  noPersonsEmployedDirect: number;
  noDaysEmployedIndirect: number;
  noPersonsEmployedIndirect: number;
  indicatorsTotal: number;
  indicatorsCompleted: number;
  totalAllocated: number;
  balance: number;
}

export interface OfficerProjectRow {
  projectId: number;
  projectPublicId: string;
  projectCode: string;
  projectName: string;
  projectCost: number;
  department?: string;
  status: ProjectStatus;
  indicatorsCompleted: number;
  indicatorsTotal: number;
  noDaysEmployedDirect: number;
  noPersonsEmployedDirect: number;
  noDaysEmployedIndirect: number;
  noPersonsEmployedIndirect: number;
  totalAllocated: number;
  balance: number;
}

const PAGE_SIZE_OPTIONS = [
  { label: '10', value: '10' },
  { label: '25', value: '25' },
  { label: '50', value: '50' },
  { label: 'All', value: 'all' },
] as const;

const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Coerce anything (undefined / null / "12.34" / NaN) to a finite number. */
function toNum(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Format a value as Indian-style decimal; never returns "NaN". */
function fmtNum(v: unknown): string {
  return inrFormat.format(toNum(v));
}

function deriveStatus(p: ApiProject): ProjectStatus {
  if (p.isCompleted === 2) return 'completed';
  if (p.isCompleted === 1) return 'in-progress';
  return 'not-started';
}

const STATUS_META: Record<
  ProjectStatus,
  { label: string; dot: string; pillClass: string }
> = {
  'in-progress': {
    label: 'In Progress',
    dot: 'bg-warning-amber',
    pillClass: 'bg-warning-amber/10 text-warning-amber',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-success-green',
    pillClass: 'bg-success-green/10 text-success-green',
  },
  'not-started': {
    label: 'Not Started',
    dot: 'bg-muted-foreground',
    pillClass: 'bg-muted text-muted-foreground',
  },
};

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

// ---------------------------------------------------------------------------
// Card sub-components (unchanged visual language)
// ---------------------------------------------------------------------------
function StatusPill({ status }: { status: ProjectStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        meta.pillClass,
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

function CostStat({ valueInLakhs }: { valueInLakhs: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-success-green/20 bg-success-green/5 px-4 py-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-green/15 text-success-green">
        <IndianRupee className="h-4 w-4" aria-hidden />
      </span>
      <div className="leading-tight">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Project Cost
        </p>
        <p className="font-mono text-sm font-semibold text-success-green">
          ₹ {fmtNum(valueInLakhs)} Lakhs
        </p>
      </div>
    </div>
  );
}

function EmploymentStat({
  label,
  days,
  persons,
  tone,
}: {
  label: string;
  days: number;
  persons: number;
  tone: 'olive' | 'olive-deep';
}) {
  const bg = tone === 'olive' ? '#4A5320' : '#3A4218';
  return (
    <div
      style={{ backgroundColor: bg }}
      className="rounded-lg px-4 py-3 text-white shadow-sm"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {label}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3 text-sm">
        <span className="flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 opacity-80" aria-hidden />
          <span className="text-[11px] opacity-70">Days</span>
          <span className="font-mono font-semibold">{days}</span>
        </span>
        <span className="h-5 w-px bg-white/20" aria-hidden />
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 opacity-80" aria-hidden />
          <span className="text-[11px] opacity-70">Persons</span>
          <span className="font-mono font-semibold">{persons}</span>
        </span>
      </div>
    </div>
  );
}

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.min(100, (completed / total) * 100);
  return (
    <div className="flex flex-col gap-1.5 sm:max-w-xs sm:flex-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Target className="h-3.5 w-3.5" aria-hidden />
          {completed} / {total} indicators completed
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-success-green transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({ p }: { p: OfficerProjectRow }) {
  const cost = toNum(p.projectCost);
  const allocated = toNum(p.totalAllocated);
  const balance = toNum(p.balance);
  const isNonFinancial = cost <= 0;
  const allocationPct =
    cost > 0 ? Math.min(100, (allocated / cost) * 100) : 0;
  const overAllocated = balance < -0.001;

  return (
    <Card className="group overflow-hidden border-l-4 border-l-[#2E7D32] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold leading-tight text-kerala-blue">
                {p.projectName}
              </h3>
              <Badge variant="info" className="font-mono">
                {p.projectCode}
              </Badge>
              {p.department && (
                <Badge variant="neutral">{p.department}</Badge>
              )}
              {isNonFinancial && (
                <Badge className="border border-kerala-blue/30 bg-kerala-blue/10 text-kerala-blue">
                  <PartyPopper className="h-3 w-3" />
                  Non-financial
                </Badge>
              )}
            </div>
          </div>
          <StatusPill status={p.status} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <CostStat valueInLakhs={p.projectCost} />
          <EmploymentStat
            label="Direct Employment"
            days={p.noDaysEmployedDirect}
            persons={p.noPersonsEmployedDirect}
            tone="olive"
          />
          <EmploymentStat
            label="Indirect Employment"
            days={p.noDaysEmployedIndirect}
            persons={p.noPersonsEmployedIndirect}
            tone="olive-deep"
          />
        </div>

        {/* Indicator + budget allocation summary */}
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 md:grid-cols-3">
          <AllocationStat
            label="Indicators"
            icon={<Hash className="h-3.5 w-3.5" />}
            primary={`${p.indicatorsTotal}`}
            secondary={
              p.indicatorsTotal === 0
                ? 'None added yet'
                : `${p.indicatorsCompleted} completed`
            }
            tone="muted"
          />
          {isNonFinancial ? (
            <AllocationStat
              label="Budget required"
              icon={<PartyPopper className="h-3.5 w-3.5" />}
              primary="—"
              secondary="Non-financial project (e.g. inauguration). No budget to allocate."
              tone="info"
              fullSpan
            />
          ) : (
            <>
              <AllocationStat
                label="Allocated"
                icon={<Wallet className="h-3.5 w-3.5" />}
                primary={`₹ ${fmtNum(allocated)} L`}
                secondary={`${allocationPct.toFixed(1)}% of cost`}
                tone="info"
              />
              <AllocationStat
                label={overAllocated ? 'Over-allocated by' : 'Available balance'}
                icon={<IndianRupee className="h-3.5 w-3.5" />}
                primary={`₹ ${fmtNum(Math.abs(balance))} L`}
                secondary={
                  overAllocated
                    ? 'Exceeds project cost — needs revision.'
                    : balance > 0
                      ? 'Add indicators up to this amount.'
                      : 'Fully allocated.'
                }
                tone={overAllocated ? 'error' : balance > 0 ? 'success' : 'muted'}
              />
            </>
          )}
        </div>

        {/* Allocation progress bar — hidden for non-financial projects */}
        {!isNonFinancial && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Budget allocation</span>
            <div
              role="progressbar"
              aria-valuenow={Math.round(allocationPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  overAllocated
                    ? 'bg-error-red'
                    : allocationPct >= 99.9
                      ? 'bg-success-green'
                      : 'bg-kerala-blue',
                )}
                style={{ width: `${Math.min(100, allocationPct)}%` }}
              />
            </div>
            <span className="font-mono text-muted-foreground">
              {allocationPct.toFixed(1)}%
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <ProgressBar
            completed={p.indicatorsCompleted}
            total={p.indicatorsTotal}
          />
          <Button
            asChild
            variant="outline"
            className="cursor-pointer border-[#2E7D32] font-semibold text-[#2E7D32] transition-colors duration-200 hover:bg-[#2E7D32] hover:text-white"
          >
            <Link
              href={`/officer/projects/${p.projectPublicId}/indicators`}
              aria-label={`View indicators for ${p.projectName}`}
            >
              View Indicators
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AllocationStat({
  label,
  icon,
  primary,
  secondary,
  tone,
  fullSpan,
}: {
  label: string;
  icon: React.ReactNode;
  primary: string;
  secondary: string;
  tone: 'muted' | 'info' | 'success' | 'error';
  fullSpan?: boolean;
}) {
  const cls = {
    muted: 'text-foreground',
    info: 'text-kerala-blue',
    success: 'text-success-green',
    error: 'text-error-red',
  }[tone];
  return (
    <div
      className={cn(
        'rounded-md bg-background px-3 py-2 ring-1 ring-border',
        fullSpan && 'md:col-span-2',
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span aria-hidden className="text-muted-foreground/70">
          {icon}
        </span>
        {label}
      </p>
      <p className={cn('mt-0.5 font-mono text-sm font-semibold', cls)}>
        {primary}
      </p>
      <p className="text-[10px] text-muted-foreground">{secondary}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading & error states
// ---------------------------------------------------------------------------
function ProjectsSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading projects">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="overflow-hidden">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="grid gap-3 md:grid-cols-3">
              <div className="h-16 animate-pulse rounded bg-muted/70" />
              <div className="h-16 animate-pulse rounded bg-muted/70" />
              <div className="h-16 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-error-red/30 bg-error-red/5">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-red/10 text-error-red">
          <TriangleAlert className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-error-red">
            Couldn&apos;t load projects
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="cursor-pointer border-error-red/50 text-error-red"
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component — now fetches from /api/officer/projects on mount
// ---------------------------------------------------------------------------
export function ProjectTable() {
  const [data, setData] = useState<OfficerProjectRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rawQuery, setRawQuery] = useState('');
  const query = useDebouncedValue(rawQuery, 300);
  const [pageSize, setPageSize] = useState<string>('10');
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/officer/projects', {
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { projects: ApiProject[] };
      const mapped: OfficerProjectRow[] = json.projects.map((p) => {
        const cost = toNum(p.projectCost);
        const allocated = toNum(p.totalAllocated);
        // Compute balance defensively — never trust an upstream value that
        // could be NaN due to a stale dev-server response.
        const balance = Number.isFinite(p.balance as number)
          ? toNum(p.balance)
          : cost - allocated;
        return {
          projectId: p.projectId,
          projectPublicId: p.projectPublicId ?? String(p.projectId),
          projectCode: p.projectCode ?? '',
          projectName: p.projectName ?? '',
          projectCost: cost,
          department: p.department ?? undefined,
          status: deriveStatus(p),
          indicatorsCompleted: toNum(p.indicatorsCompleted),
          indicatorsTotal: toNum(p.indicatorsTotal),
          noDaysEmployedDirect: toNum(p.noDaysEmployedDirect),
          noPersonsEmployedDirect: toNum(p.noPersonsEmployedDirect),
          noDaysEmployedIndirect: toNum(p.noDaysEmployedIndirect),
          noPersonsEmployedIndirect: toNum(p.noPersonsEmployedIndirect),
          totalAllocated: allocated,
          balance,
        };
      });
      setData(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.projectName.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.department ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  const effectivePageSize =
    pageSize === 'all' ? Math.max(filtered.length, 1) : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / effectivePageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * effectivePageSize;
  const visible = filtered.slice(startIdx, startIdx + effectivePageSize);
  const showingFrom = filtered.length === 0 ? 0 : startIdx + 1;
  const showingTo = Math.min(startIdx + effectivePageSize, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  if (loading) return <ProjectsSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (data && data.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <FolderOpen className="h-7 w-7 text-muted-foreground" aria-hidden />
          </span>
          <div>
            <p className="text-base font-semibold text-foreground">
              No projects assigned yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Contact your administrator to be assigned to a department.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search by project name, code or department…"
            className="h-10 pl-9"
            aria-label="Search projects"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Show</span>
            <Select value={pageSize} onValueChange={setPageSize}>
              <SelectTrigger className="h-9 w-24" aria-label="Entries per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>entries</span>
          </div>
          <Badge variant="info" className="font-mono">
            {filtered.length} {filtered.length === 1 ? 'project' : 'projects'}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/30 py-12 text-center">
            <FolderOpen className="h-12 w-12 opacity-40" aria-hidden />
            <div>
              <h3 className="font-semibold text-foreground">No projects found</h3>
              <p className="text-sm text-muted-foreground">
                {query
                  ? 'Try adjusting your search or filter criteria'
                  : 'There are no projects to display'}
              </p>
            </div>
          </div>
        ) : (
          visible.map((p) => (
            <ProjectCard key={p.projectId} p={p} />
          ))
        )}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium">{showingFrom}</span>–
          <span className="font-medium">{showingTo}</span> of{' '}
          <span className="font-medium">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'project' : 'projects'}
        </p>
        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-full"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="px-2 text-xs text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer rounded-full"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      </div>
    </section>
  );
}
