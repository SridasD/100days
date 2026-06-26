'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Images,
  Inbox,
  MapPin,
  Pencil,
  Plus,
  Ruler,
  Search,
  TriangleAlert,
  Video,
  X,
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
import {
  IndicatorActionSheet,
  type ActionTab,
  type ProgressSavePatch,
} from '@/components/sheets/IndicatorActionSheet';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// API shape returned by GET /api/officer/projects/[projectId]/indicators
// ---------------------------------------------------------------------------
interface ApiIndicator {
  indicatorId: number;
  projectId: number;
  name: string;
  unit: string;
  district: string;
  districtId: number | null;
  physicalTarget: number;
  physicalAchievement: number;
  financialTarget: number;
  financialAchievement: number;
  percentage: number;
  verifiedPercentage: number;
  description: string;
  completedDate: string | null;
  submittedDate: string | null;
  verifiedDate: string | null;
  isVerified: boolean;
  requiresReverification?: boolean;
  lastUpdatedAt: string | null;
  achievedDirectDays: number;
  achievedDirectPersons: number;
  achievedIndirectDays: number;
  achievedIndirectPersons: number;
  imageCount: number;
  videoCount: number;
  documentCount: number;
  supportingDeptNames: string;
}

export interface IndicatorRow extends ApiIndicator { }

export interface IndicatorTableProjectTargets {
  projectName: string;
  directDays: number;
  directPersons: number;
  indirectDays: number;
  indirectPersons: number;
}

interface Props {
  projectId: number;
  projectTargets: IndicatorTableProjectTargets;
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

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return v;
}

function pct(achieved: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, (achieved / target) * 100);
}

