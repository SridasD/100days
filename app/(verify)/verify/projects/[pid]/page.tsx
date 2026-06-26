'use client';

import { useEffect, useMemo, useState, use } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ImageIcon,
  Loader2,
  PartyPopper,
  Search,
  ShieldCheck,
  Video,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  VerifierIndicatorSheet,
  type VerifierIndicator,
} from '@/components/sheets/VerifierIndicatorSheet';
import { cn } from '@/lib/utils';

type Indicator = VerifierIndicator;

const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function VerifyProjectIndicatorsPage({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const { pid } = use(params);
  const projectId = Number(pid);

  const [indicators, setIndicators] = useState<Indicator[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [toast, setToast] = useState<string | null>(null);

  // Single-verify drawer state
  const [verifying, setVerifying] = useState<Indicator | null>(null);

  // Bulk-verify confirmation
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);

  // Project completion
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeDate, setCompleteDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [completeRunning, setCompleteRunning] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const load = async (): Promise<Indicator[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/verify/projects/${projectId}/indicators`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { indicators: Indicator[] };
      setIndicators(json.indicators);
      return json.indicators;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (Number.isFinite(projectId)) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    if (!indicators) return [];
    const q = search.trim().toLowerCase();
    return indicators.filter((i) => {
      if (
        filter === 'pending' &&
        i.status !== 'pending' &&
        i.status !== 'reverification_required'
      ) {
        return false;
      }
      if (filter === 'verified' && i.status !== 'approved') return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [indicators, search, filter]);

  const pendingCount =
    indicators?.filter(
      (i) => i.status === 'pending' || i.status === 'reverification_required',
    ).length ?? 0;
  const verifiedCount =
    indicators?.filter((i) => i.status === 'approved').length ?? 0;
  // "Physically completed" = verifier has confirmed ≥ 100% on every indicator.
  // Verifier is authoritative here; nodal `percentage` is just self-report.
  const totalIndicators = indicators?.length ?? 0;
  const fullyVerifiedComplete =
    indicators?.filter(
      (i) => i.status === 'approved' && Math.round(i.verifiedPercentage) >= 100,
    ).length ?? 0;
  const allComplete =
    totalIndicators > 0 && fullyVerifiedComplete === totalIndicators;

  // Submit project completion
  const submitProjectCompletion = async () => {
    setCompleteRunning(true);
    setCompleteError(null);
    try {
      const res = await fetch(
        `/api/verify/projects/${projectId}/complete`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            completion_date: completeDate,
            remarks: completeRemarks,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setCompletedAt(completeDate);
      setCompleteOpen(false);
      setToast('Project marked as completed');
    } catch (e) {
      setCompleteError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setCompleteRunning(false);
    }
  };

  const projectName = indicators?.[0]?.name
    ? undefined // we don't fetch project name here — header shows id only
    : undefined;

  // ----------------------- bulk verify ---------------------------------
  const runBulkVerify = async () => {
    if (!indicators) return;
    const pending = indicators.filter(
      (i) => i.status === 'pending' || i.status === 'reverification_required',
    );
    if (pending.length === 0) {
      setBulkOpen(false);
      return;
    }
    setBulkRunning(true);
    let ok = 0;
    let failed = 0;
    for (const ind of pending) {
      try {
        const res = await fetch(
          `/api/verify/indicators/${ind.indicatorId}/verify`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              verified_physical_achievement: ind.physicalAchievement,
              verified_financial_achievement: ind.financialAchievement,
              verified_description: ind.description,
            }),
          },
        );
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setBulkRunning(false);
    setBulkOpen(false);
    setToast(
      failed === 0
        ? `Verified ${ok} indicators`
        : `Verified ${ok}, ${failed} failed`,
    );
    await load();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
        right={
          <OfficerUserMenu
            roleLabel="Verification Officer"
            departmentLabel="Verifying"
          />
        }
      />

      <main className="container mx-auto flex-1 px-4 py-8">
        {/* Header strip */}
        <div className="mb-6 flex flex-col gap-3">
          <Link
            href="/verify/projects"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-kerala-blue hover:underline"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to verification queue
          </Link>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Verify indicators
              </h1>
              <p className="text-xs text-muted-foreground">
                Project #{projectId} · Review nodal officer submissions and
                approve.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="flex items-center gap-1.5 bg-warning-amber/90 text-white">
                <Clock className="h-3 w-3" />
                {pendingCount} pending
              </Badge>
              <Badge className="flex items-center gap-1.5 bg-success-green/90 text-white">
                <CheckCircle2 className="h-3 w-3" />
                {verifiedCount} verified
              </Badge>
              <Button
                size="sm"
                disabled={pendingCount === 0 || bulkRunning}
                onClick={() => setBulkOpen(true)}
                className="cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Verify all ({pendingCount})
              </Button>
              {/* Project completion CTA — only when every indicator is
                  verified at ≥100% */}
              {allComplete && !completedAt && (
                <Button
                  size="sm"
                  onClick={() => setCompleteOpen(true)}
                  className="cursor-pointer bg-success-green text-white shadow-md hover:bg-success-green/90"
                >
                  <PartyPopper className="h-3.5 w-3.5" />
                  Mark project complete
                </Button>
              )}
              {completedAt && (
                <Badge className="flex items-center gap-1.5 bg-success-green text-white">
                  <PartyPopper className="h-3 w-3" />
                  Completed {new Date(completedAt).toLocaleDateString('en-IN')}
                </Badge>
              )}
            </div>
          </div>

          {/* Banner shown when all indicators are physically verified-complete */}
          {allComplete && !completedAt && (
            <div className="flex items-start gap-2 rounded-lg border border-success-green/30 bg-success-green/5 p-3 text-xs text-success-green">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                <span className="font-semibold">
                  All {totalIndicators} indicators are verified at 100%.
                </span>{' '}
                You can now declare this project physically completed and
                record an official completion date.
              </p>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <Card className="mb-4">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                placeholder="Search indicator name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div
              role="tablist"
              className="inline-flex rounded-full border bg-muted/30 p-0.5 text-xs font-medium"
            >
              {(['all', 'pending', 'verified'] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => setFilter(k)}
                  className={cn(
                    'cursor-pointer rounded-full px-3 py-1 capitalize transition-colors duration-200',
                    filter === k
                      ? 'bg-[#2E7D32] text-white shadow'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {k}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* State */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {error && (
          <Card className="border-error-red/30 bg-error-red/5">
            <CardContent className="flex items-center gap-3 p-6 text-sm text-error-red">
              <AlertTriangle className="h-5 w-5" />
              {error}
            </CardContent>
          </Card>
        )}

        {!loading && !error && filtered.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ShieldCheck className="h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-semibold">No indicators match</p>
              <p className="text-xs text-muted-foreground">
                {indicators && indicators.length === 0
                  ? 'No indicators have been submitted on this project yet.'
                  : 'Try a different filter or search term.'}
              </p>
            </CardContent>
          </Card>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((ind) => (
              <IndicatorRow
                key={ind.indicatorId}
                ind={ind}
                onVerify={() => setVerifying(ind)}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />

      {/* Full verifier sheet — verify + media + video + history */}
      <VerifierIndicatorSheet
        open={!!verifying}
        onOpenChange={(o) => !o && setVerifying(null)}
        indicator={verifying}
        onVerified={() => {
          setToast('Indicator verified');
          void load().then((latest) => {
            if (!latest) return;
            setVerifying((current) => {
              if (!current) return current;
              const next = latest.find(
                (i) => i.indicatorId === current.indicatorId,
              );
              // Indicator might disappear from the queue due filters/permissions.
              return next ?? null;
            });
          });
        }}
      />

      {/* Bulk confirm */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !o && setBulkOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#2E7D32]" />
              Verify all pending indicators
            </DialogTitle>
            <DialogDescription>
              This will mark all {pendingCount} pending indicators as verified,
              copying the nodal officer&apos;s submitted values into the
              verified fields. Continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={bulkRunning}
              onClick={() => setBulkOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              disabled={bulkRunning}
              onClick={runBulkVerify}
              className="cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
            >
              {bulkRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Yes, verify all
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project completion modal */}
      <Dialog
        open={completeOpen}
        onOpenChange={(o) => !o && !completeRunning && setCompleteOpen(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PartyPopper className="h-5 w-5 text-success-green" />
              Mark project as complete
            </DialogTitle>
            <DialogDescription>
              All {totalIndicators} indicators have been verified at 100%.
              Record the official date the project was physically completed.
              This is logged in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ccd" className="text-xs">
                Completion date
              </Label>
              <div className="relative">
                <CalendarCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ccd"
                  type="date"
                  value={completeDate}
                  onChange={(e) => setCompleteDate(e.target.value)}
                  className="pl-9"
                  max={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="crem" className="text-xs">
                Remarks (optional)
              </Label>
              <Textarea
                id="crem"
                rows={3}
                maxLength={2000}
                value={completeRemarks}
                onChange={(e) => setCompleteRemarks(e.target.value)}
                placeholder="Any closing note about the project completion…"
                className="resize-y"
              />
            </div>
            {completeError && (
              <div className="flex items-start gap-2 rounded-md border border-error-red/30 bg-error-red/5 p-2.5 text-xs text-error-red">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {completeError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={completeRunning}
              onClick={() => setCompleteOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={submitProjectCompletion}
              disabled={completeRunning || !completeDate}
              className="cursor-pointer bg-success-green text-white hover:bg-success-green/90"
            >
              {completeRunning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <PartyPopper className="h-4 w-4" />
                  Confirm completion
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-24 z-50 -translate-x-1/2"
        >
          <div className="flex items-center gap-2 rounded-lg bg-success-green px-3 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-white/10">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Indicator row
// ============================================================================
function IndicatorRow({
  ind,
  onVerify,
}: {
  ind: Indicator;
  onVerify: () => void;
}) {
  const pct = Math.min(100, Math.round(ind.percentage));
  const verifiedPct = Math.min(100, Math.round(ind.verifiedPercentage));
  const isApproved = ind.status === 'approved';
  const isReverify = ind.status === 'reverification_required';

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 shadow-sm transition-all duration-200 hover:shadow-md',
        isApproved ? 'border-l-success-green' : 'border-l-warning-amber',
      )}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {ind.name}
              </h3>
              {isApproved ? (
                <Badge className="bg-success-green/90 text-white">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              ) : isReverify ? (
                <Badge className="bg-warning-amber/90 text-white">
                  <Clock className="h-3 w-3" />
                  Re-verification Required
                </Badge>
              ) : (
                <Badge className="bg-warning-amber/90 text-white">
                  <Clock className="h-3 w-3" />
                  Pending
                </Badge>
              )}
              {ind.imageCount > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  <ImageIcon className="h-3 w-3" />
                  {ind.imageCount}
                </Badge>
              )}
              {ind.videoCount > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  <Video className="h-3 w-3" />
                  {ind.videoCount}
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {ind.district && <>{ind.district} · </>}
              Submitted by{' '}
              <span className="font-medium text-foreground">
                {ind.submittedByName || '—'}
              </span>
              {ind.submittedDate && (
                <> · {new Date(ind.submittedDate).toLocaleDateString('en-IN')}</>
              )}
            </p>

            {ind.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {ind.description}
              </p>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Stat
                label="Physical"
                primary={`${ind.physicalAchievement} / ${ind.physicalTarget}`}
                pct={pct}
                tone="info"
              />
              <Stat
                label="Financial (Lakhs)"
                primary={`₹ ${inrFormat.format(ind.financialAchievement)} / ${inrFormat.format(ind.financialTarget)}`}
                pct={
                  ind.financialTarget > 0
                    ? Math.round(
                        (ind.financialAchievement / ind.financialTarget) * 100,
                      )
                    : 0
                }
                tone="success"
              />
            </div>

            {isApproved && (
              <p className="flex items-center gap-1.5 text-[11px] text-success-green">
                <CheckCircle2 className="h-3 w-3" />
                Verified by{' '}
                <span className="font-semibold">{ind.verifiedByName ?? '—'}</span>
                {ind.verifiedDate && (
                  <> on {new Date(ind.verifiedDate).toLocaleDateString('en-IN')}</>
                )}
                {' '}— {verifiedPct}% confirmed
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
            {!isApproved ? (
              <Button
                size="sm"
                onClick={onVerify}
                className="cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {isReverify ? 'Review Update' : 'Verify'}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={onVerify}
                className="cursor-pointer"
              >
                Re-verify
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  primary,
  pct,
  tone,
}: {
  label: string;
  primary: string;
  pct: number;
  tone: 'info' | 'success';
}) {
  const barCls = tone === 'success' ? 'bg-success-green' : 'bg-kerala-blue';
  return (
    <div className="rounded-md border bg-muted/20 p-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-xs font-semibold">{primary}</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', barCls)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </div>
    </div>
  );
}

// Verify drawer was replaced by VerifierIndicatorSheet (imported above).
