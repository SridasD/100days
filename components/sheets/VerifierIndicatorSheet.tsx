'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  CheckCircle2,
  Clock,
  CloudUpload,
  Facebook,
  FileText,
  History as HistoryIcon,
  ImageIcon,
  Images,
  IndianRupee,
  Link2,
  Loader2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  X,
  Youtube,
  ZoomIn,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ===========================================================================
// TYPES
// ===========================================================================
export interface VerifierIndicator {
  indicatorId: number;
  projectId: number;
  name: string;
  district: string;
  submittedByName: string;
  physicalTarget: number;
  /** Canonical display value â€” verified when present, nodal otherwise */
  physicalAchievement: number;
  financialTarget: number;
  /** Canonical display value â€” verified when present, nodal otherwise */
  financialAchievement: number;
  percentage: number;
  verifiedPercentage: number;
  description: string;
  // Raw nodal-submitted vs verifier-corrected (for side-by-side display)
  submittedPhysicalAchievement?: number;
  submittedFinancialAchievement?: number;
  submittedDescription?: string;
  verifiedPhysicalAchievement?: number | null;
  verifiedFinancialAchievement?: number | null;
  verifiedDescription?: string | null;
  submittedDate: string | null;
  verifiedDate: string | null;
  verifiedByName: string | null;
  imageCount: number;
  videoCount: number;
  status: 'pending' | 'approved' | 'reverification_required' | 'rejected';
}

interface GalleryItem {
  galleryId: number;
  indicatorId: number;
  galleryType: number; // 1 image, 2 video
  imagePath: string | null;
  description: string | null;
  uploadedOn: string | null;
  isVerified: boolean | null;
}

interface HistoryEvent {
  eventId: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string | null;
  entityId: number | null;
  outcome: string | null;
  loggedOn: string;
  meta: any;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: VerifierIndicator | null;
  onVerified: () => void;
}

const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ACCEPTED_IMAGE_EXTS = ['jpg', 'jpeg', 'png'] as const;
const ACCEPTED_DOC_EXTS = ['pdf'] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const YT_HOST_RE = /youtube\.com|youtu\.be/i;
const FB_HOST_RE = /facebook\.com|fb\.watch/i;