function formatPct(n: number) {
  return n >= 10 ? n.toFixed(0) : n.toFixed(2);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function ProgressTile({
  label,
  achieved,
  target,
  unitSuffix,
  formatValue,
}: {
  label: string;
  achieved: number;
  target: number;
  unitSuffix: string;
  formatValue?: (n: number) => string;
}) {
  const percent = pct(achieved, target);
  const fmt = formatValue ?? ((n: number) => String(n));
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-sm font-semibold text-kerala-blue">
          {formatPct(percent)}%
        </p>
      </div>
      <p className="mt-2 font-mono text-sm text-foreground">
        <span className="font-semibold text-success-green">
          {fmt(achieved)}
        </span>{' '}
        <span className="text-muted-foreground">
          / {fmt(target)} {unitSuffix}
        </span>
      </p>
      <div
        role="progressbar"
        aria-valuenow={achieved}
        aria-valuemin={0}
        aria-valuemax={target}
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-success-green transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function IndicatorCard({
  serialNo,
  i,
  onOpenSheet,
}: {
  serialNo: number;
  i: IndicatorRow;
  onOpenSheet: (indicator: IndicatorRow, tab: ActionTab) => void;
}) {
  return (
    <Card className="group overflow-hidden border-l-4 border-l-[#2E7D32] shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-l-[#4CAF50]">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2E7D32] text-xs font-semibold text-white"
            >
              {serialNo}
            </span>
            <div className="min-w-0 space-y-1.5">
              <h3 className="text-base font-bold text-foreground">{i.name}</h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="info">
                  <Ruler className="h-3 w-3" aria-hidden />
                  {i.unit}
                </Badge>
                <Badge variant="neutral">
                  <MapPin className="h-3 w-3" aria-hidden />
                  {i.district}
                </Badge>
                <Badge variant={i.isVerified ? 'success' : 'warning'}>
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      i.isVerified ? 'bg-success-green' : 'bg-warning-amber',
                    )}
                  />
                  {i.isVerified ? 'Verified' : 'Not Verified'}
                </Badge>
                {i.isVerified && i.verifiedDate && (
                  <Badge variant="neutral" className="bg-[#E8F5E9] text-[#1B5E20]">
                    Verifier Final
                  </Badge>
                )}
                {i.imageCount + i.documentCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Images className="h-3 w-3" aria-hidden />
                    {i.imageCount + i.documentCount}
                  </span>
                )}
                {i.videoCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <Video className="h-3 w-3" aria-hidden />
                    {i.videoCount}
                  </span>
                )}
              </div>
              {i.supportingDeptNames && (
                <p className="flex flex-wrap gap-x-1 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    Supporting departments:
                  </span>
                  <span>{i.supportingDeptNames}</span>
                </p>
              )}
            </div>
          </div>

          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link
              href={`/officer/indicators/${i.indicatorId}/edit`}
              aria-label={`Edit ${i.name}`}
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Edit
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ProgressTile
            label="Physical Achievement"
            achieved={i.physicalAchievement}
            target={i.physicalTarget}
            unitSuffix={i.unit}
          />
          <ProgressTile
            label="Financial Achievement"
            achieved={i.financialAchievement}
            target={i.financialTarget}
            unitSuffix="Lakhs"
            formatValue={(n) => inrFormat.format(n)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
            {i.completedDate ? (
              <span>
                Completed on{' '}
                <span className="font-medium text-foreground">
                  {new Date(i.completedDate).toLocaleDateString('en-IN')}
                </span>
              </span>
            ) : (
              <span className="italic">Completion date not updated</span>
            )}
          </div>
          {i.lastUpdatedAt && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              Last updated:{' '}
              <span className="font-medium text-foreground">
                {new Date(i.lastUpdatedAt).toLocaleString('en-IN')}
              </span>
            </div>
          )}
          {i.isVerified && i.verifiedDate && (
            <div className="flex items-center gap-1.5 text-[#1B5E20]">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Finalized by verifier on{' '}
              <span className="font-medium">
                {new Date(i.verifiedDate).toLocaleString('en-IN')}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenSheet(i, 'media')}
            className="cursor-pointer border-[#2E7D32] text-[#2E7D32] transition-colors duration-200 hover:bg-[#2E7D32] hover:text-white"
          >
            <Images className="h-4 w-4" aria-hidden />
            Media
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenSheet(i, 'video')}
            className="cursor-pointer border-[#2E7D32] text-[#2E7D32] transition-colors duration-200 hover:bg-[#2E7D32] hover:text-white"
          >
            <Video className="h-4 w-4" aria-hidden />
            Video
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenSheet(i, 'progress')}
            className="cursor-pointer bg-[#2E7D32] text-white shadow-sm transition-all duration-200 hover:bg-[#256328] hover:shadow"
          >
            <BarChart3 className="h-4 w-4" aria-hidden />
            Update Progress
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function IndicatorsSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading indicators">
      {[0, 1].map((i) => (
        <Card key={i}>
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
            <div className="grid gap-3 md:grid-cols-2">
              <div className="h-20 animate-pulse rounded bg-muted/70" />
              <div className="h-20 animate-pulse rounded bg-muted/70" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="border-error-red/30 bg-error-red/5">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-error-red/10 text-error-red">
          <TriangleAlert className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-error-red">
            Couldn&apos;t load indicators
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

function EmptyState({ projectId }: { projectId: number }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Inbox className="h-7 w-7 text-muted-foreground" aria-hidden />
        </span>
        <div>
          <p className="text-base font-semibold text-foreground">
            No indicators added yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Track this project&apos;s progress by adding your first indicator.
          </p>
        </div>
        <Button
          asChild
          className="mt-2 cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
        >
          <Link href={`/officer/indicators/new?projectId=${projectId}`}>
            <Plus className="h-4 w-4" aria-hidden />
            Add your first indicator
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function SuccessToast({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed right-4 top-20 z-[60] flex items-center gap-3 rounded-lg bg-success-green px-4 py-3 text-white shadow-xl ring-1 ring-white/10 animate-in fade-in slide-in-from-top-2"
    >
      <CheckCircle2 className="h-5 w-5 flex-shrink-0" aria-hidden />
      <p className="text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="cursor-pointer rounded-md p-1 transition-colors duration-200 hover:bg-white/15"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function IndicatorTable({ projectId, projectTargets }: Props) {
  const [data, setData] = useState<IndicatorRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rawQuery, setRawQuery] = useState('');
  const query = useDebouncedValue(rawQuery, 300);
  const [pageSize, setPageSize] = useState<string>('10');
  const [page, setPage] = useState(1);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [queryToastHandled, setQueryToastHandled] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState<ActionTab>('progress');
  const [activeIndicator, setActiveIndicator] =
    useState<IndicatorRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/officer/projects/${projectId}/indicators`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { indicators: ApiIndicator[] };
      setData(json.indicators);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (queryToastHandled) return;

    const created = params.get('created') === '1';
    const updated = params.get('updated') === '1';
    if (!created && !updated) return;

    if (created) flashToast('Indicator created');
    if (updated) flashToast('Indicator updated');

    setQueryToastHandled(true);

    const next = new URLSearchParams(params.toString());
    next.delete('created');
    next.delete('updated');
    router.replace(next.size > 0 ? `${pathname}?${next.toString()}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname, queryToastHandled, router]);

  const flashToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 3000);
  };

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (x) =>
        x.name.toLowerCase().includes(q) ||
        x.district.toLowerCase().includes(q) ||
        x.unit.toLowerCase().includes(q),
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

  const openSheet = (i: IndicatorRow, tab: ActionTab) => {
    setActiveIndicator(i);
    setSheetTab(tab);
    setSheetOpen(true);
  };

  // Optimistic patch from progress submit
  const applyProgressPatch = (patch: ProgressSavePatch) => {
    if (!activeIndicator) return;
    const id = activeIndicator.indicatorId;
    setData((prev) =>
      prev
        ? prev.map((row) =>
          row.indicatorId === id
            ? {
              ...row,
              physicalAchievement: patch.physicalAchievement,
              financialAchievement: patch.financialAchievement,
              completedDate: patch.completedDate,
              lastUpdatedAt: patch.lastUpdatedAt,
              isVerified: false,
              percentage:
                row.physicalTarget > 0
                  ? Math.min(
                    100,
                    (patch.physicalAchievement / row.physicalTarget) *
                    100,
                  )
                  : 0,
            }
            : row,
        )
        : prev,
    );
    flashToast('Progress saved');
  };

  // Sheet calls this when gallery counts change (after add/delete)
  const applyMediaCounts = (counts: {
    imageCount: number;
    documentCount: number;
    videoCount: number;
  }) => {
    if (!activeIndicator) return;
    const id = activeIndicator.indicatorId;
    setData((prev) =>
      prev
        ? prev.map((row) =>
          row.indicatorId === id ? { ...row, ...counts } : row,
        )
        : prev,
    );
  };

  if (loading) return <IndicatorsSkeleton />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (data && data.length === 0) return <EmptyState projectId={projectId} />;

  return (
    <section className="space-y-5">
      {showToast && (
        <SuccessToast
          message={toastMessage}
          onDismiss={() => setShowToast(false)}
        />
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            placeholder="Search by indicator name, unit or district…"
            className="h-10 pl-9"
            aria-label="Search indicators"
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
            {filtered.length}{' '}
            {filtered.length === 1 ? 'indicator' : 'indicators'}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {visible.map((ind, idx) => (
          <IndicatorCard
            key={ind.indicatorId}
            serialNo={startIdx + idx + 1}
            i={ind}
            onOpenSheet={openSheet}
          />
        ))}
      </div>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium">{showingFrom}</span>–
          <span className="font-medium">{showingTo}</span> of{' '}
          <span className="font-medium">{filtered.length}</span>{' '}
          {filtered.length === 1 ? 'indicator' : 'indicators'}
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

      <IndicatorActionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultTab={sheetTab}
        indicator={activeIndicator}
        projectTargets={projectTargets}
        onProgressSaved={applyProgressPatch}
        onMediaCountsChange={applyMediaCounts}
      />
    </section>
  );
}