function extOf(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
function detectPlatform(url: string): 'youtube' | 'facebook' | null {
  if (YT_HOST_RE.test(url)) return 'youtube';
  if (FB_HOST_RE.test(url)) return 'facebook';
  return null;
}

// ===========================================================================
// MAIN
// ===========================================================================
export function VerifierIndicatorSheet({
  open,
  onOpenChange,
  indicator,
  onVerified,
}: Props) {
  type Tab = 'verify' | 'media' | 'video' | 'history';
  const [tab, setTab] = useState<Tab>('verify');
  const [toast, setToast] = useState<string | null>(null);

  // Verify form state (pre-filled with the nodal-submitted values).
  const [physical, setPhysical] = useState(0);
  const [financial, setFinancial] = useState(0);
  const [directDays, setDirectDays] = useState(0);
  const [directPersons, setDirectPersons] = useState(0);
  const [indirectDays, setIndirectDays] = useState(0);
  const [indirectPersons, setIndirectPersons] = useState(0);
  const [description, setDescription] = useState('');
  const [remarks, setRemarks] = useState('');
  const [pendingSave, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const remarksRef = useRef<HTMLTextAreaElement | null>(null);

  // Gallery state
  const [images, setImages] = useState<GalleryItem[]>([]);
  const [videos, setVideos] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  // History state
  const [events, setEvents] = useState<HistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Reset whenever a new indicator opens.
  // Verifier must review the latest pending submission first; previously
  // verified values are shown as comparison context.
  useEffect(() => {
    if (!indicator) return;
    const useSubmittedBaseline =
      indicator.status === 'pending' ||
      indicator.status === 'reverification_required';
    const seedPhys = useSubmittedBaseline
      ? (indicator.submittedPhysicalAchievement ?? indicator.physicalAchievement)
      : (indicator.verifiedPhysicalAchievement ?? indicator.physicalAchievement);
    const seedFin = useSubmittedBaseline
      ? (indicator.submittedFinancialAchievement ?? indicator.financialAchievement)
      : (indicator.verifiedFinancialAchievement ?? indicator.financialAchievement);
    const seedDesc = useSubmittedBaseline
      ? (indicator.submittedDescription ?? indicator.description ?? '')
      : (indicator.verifiedDescription ?? indicator.description ?? '');
    setPhysical(seedPhys);
    setFinancial(seedFin);
    setDescription(seedDesc);
    setRemarks('');
    setDirectDays(0);
    setDirectPersons(0);
    setIndirectDays(0);
    setIndirectPersons(0);
    setSaveError(null);
    setTab('verify');
  }, [indicator?.indicatorId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch gallery when sheet opens
  useEffect(() => {
    if (!open || !indicator) return;
    const id = indicator.indicatorId;
    setGalleryLoading(true);
    setGalleryError(null);
    fetch(`/api/verify/indicators/${id}/gallery`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ items: GalleryItem[] }>;
      })
      .then((j) => {
        setImages(j.items.filter((i) => i.galleryType === 1));
        setVideos(j.items.filter((i) => i.galleryType === 2));
      })
      .catch((e) =>
        setGalleryError(e instanceof Error ? e.message : 'Failed to load'),
      )
      .finally(() => setGalleryLoading(false));
  }, [open, indicator?.indicatorId]);

  // Lazy-load history when its tab is first viewed
  const loadHistory = useCallback(async () => {
    if (!indicator) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(
        `/api/verify/indicators/${indicator.indicatorId}/history`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? `HTTP ${res.status}`);
      }
      const j = (await res.json()) as { events: HistoryEvent[] };
      setEvents(j.events);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setHistoryLoading(false);
    }
  }, [indicator?.indicatorId]);

  useEffect(() => {
    if (tab === 'history' && events === null) void loadHistory();
  }, [tab, events, loadHistory]);

  // ----- helpers ---------------------------------------------------------
  const corrections = useMemo(() => {
    if (!indicator) return [] as Array<{ key: string; from: any; to: any }>;
    const list: Array<{ key: string; from: any; to: any }> = [];
    const num = (v: any) => (v == null ? 0 : Number(v));
    // Compare against the *nodal-submitted* values (the original baseline),
    // not the current canonical values which may already be a verifier edit.
    const baselinePhys =
      indicator.submittedPhysicalAchievement ?? indicator.physicalAchievement;
    const baselineFin =
      indicator.submittedFinancialAchievement ?? indicator.financialAchievement;
    const baselineDesc =
      indicator.submittedDescription ?? indicator.description ?? '';

    if (num(baselinePhys) !== num(physical))
      list.push({ key: 'Physical achievement', from: baselinePhys, to: physical });
    if (num(baselineFin) !== num(financial))
      list.push({ key: 'Financial (Lakhs)', from: baselineFin, to: financial });
    if (baselineDesc !== (description ?? ''))
      list.push({
        key: 'Description',
        from: '(see nodal text)',
        to: '(updated)',
      });
    return list;
  }, [indicator, physical, financial, description]);

  const hasCorrections = corrections.length > 0;
  // Remarks become mandatory the moment the verifier changes anything.
  const remarksRequired = hasCorrections;
  const remarksOk = !remarksRequired || remarks.trim().length >= 5;

  const onApprove = () => {
    if (!indicator) return;
    setSaveError(null);
    if (remarksRequired && !remarksOk) {
      setSaveError(
        'Please add remarks (min 5 chars) to explain your corrections.',
      );
      setTab('verify');
      // Keep the missing mandatory field in-view and focused.
      requestAnimationFrame(() => {
        remarksRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        remarksRef.current?.focus();
      });
      return;
    }
    startSave(async () => {
      try {
        const res = await fetch(
          `/api/verify/indicators/${indicator.indicatorId}/verify`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              verified_physical_achievement: Number(physical),
              verified_financial_achievement: Number(financial),
              verified_description: description,
              verified_direct_days: Number(directDays),
              verified_direct_persons: Number(directPersons),
              verified_indirect_days: Number(indirectDays),
              verified_indirect_persons: Number(indirectPersons),
              remarks,
            }),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setToast(
          hasCorrections
            ? 'Verified with corrections recorded'
            : 'Verified',
        );
        // Refresh history with the new event(s)
        setEvents(null);
        onVerified();
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  };

  const refreshGallery = useCallback(async () => {
    if (!indicator) return;
    const res = await fetch(
      `/api/verify/indicators/${indicator.indicatorId}/gallery`,
      { cache: 'no-store' },
    );
    if (!res.ok) return;
    const j = (await res.json()) as { items: GalleryItem[] };
    setImages(j.items.filter((i) => i.galleryType === 1));
    setVideos(j.items.filter((i) => i.galleryType === 2));
    // Reset history so the new events show up next tab visit
    setEvents(null);
  }, [indicator?.indicatorId]);

  if (!indicator) return null;

  const isApproved = indicator.status === 'approved';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-[760px] md:max-w-[760px]"
        >
          {/* HEADER */}
          <header
            style={{ backgroundColor: '#2E7D32' }}
            className="flex items-start justify-between gap-3 px-6 py-4 text-white shadow-sm"
          >
            <div className="min-w-0 space-y-0.5">
              <SheetTitle className="truncate text-base font-semibold">
                {indicator.name}
              </SheetTitle>
              <SheetDescription className="truncate text-xs text-white/80">
                Project #{indicator.projectId} Â· Verifier review
              </SheetDescription>
            </div>
            <SheetClose
              aria-label="Close"
              className="cursor-pointer rounded-md p-1 text-white/85 transition-colors duration-200 hover:bg-white/15 hover:text-white"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </header>

          {/* CONTEXT STRIP */}
          <div className="border-b bg-muted/40 px-6 py-2 text-[11px] text-muted-foreground">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Target:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {indicator.physicalTarget}
                </span>
              </span>
              <span className="opacity-40">|</span>
              <span>
                Financial:{' '}
                <span className="font-mono font-semibold text-foreground">
                  â‚¹ {inrFormat.format(indicator.financialTarget)} L
                </span>
              </span>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="font-medium text-foreground">
                  {indicator.district || 'â€”'}
                </span>
              </span>
              <span className="opacity-40">|</span>
              {isApproved ? (
                <Badge className="bg-success-green/90 text-white">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge className="bg-warning-amber/90 text-white">
                  <Clock className="h-3 w-3" />
                  Pending
                </Badge>
              )}
            </p>
          </div>

          {/* TABS */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="sticky top-0 z-10 shrink-0">
              <TabsTrigger value="verify">
                <ShieldCheck className="h-4 w-4" />
                Verify
              </TabsTrigger>
              <TabsTrigger value="media">
                <Images className="h-4 w-4" />
                Media
                {images.length > 0 && (
                  <Badge variant="info" className="ml-1 h-5 px-1.5 text-[10px]">
                    {images.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="video">
                <Video className="h-4 w-4" />
                Video
                {videos.length > 0 && (
                  <Badge variant="info" className="ml-1 h-5 px-1.5 text-[10px]">
                    {videos.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">
                <HistoryIcon className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            {/* ---------------- VERIFY TAB ---------------- */}
            <TabsContent
              value="verify"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 pb-24">
                {/* Submitted vs Verified comparison */}
                <section>
                  <SectionTitle
                    icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
                    title="Nodal submission vs your verification"
                  />
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border bg-muted/20 p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Submitted by nodal
                      </p>
                      <KV label="Physical">
                        {indicator.submittedPhysicalAchievement ??
                          indicator.physicalAchievement}{' '}
                        / {indicator.physicalTarget}
                      </KV>
                      <KV label="Financial (L)">
                        â‚¹{' '}
                        {inrFormat.format(
                          indicator.submittedFinancialAchievement ??
                          indicator.financialAchievement,
                        )}{' '}
                        / â‚¹ {inrFormat.format(indicator.financialTarget)}
                      </KV>
                      <KV label="% Complete">
                        {Math.round(indicator.percentage)}%
                      </KV>
                      <KV label="By">{indicator.submittedByName || 'â€”'}</KV>
                      <KV label="On">
                        {indicator.submittedDate
                          ? new Date(indicator.submittedDate).toLocaleString(
                            'en-IN',
                          )
                          : 'â€”'}
                      </KV>
                      {(indicator.submittedDescription ?? indicator.description) && (
                        <p className="mt-2 line-clamp-3 text-[11px] text-muted-foreground">
                          â€œ{indicator.submittedDescription ?? indicator.description}â€
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-[#2E7D32]/30 bg-[#2E7D32]/5 p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#2E7D32]">
                        Verified values (editable)
                      </p>
                      <div className="space-y-2">
                        <Field label="Physical Achievement">
                          <Input
                            type="number"
                            step="any"
                            min={0}
                            value={physical}
                            onChange={(e) => setPhysical(Number(e.target.value))}
                          />
                        </Field>
                        <Field label="Financial (Lakhs)">
                          <div className="relative">
                            <IndianRupee className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={financial}
                              className="pl-9"
                              onChange={(e) =>
                                setFinancial(Number(e.target.value))
                              }
                            />
                          </div>
                        </Field>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Employment generation */}
                <section>
                  <SectionTitle
                    icon={<BarChart3 className="h-3.5 w-3.5" />}
                    title="Employment generation (verified)"
                  />
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <Field label="Direct â€” Days">
                      <Input
                        type="number"
                        min={0}
                        value={directDays}
                        onChange={(e) =>
                          setDirectDays(Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Direct â€” Persons">
                      <Input
                        type="number"
                        min={0}
                        value={directPersons}
                        onChange={(e) =>
                          setDirectPersons(Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Indirect â€” Days">
                      <Input
                        type="number"
                        min={0}
                        value={indirectDays}
                        onChange={(e) =>
                          setIndirectDays(Number(e.target.value))
                        }
                      />
                    </Field>
                    <Field label="Indirect â€” Persons">
                      <Input
                        type="number"
                        min={0}
                        value={indirectPersons}
                        onChange={(e) =>
                          setIndirectPersons(Number(e.target.value))
                        }
                      />
                    </Field>
                  </div>
                </section>

                {/* Description */}
                <section>
                  <SectionTitle
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    title="Verified description"
                  />
                  <Textarea
                    rows={3}
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Corrected or confirmed description of work doneâ€¦"
                    className="mt-2 resize-y"
                  />
                </section>

                {/* Corrections preview */}
                {hasCorrections && (
                  <section className="rounded-lg border border-warning-amber/40 bg-warning-amber/5 p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-warning-amber">
                      <Sparkles className="h-3 w-3" />
                      You are about to record {corrections.length} correction
                      {corrections.length === 1 ? '' : 's'}
                    </p>
                    <ul className="mt-2 space-y-0.5 text-[11px]">
                      {corrections.map((c) => (
                        <li
                          key={c.key}
                          className="flex flex-wrap items-center gap-1.5 text-muted-foreground"
                        >
                          <span className="font-medium text-foreground">
                            {c.key}:
                          </span>
                          <span className="line-through">{String(c.from)}</span>
                          <span className="opacity-60">â†’</span>
                          <span className="font-semibold text-foreground">
                            {String(c.to)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Remarks */}
                <section>
                  <SectionTitle
                    icon={<MessageSquare className="h-3.5 w-3.5" />}
                    title={
                      remarksRequired
                        ? 'Remarks (required)'
                        : 'Remarks (optional)'
                    }
                  />
                  <Textarea
                    ref={remarksRef}
                    rows={3}
                    maxLength={2000}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    aria-invalid={remarksRequired && !remarksOk}
                    placeholder={
                      remarksRequired
                        ? 'Explain why you corrected the valuesâ€¦'
                        : 'Add a note about this verification (optional)'
                    }
                    className={cn(
                      'mt-2 resize-y',
                      remarksRequired &&
                      !remarksOk &&
                      'border-error-red focus-visible:ring-error-red',
                    )}
                  />
                  {remarksRequired && !remarksOk && (
                    <p className="mt-1 text-[11px] text-error-red">
                      Required when changing nodal-submitted values.
                    </p>
                  )}
                </section>

                {saveError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-2.5 text-xs text-error-red"
                  >
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    {saveError}
                  </div>
                )}
              </div>

              <footer className="border-t bg-background px-6 py-3">
                {(images.length > 0 || videos.length > 0) && (
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Approving this indicator will also verify attached evidence:
                    {' '}
                    <span className="font-medium text-foreground">
                      {images.length} image{images.length === 1 ? '' : 's'}
                    </span>
                    {' '}
                    and
                    {' '}
                    <span className="font-medium text-foreground">
                      {videos.length} video{videos.length === 1 ? '' : 's'}
                    </span>
                    .
                  </p>
                )}
                <Button
                  onClick={onApprove}
                  disabled={pendingSave}
                  size="lg"
                  className="h-11 w-full cursor-pointer bg-[#2E7D32] text-sm font-semibold uppercase tracking-wide shadow-md hover:bg-[#256328]"
                >
                  {pendingSave ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Savingâ€¦
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      {isApproved ? 'Save corrections & re-verify' : 'Approve'}
                    </>
                  )}
                </Button>
              </footer>
            </TabsContent>

            {/* ---------------- MEDIA TAB ---------------- */}
            <TabsContent
              value="media"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <MediaTab
                indicatorId={indicator.indicatorId}
                images={images}
                loading={galleryLoading}
                error={galleryError}
                onChange={refreshGallery}
                onToast={setToast}
              />
            </TabsContent>

            {/* ---------------- VIDEO TAB ---------------- */}
            <TabsContent
              value="video"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <VideoTab
                indicatorId={indicator.indicatorId}
                videos={videos}
                loading={galleryLoading}
                error={galleryError}
                onChange={refreshGallery}
                onToast={setToast}
              />
            </TabsContent>

            {/* ---------------- HISTORY TAB ---------------- */}
            <TabsContent
              value="history"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <HistoryTab
                events={events}
                loading={historyLoading}
                error={historyError}
                onReload={() => {
                  setEvents(null);
                  void loadHistory();
                }}
              />
            </TabsContent>
          </Tabs>

          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute left-1/2 top-20 z-50 -translate-x-1/2"
            >
              <div className="flex items-center gap-2 rounded-lg bg-success-green px-3 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-white/10">
                <CheckCircle2 className="h-4 w-4" />
                {toast}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

// ===========================================================================
// MEDIA TAB
// ===========================================================================
function MediaTab({
  indicatorId,
  images,
  loading,
  error,
  onChange,
  onToast,
}: {
  indicatorId: number;
  images: GalleryItem[];
  loading: boolean;
  error: string | null;
  onChange: () => void;
  onToast: (s: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewUrl = useMemo(() => {
    if (!file || !file.type.startsWith('image/')) return null;
    return URL.createObjectURL(file);
  }, [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  function validate(f: File): string | null {
    const ext = extOf(f.name);
    const allowed = [...ACCEPTED_IMAGE_EXTS, ...ACCEPTED_DOC_EXTS] as readonly string[];
    if (!allowed.includes(ext))
      return `Only ${allowed.join(', ')} files allowed.`;
    if (f.size > MAX_SIZE_BYTES) return 'File size exceeds 5MB limit.';
    return null;
  }

  function handleFile(f: File) {
    const err = validate(f);
    if (err) {
      setValidationError(err);
      setFile(null);
      return;
    }
    setValidationError(null);
    setFile(f);
  }

  async function upload() {
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    if (description.trim()) fd.append('description', description.trim());
    try {
      const res = await fetch(
        `/api/verify/indicators/${indicatorId}/gallery`,
        { method: 'POST', body: fd },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      onToast('Uploaded as verifier evidence');
      setFile(null);
      setDescription('');
      onChange();
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function remove(galleryId: number) {
    if (!confirm('Delete this evidence? This is logged in the audit trail.'))
      return;
    try {
      const res = await fetch(
        `/api/verify/indicators/${indicatorId}/gallery?galleryId=${galleryId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      onToast('Removed');
      onChange();
    } catch {
      onToast('Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading mediaâ€¦
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8 text-sm text-error-red">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <p className="rounded-md border border-warning-amber/30 bg-warning-amber/10 p-2 text-[11px] text-warning-amber">
          You are reviewing as a verifier â€” uploads here are flagged as
          verified evidence; deletes are recorded in the audit trail.
        </p>

        {/* Upload */}
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                fileInputRef.current?.click();
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-5 text-center transition-all duration-200 hover:border-[#2E7D32] hover:bg-[#2E7D32]/5"
          >
            <CloudUpload className="h-7 w-7 text-[#2E7D32]" />
            <p className="text-sm font-medium">Drop or click to upload</p>
            <p className="text-[11px] text-muted-foreground">
              .jpg .jpeg .png .pdf Â· max 5 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-14 w-14 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-[#2E7D32]/10 text-[#2E7D32]">
                  <FileText className="h-6 w-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" title={file.name}>
                  {file.name}
                </p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {formatBytes(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-error-red hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              disabled={uploading}
              className="resize-none text-sm"
            />
            <Button
              type="button"
              onClick={upload}
              disabled={uploading}
              className="w-full cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploadingâ€¦
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        )}

        {validationError && (
          <div className="flex items-start gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-2.5 text-xs text-error-red">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {validationError}
          </div>
        )}

        {/* Gallery */}
        {images.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
            No images uploaded for this indicator yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {images.map((img, idx) => {
              const src = img.imagePath?.startsWith('http')
                ? img.imagePath
                : `/api/uploads/${img.imagePath}`;
              return (
                <div
                  key={img.galleryId}
                  className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={src ?? ''}
                      alt={img.description ?? 'Indicator evidence'}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    <div className="absolute right-1.5 top-1.5 flex gap-1">
                      {img.isVerified ? (
                        <Badge className="bg-success-green/90 text-[10px] text-white">
                          <ShieldCheck className="h-3 w-3" />
                          Verifier
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-white text-[10px]">
                          <ImageIcon className="h-3 w-3" />
                          Nodal
                        </Badge>
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setLightboxIndex(idx)}
                        className="cursor-pointer bg-white text-foreground hover:bg-white/90"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                        View
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => remove(img.galleryId)}
                        className="cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p
                      className="truncate text-xs font-medium"
                      title={img.description ?? ''}
                    >
                      {img.description || 'Untitled image'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          images={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  images,
  index,
  onClose,
}: {
  images: GalleryItem[];
  index: number;
  onClose: () => void;
}) {
  const img = images[index];
  const src = img.imagePath?.startsWith('http')
    ? img.imagePath
    : `/api/uploads/${img.imagePath}`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
      >
        <img
          src={src ?? ''}
          alt={img.description ?? 'Evidence'}
          className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
        {img.description && (
          <p className="max-w-2xl text-center text-sm text-white">
            {img.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// VIDEO TAB
// ===========================================================================
function VideoTab({
  indicatorId,
  videos,
  loading,
  error,
  onChange,
  onToast,
}: {
  indicatorId: number;
  videos: GalleryItem[];
  loading: boolean;
  error: string | null;
  onChange: () => void;
  onToast: (s: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [embedError, setEmbedError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const platform = detectPlatform(url);

  const submit = async () => {
    if (!platform) return;
    setPending(true);
    setEmbedError(null);
    try {
      const res = await fetch(
        `/api/verify/indicators/${indicatorId}/gallery`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ url: url.trim() }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setUrl('');
      onToast('Video embedded by verifier');
      onChange();
    } catch (e) {
      setEmbedError(e instanceof Error ? e.message : 'Embed failed');
    } finally {
      setPending(false);
    }
  };

  async function remove(galleryId: number) {
    if (!confirm('Delete this video? Logged in audit trail.')) return;
    try {
      const res = await fetch(
        `/api/verify/indicators/${indicatorId}/gallery?galleryId=${galleryId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      onToast('Removed');
      onChange();
    } catch {
      onToast('Delete failed');
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading videosâ€¦
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-8 text-sm text-error-red">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div className="space-y-2">
          <Label htmlFor="vurl" className="text-xs">
            Add verified video link (YouTube / Facebook)
          </Label>
          <Textarea
            id="vurl"
            rows={2}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=â€¦  or  https://facebook.com/â€¦/videos/â€¦"
            className="resize-none font-mono text-xs"
          />
          {platform ? (
            <Badge className="bg-[#2E7D32] text-[10px] text-white">
              {platform === 'youtube' ? (
                <Youtube className="h-3 w-3" />
              ) : (
                <Facebook className="h-3 w-3" />
              )}
              {platform === 'youtube' ? 'YouTube' : 'Facebook'}
            </Badge>
          ) : url.trim() ? (
            <Badge className="bg-warning-amber text-[10px] text-white">
              <AlertTriangle className="h-3 w-3" />
              Unsupported URL
            </Badge>
          ) : null}
          {embedError && (
            <p className="text-xs text-error-red">{embedError}</p>
          )}
          <Button
            type="button"
            disabled={!platform || pending}
            onClick={submit}
            className="w-full cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
          >
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Embeddingâ€¦
              </>
            ) : (
              <>
                <Link2 className="h-4 w-4" />
                Embed video
              </>
            )}
          </Button>
        </div>

        {videos.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-center text-xs text-muted-foreground">
            No videos embedded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {videos.map((v) => {
              const src = v.imagePath ?? '';
              const isYT = YT_HOST_RE.test(src);
              return (
                <div
                  key={v.galleryId}
                  className="overflow-hidden rounded-lg border bg-card shadow-sm"
                >
                  <div className="relative aspect-video bg-black">
                    <iframe
                      src={src}
                      title="Embedded video"
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <Badge
                      className={cn(
                        'text-[10px] text-white',
                        isYT ? 'bg-[#FF0000]' : 'bg-[#1877F2]',
                      )}
                    >
                      {isYT ? (
                        <Youtube className="h-3 w-3" />
                      ) : (
                        <Facebook className="h-3 w-3" />
                      )}
                      {isYT ? 'YouTube' : 'Facebook'}
                      {v.isVerified && (
                        <span className="ml-1 opacity-90">Â· Verified</span>
                      )}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => remove(v.galleryId)}
                      className="cursor-pointer border-error-red/50 text-error-red hover:bg-error-red hover:text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// HISTORY TAB
// ===========================================================================
function HistoryTab({
  events,
  loading,
  error,
  onReload,
}: {
  events: HistoryEvent[] | null;
  loading: boolean;
  error: string | null;
  onReload: () => void;
}) {
  if (loading || events === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading historyâ€¦
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-sm text-error-red">
        <AlertTriangle className="h-5 w-5" />
        {error}
        <Button size="sm" variant="outline" onClick={onReload}>
          Retry
        </Button>
      </div>
    );
  }
  if (events.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-xs text-muted-foreground">
        No history yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5">
      <ol className="relative ml-3 space-y-4 border-l pl-5">
        {events.map((e) => (
          <li key={e.eventId} className="relative">
            <span
              aria-hidden
              className={cn(
                'absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background',
                actionTone(e.action),
              )}
            />
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">
                {humanizeAction(e.action)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                by{' '}
                <span className="font-medium text-foreground">
                  {e.userName ?? `#${e.userId ?? '?'}`}
                </span>
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(e.loggedOn).toLocaleString('en-IN')}
              </span>
              {e.outcome && e.outcome.toLowerCase() !== 'success' && (
                <Badge variant="outline" className="text-[10px]">
                  {e.outcome}
                </Badge>
              )}
            </div>
            <MetaBlock action={e.action} meta={e.meta} />
          </li>
        ))}
      </ol>
    </div>
  );
}

function humanizeAction(a: string) {
  switch (a) {
    case 'INDICATOR_CREATED':
      return 'Indicator created';
    case 'INDICATOR_SUBMITTED':
      return 'Progress submitted';
    case 'INDICATOR_APPROVED':
      return 'Indicator verified';
    case 'INDICATOR_REJECTED':
      return 'Indicator rejected';
    case 'INDICATOR_CORRECTED':
      return 'Verifier correction';
    case 'MEDIA_UPLOADED':
      return 'Media uploaded';
    case 'MEDIA_DELETED':
      return 'Media deleted';
    case 'VIDEO_EMBEDDED':
      return 'Video embedded';
    default:
      return a.replace(/_/g, ' ').toLowerCase();
  }
}
function actionTone(a: string) {
  if (a === 'INDICATOR_APPROVED') return 'bg-success-green';
  if (a === 'INDICATOR_CORRECTED' || a === 'INDICATOR_REJECTED')
    return 'bg-warning-amber';
  if (a === 'MEDIA_DELETED') return 'bg-error-red';
  return 'bg-kerala-blue';
}
function MetaBlock({ action, meta }: { action: string; meta: any }) {
  if (!meta || typeof meta !== 'object') return null;
  const remarks = typeof meta.remarks === 'string' ? meta.remarks : null;
  const corrections =
    meta.corrections && typeof meta.corrections === 'object'
      ? meta.corrections
      : null;
  return (
    <div className="mt-1.5 space-y-1.5">
      {corrections && (
        <ul className="rounded-md border border-warning-amber/40 bg-warning-amber/5 p-2 text-[11px]">
          {Object.entries(corrections).map(([k, v]: any) => (
            <li key={k} className="flex flex-wrap gap-1.5">
              <span className="font-medium">{k}:</span>
              <span className="line-through opacity-70">{String(v.from)}</span>
              <span className="opacity-60">â†’</span>
              <span className="font-semibold">{String(v.to)}</span>
            </li>
          ))}
        </ul>
      )}
      {remarks && (
        <div className="rounded-md border bg-muted/30 p-2 text-[11px]">
          <span className="font-medium">Remarks:</span> {remarks}
        </div>
      )}
      {action === 'MEDIA_UPLOADED' && meta.filename && (
        <p className="text-[11px] text-muted-foreground">
          File: <span className="font-mono">{meta.filename}</span>
          {meta.source === 'verifier' && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              by verifier
            </Badge>
          )}
        </p>
      )}
      {action === 'VIDEO_EMBEDDED' && meta.originalUrl && (
        <p className="text-[11px] text-muted-foreground">
          Source:{' '}
          <a
            href={meta.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="text-kerala-blue underline"
          >
            {meta.originalUrl}
          </a>
        </p>
      )}
    </div>
  );
}

// ===========================================================================
// shared
// ===========================================================================
function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2E7D32]">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2E7D32]/10"
      >
        {icon}
      </span>
      {title}
    </h3>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  );
}
function KV({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono font-semibold text-foreground">
        {children}
      </span>
    </div>
  );
}

