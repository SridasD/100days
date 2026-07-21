'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  useForm,
  type UseFormRegisterReturn,
  type UseFormReturn,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Copy,
  ExternalLink,
  Facebook,
  FileText,
  Images,
  IndianRupee,
  Info,
  Link2,
  Loader2,
  MapPin,
  PartyPopper,
  Percent,
  PlayCircle,
  Trash2,
  Users,
  Video,
  X,
  Youtube,
  ZoomIn,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
export type ActionTab = 'progress' | 'media' | 'video';

interface ApiGalleryItem {
  galleryId: number;
  indicatorId: number;
  galleryType: number; // 1 image, 2 video
  imagePath: string | null;
  description: string | null;
  uploadedOn: string | null;
  isVerified: boolean | null;
  platform?: 'youtube' | 'facebook';
  embedSrc?: string;
  originalUrl?: string;
}

interface ApiDocumentItem {
  documentId: number;
  indicatorId: number;
  filename: string;
  path: string | null;
  size: number | null;
  uploadedOn: string | null;
  description: string | null;
  verifiedBy?: number | null;
  verifiedDate?: string | null;
}

export interface ProgressSavePatch {
  physicalAchievement: number;
  financialAchievement: number;
  completedDate: string | null;
  lastUpdatedAt: string;
  isVerified: false;
}

export interface SheetIndicator {
  indicatorId: number;
  name: string;
  unit: string;
  district: string;
  physicalTarget: number;
  financialTarget: number;
  physicalAchievement: number;
  financialAchievement: number;
  completedDate: string | null;
  lastUpdatedAt: string | null;
  description?: string | null;
  achievedDirectDays?: number | null;
  achievedDirectPersons?: number | null;
  achievedIndirectDays?: number | null;
  achievedIndirectPersons?: number | null;
  verifiedDate?: string | null;
  isVerified?: boolean;
}

export interface ProjectTargets {
  projectName: string;
  directDays: number;
  directPersons: number;
  indirectDays: number;
  indirectPersons: number;
}

export interface MediaCounts {
  imageCount: number;
  documentCount: number;
  videoCount: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: ActionTab;
  indicator: SheetIndicator | null;
  projectTargets: ProjectTargets;
  onProgressSaved: (patch: ProgressSavePatch) => void;
  onMediaCountsChange: (counts: MediaCounts) => void;
}

// ===========================================================================
// CONSTANTS
// ===========================================================================
const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const ACCEPTED_IMAGE_EXTS = ['jpg', 'jpeg', 'png'] as const;
const ACCEPTED_DOC_EXTS = ['pdf'] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

function nowStamp() {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVerifiedStamp(value: string | null | undefined) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleString('en-IN');
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function parseLocationParts(location: string | null | undefined): string[] {
  if (!location) return [];
  return location
    .split(/[,|;/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function formatLocationLabel(parts: string[]): string {
  if (parts.length === 0) return 'Not specified';
  if (parts.length === 1) return parts[0];
  return 'All District';
}

function extOf(filename: string) {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

const YT_HOST_RE = /youtube\.com|youtu\.be/i;
const FB_HOST_RE = /facebook\.com|fb\.watch/i;

function detectPlatform(url: string): 'youtube' | 'facebook' | null {
  if (YT_HOST_RE.test(url)) return 'youtube';
  if (FB_HOST_RE.test(url)) return 'facebook';
  return null;
}

function deriveEmbedSrc(item: ApiGalleryItem): string {
  // Server stores ready-to-embed URL in image_path for gallery_type=2.
  return item.imagePath ?? '';
}

function derivePlatform(item: ApiGalleryItem): 'youtube' | 'facebook' {
  if (item.platform) return item.platform;
  const url = item.imagePath ?? '';
  return YT_HOST_RE.test(url) ? 'youtube' : 'facebook';
}

// ===========================================================================
// PROGRESS SCHEMA
// ===========================================================================
/**
 * Returns a Zod schema for the progress form tailored to the indicator's
 * unit + physical target, and its financial target.
 *
 *   unit === "Percentage"  → physical_achievement is hard-capped at 100
 *   unit anything else     → capped at the indicator's physical_target so
 *                            officers can enter "25000 / 500000 Numbers"
 *                            without the "must be ≤ 100" error.
 *
 * `unit === "" / null` is treated as "no cap" so the form still works for
 * legacy rows where the unit was never set.
 *
 * financial_achievement is capped at the indicator's financial_target. When
 * no financial_target is set (null or 0), financial_achievement must be 0 —
 * unlike physical, a missing financial target blocks entry rather than
 * lifting the cap, since there is nothing to measure achievement against.
 */
function makeProgressSchema(
  unit: string | undefined,
  target: number,
  financialTarget: number,
) {
  const isPercentage = (unit ?? '').trim().toLowerCase() === 'percentage';
  const maxAllowed = isPercentage
    ? 100
    : target > 0
      ? target
      : Number.POSITIVE_INFINITY;
  const financialCap = financialTarget > 0 ? financialTarget : 0;

  return z
    .object({
      physical_achievement: z.coerce
        .number()
        .min(0, 'Cannot be negative')
        .max(maxAllowed, {
          message: isPercentage
            ? 'Percentage cannot exceed 100.'
            : `Cannot exceed the physical target (${target}).`,
        }),
      financial_achievement: z.coerce
        .number()
        .min(0, 'Cannot be negative')
        .max(financialCap, {
          message:
            financialCap > 0
              ? `Cannot exceed the financial target (₹${financialTarget} L).`
              : 'No financial target is set for this indicator — financial achievement must be 0.',
        }),
      completed_date: z.string().optional().nullable().default(''),
      description: z.string().max(2000).optional().default(''),
      achieved_direct_days: z.coerce.number().int().min(0).default(0),
      achieved_direct_persons: z.coerce.number().int().min(0).default(0),
      achieved_indirect_days: z.coerce.number().int().min(0).default(0),
      achieved_indirect_persons: z.coerce.number().int().min(0).default(0),
    })
    .superRefine((d, ctx) => {
      // 100% completion still requires a completed_date — derive the
      // "is complete" check from achievement vs cap, not from a fixed 100.
      const pct =
        maxAllowed > 0 && Number.isFinite(maxAllowed)
          ? (d.physical_achievement / maxAllowed) * 100
          : 0;
      if (pct >= 100 && !d.completed_date) {
        ctx.addIssue({
          code: 'custom',
          path: ['completed_date'],
          message: 'Required when 100% complete.',
        });
      }
      const desc = d.description ?? '';
      if (desc.length > 0 && desc.length < 10) {
        ctx.addIssue({
          code: 'custom',
          path: ['description'],
          message: 'Minimum 10 characters if filling description.',
        });
      }
    });
}

type ProgressFormValues = z.infer<ReturnType<typeof makeProgressSchema>>;

function progressDefaults(i: SheetIndicator | null): ProgressFormValues {
  return {
    physical_achievement: i?.physicalAchievement ?? 0,
    financial_achievement: i?.financialAchievement ?? 0,
    completed_date: i?.completedDate ?? '',
    description: i?.description ?? '',
    achieved_direct_days: i?.achievedDirectDays ?? 0,
    achieved_direct_persons: i?.achievedDirectPersons ?? 0,
    achieved_indirect_days: i?.achievedIndirectDays ?? 0,
    achieved_indirect_persons: i?.achievedIndirectPersons ?? 0,
  };
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function IndicatorActionSheet({
  open,
  onOpenChange,
  defaultTab = 'progress',
  indicator,
  projectTargets,
  onProgressSaved,
  onMediaCountsChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActionTab>(defaultTab);
  const [showDiscard, setShowDiscard] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Gallery state — SINGLE source of truth, populated from GET /api/.../gallery
  const [images, setImages] = useState<ApiGalleryItem[]>([]);
  const [documents, setDocuments] = useState<ApiDocumentItem[]>([]);
  const [videos, setVideos] = useState<ApiGalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setActiveTab(defaultTab);
  }, [open, defaultTab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch gallery whenever the sheet opens for an indicator
  useEffect(() => {
    if (!open || !indicator) return;
    const id = indicator.indicatorId;
    setGalleryLoading(true);
    setGalleryError(null);
    fetch(`/api/officer/indicators/${id}/gallery`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{
          items: ApiGalleryItem[];
          documents: ApiDocumentItem[];
        }>;
      })
      .then((j) => {
        const imgs = j.items.filter((i) => i.galleryType === 1);
        const vids = j.items.filter((i) => i.galleryType === 2);
        setImages(imgs);
        setVideos(vids);
        setDocuments(j.documents ?? []);
      })
      .catch((e) => {
        setGalleryError(e instanceof Error ? e.message : 'Failed to load');
      })
      .finally(() => setGalleryLoading(false));
  }, [open, indicator?.indicatorId]);

  // Notify parent of count changes
  useEffect(() => {
    if (!open || !indicator) return;
    onMediaCountsChange({
      imageCount: images.length,
      documentCount: documents.length,
      videoCount: videos.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length, documents.length, videos.length]);

  // Progress form — schema is rebuilt whenever the indicator changes so the
  // `max` rule on physical_achievement always reflects the right unit and
  // target. useMemo is keyed on (unit, target) so the schema is stable
  // across renders of the same indicator.
  const progressSchema = useMemo(
    () =>
      makeProgressSchema(
        indicator?.unit,
        indicator?.physicalTarget ?? 0,
        indicator?.financialTarget ?? 0,
      ),
    [indicator?.unit, indicator?.physicalTarget, indicator?.financialTarget],
  );
  const form = useForm<ProgressFormValues>({
    resolver: zodResolver(progressSchema),
    defaultValues: progressDefaults(indicator),
    mode: 'onTouched',
  });

  useEffect(() => {
    if (indicator) form.reset(progressDefaults(indicator));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicator?.indicatorId]);

  const {
    formState: { isDirty: progressDirty },
  } = form;

  const safeClose = useCallback(() => {
    if (progressDirty) setShowDiscard(true);
    else onOpenChange(false);
  }, [progressDirty, onOpenChange]);

  const discardAndClose = () => {
    setShowDiscard(false);
    onOpenChange(false);
  };

  const mediaCount = images.length + documents.length;
  const videoCount = videos.length;
  const locationParts = useMemo(
    () => parseLocationParts(indicator?.district),
    [indicator?.district],
  );
  const locationLabel = formatLocationLabel(locationParts);

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) safeClose();
          else onOpenChange(true);
        }}
      >
        <SheetContent
          side="right"
          className="flex w-full flex-col p-0 sm:max-w-[860px] lg:max-w-[920px]"
          onInteractOutside={(e) => {
            if (progressDirty) {
              e.preventDefault();
              setShowDiscard(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (progressDirty) {
              e.preventDefault();
              setShowDiscard(true);
            }
          }}
        >
          {/* HEADER */}
          <header
            style={{ backgroundColor: '#2E7D32' }}
            className="flex items-start justify-between gap-3 px-6 py-4 text-white shadow-sm"
          >
            <div className="min-w-0 space-y-0.5">
              <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/15">
                  <BarChart3 className="h-4 w-4" aria-hidden />
                </span>
                Progress Update
              </SheetTitle>
              <SheetDescription className="truncate text-sm text-white/85">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {indicator?.name ?? ''}
                </span>
              </SheetDescription>
              <p className="truncate text-xs text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  {projectTargets.projectName}
                </span>
              </p>
            </div>
            <SheetClose
              onClick={(e) => {
                if (progressDirty) {
                  e.preventDefault();
                  setShowDiscard(true);
                }
              }}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1 text-white/85 transition-colors duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                  {indicator?.physicalTarget ?? 0} {indicator?.unit ?? ''}
                </span>
              </span>
              <span className="opacity-40">|</span>
              <span>
                Financial:{' '}
                <span className="font-mono font-semibold text-foreground">
                  ₹ {inrFormat.format(indicator?.financialTarget ?? 0)} L
                </span>
              </span>
              <span className="opacity-40">|</span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                <span
                  title={locationParts.join(', ')}
                  className="font-medium text-foreground"
                >
                  {locationLabel}
                </span>
              </span>
            </p>
          </div>

          {/* TABS */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ActionTab)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="sticky top-0 z-10 mx-4 mt-3 grid h-auto shrink-0 grid-cols-3 rounded-2xl border bg-muted/50 p-1">
              <TabsTrigger
                value="progress"
                className="min-h-11 rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#2E7D32] data-[state=active]:shadow-sm"
              >
                <BarChart3 className="h-4 w-4" aria-hidden />
                Progress
              </TabsTrigger>
              <TabsTrigger
                value="media"
                className="min-h-11 rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#2E7D32] data-[state=active]:shadow-sm"
              >
                <Images className="h-4 w-4" aria-hidden />
                Documents
                {mediaCount > 0 && (
                  <Badge variant="info" className="ml-1 h-5 px-1.5 text-[10px]">
                    {mediaCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="video"
                className="min-h-11 rounded-xl text-xs font-semibold data-[state=active]:bg-white data-[state=active]:text-[#2E7D32] data-[state=active]:shadow-sm"
              >
                <Video className="h-4 w-4" aria-hidden />
                Videos
                {videoCount > 0 && (
                  <Badge variant="info" className="ml-1 h-5 px-1.5 text-[10px]">
                    {videoCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="progress"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <ProgressTabContent
                indicator={indicator}
                projectTargets={projectTargets}
                form={form}
                hasMedia={mediaCount > 0 || videoCount > 0}
                onSaved={(patch) => {
                  onProgressSaved(patch);
                }}
                onJumpToMedia={() => setActiveTab('media')}
              />
            </TabsContent>

            <TabsContent
              value="media"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <MediaTabContent
                indicatorId={indicator?.indicatorId ?? 0}
                indicatorVerifiedOn={indicator?.verifiedDate ?? null}
                loading={galleryLoading}
                error={galleryError}
                images={images}
                setImages={setImages}
                documents={documents}
                setDocuments={setDocuments}
                onToast={setToast}
              />
            </TabsContent>

            <TabsContent
              value="video"
              forceMount
              className="flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <VideoTabContent
                indicatorId={indicator?.indicatorId ?? 0}
                indicatorVerifiedOn={indicator?.verifiedDate ?? null}
                loading={galleryLoading}
                error={galleryError}
                videos={videos}
                setVideos={setVideos}
                onToast={setToast}
              />
            </TabsContent>
          </Tabs>

          {toast && (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute left-1/2 top-20 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-top-2"
            >
              <div className="flex items-center gap-2 rounded-lg bg-success-green px-3 py-2 text-xs font-medium text-white shadow-lg ring-1 ring-white/10">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {toast}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Discard guard */}
      <Dialog open={showDiscard} onOpenChange={(o) => !o && setShowDiscard(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              You have unsaved progress edits. Media already uploaded is kept
              — only the unsaved form fields will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDiscard(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={discardAndClose}
              className="cursor-pointer"
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===========================================================================
// PROGRESS TAB
// ===========================================================================
function ProgressTabContent({
  indicator,
  projectTargets,
  form,
  hasMedia,
  onSaved,
  onJumpToMedia,
}: {
  indicator: SheetIndicator | null;
  projectTargets: ProjectTargets;
  form: UseFormReturn<ProgressFormValues>;
  hasMedia: boolean;
  onSaved: (patch: ProgressSavePatch) => void;
  onJumpToMedia: () => void;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = form;

  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(
    indicator?.lastUpdatedAt ?? null,
  );
  const [highlightDate, setHighlightDate] = useState(false);

  const physical = Number(watch('physical_achievement')) || 0;
  const physicalTarget = indicator?.physicalTarget ?? 0;
  const percentage =
    physicalTarget > 0 ? Math.min(100, (physical / physicalTarget) * 100) : 0;
  const isCompleted = percentage >= 100;
  const financial = Number(watch('financial_achievement')) || 0;
  const financialTarget = indicator?.financialTarget ?? 0;
  const financialProgress =
    financialTarget > 0 ? Math.min(100, (financial / financialTarget) * 100) : 0;
  const locationParts = useMemo(
    () => parseLocationParts(indicator?.district),
    [indicator?.district],
  );
  const locationLabel = formatLocationLabel(locationParts);

  useEffect(() => {
    if (isCompleted) {
      setHighlightDate(true);
      const t = setTimeout(() => setHighlightDate(false), 1500);
      return () => clearTimeout(t);
    }
    setValue('completed_date', '');
  }, [isCompleted, setValue]);

  const desc = watch('description') ?? '';
  const counterTone =
    desc.length > 1900
      ? 'text-error-red'
      : desc.length > 20
        ? 'text-success-green'
        : 'text-muted-foreground';

  const onValid = (values: ProgressFormValues) => {
    if (!indicator) return;
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/officer/indicators/${indicator.indicatorId}/progress`,
          {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(values),
          },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const stamp = nowStamp();
        onSaved({
          physicalAchievement: Number(values.physical_achievement),
          financialAchievement: Number(values.financial_achievement),
          completedDate: values.completed_date || null,
          lastUpdatedAt: stamp,
          isVerified: false,
        });
        setSavedAt(stamp);
        form.reset(values);
      } catch (e) {
        console.error('Progress save failed', e);
        // TODO: surface inline error toast
      }
    });
  };

  return (
    <>
      <form
        id="progress-form"
        onSubmit={handleSubmit(onValid)}
        className="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-6"
        noValidate
      >
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiSummaryCard
            icon={<BarChart3 className="h-3.5 w-3.5" aria-hidden />}
            title="Physical"
            value={`${physical.toFixed(2)} / ${physicalTarget.toFixed(2)} ${indicator?.unit ?? ''}`}
            progress={percentage}
            subtitle="Target vs achieved"
          />
          <KpiSummaryCard
            icon={<IndianRupee className="h-3.5 w-3.5" aria-hidden />}
            title="Financial"
            value={`Rs ${financial.toFixed(2)} / ${financialTarget.toFixed(2)} L`}
            progress={financialProgress}
            subtitle="Target vs achieved"
          />
          <KpiSummaryCard
            icon={<Percent className="h-3.5 w-3.5" aria-hidden />}
            title="Progress"
            value={`${percentage.toFixed(2)}%`}
            progress={percentage}
            subtitle="Overall completion"
            emphasize
          />
          <KpiSummaryCard
            icon={<MapPin className="h-3.5 w-3.5" aria-hidden />}
            title="Location"
            value={locationLabel}
            progress={percentage}
            subtitle="Implementation coverage"
            valueTitle={locationParts.join(', ')}
          />
        </section>

        <section className="space-y-3">
          <SectionTitle
            icon={<BarChart3 className="h-3.5 w-3.5" />}
            title="Achievement"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
              <Label htmlFor="physical_achievement" className="text-xs">
                Physical Achievement{' '}
                <span className="text-muted-foreground">({indicator?.unit})</span>
              </Label>
              <Input
                id="physical_achievement"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                // Cap matches the Zod schema:
                //   Percentage unit → 100
                //   Anything else with a target → the target
                //   No target / no unit → no cap (input attribute omitted)
                {...((indicator?.unit ?? '').trim().toLowerCase() ===
                  'percentage'
                  ? { max: 100 }
                  : physicalTarget > 0
                    ? { max: physicalTarget }
                    : {})}
                placeholder="0"
                aria-invalid={!!errors.physical_achievement}
                className={cn(
                  'min-h-11',
                  errors.physical_achievement &&
                  'border-error-red focus-visible:ring-error-red',
                )}
                {...register('physical_achievement')}
              />
              <FieldError>{errors.physical_achievement?.message}</FieldError>
            </div>

            <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
              <Label htmlFor="pct" className="text-xs">
                % Complete
              </Label>
              <div className="relative">
                <Input
                  id="pct"
                  readOnly
                  tabIndex={-1}
                  value={percentage.toFixed(2)}
                  className="min-h-11 border-success-green/30 bg-success-green/5 pr-9 font-mono text-success-green"
                />
                <Percent
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success-green/70"
                />
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percentage)}
                className="h-2 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-success-green transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
              <Label htmlFor="financial_achievement" className="text-xs">
                Financial Achievement{' '}
                <span className="text-muted-foreground">(Lakhs)</span>
              </Label>
              <div className="relative">
                <IndianRupee
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="financial_achievement"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0}
                  max={financialTarget > 0 ? financialTarget : 0}
                  placeholder="0.00"
                  aria-invalid={!!errors.financial_achievement}
                  className={cn(
                    'min-h-11 pl-9',
                    errors.financial_achievement &&
                    'border-error-red focus-visible:ring-error-red',
                  )}
                  {...register('financial_achievement')}
                />
              </div>
              <FieldError>{errors.financial_achievement?.message}</FieldError>
            </div>

            <div className="space-y-2 rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="completed_date" className="text-xs">
                  Completed Date
                </Label>
                <span
                  title="Enabled when physical achievement reaches 100%"
                  className="cursor-help text-muted-foreground"
                >
                  <Info className="h-3 w-3" aria-hidden />
                </span>
              </div>
              <Input
                id="completed_date"
                type="date"
                disabled={!isCompleted}
                aria-disabled={!isCompleted}
                aria-invalid={!!errors.completed_date}
                className={cn(
                  'min-h-11',
                  !isCompleted && 'opacity-60',
                  isCompleted &&
                  'border-success-green ring-1 ring-success-green/30',
                  highlightDate && 'animate-pulse',
                  errors.completed_date &&
                  'border-error-red focus-visible:ring-error-red',
                )}
                {...register('completed_date')}
              />
              {isCompleted && (
                <p className="flex items-center gap-1 text-[11px] font-medium text-success-green">
                  <PartyPopper className="h-3 w-3" aria-hidden />
                  Mark completion date
                </p>
              )}
              <FieldError>{errors.completed_date?.message as string}</FieldError>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <SectionTitle
            icon={<Briefcase className="h-3.5 w-3.5" />}
            title="Employment Generation"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <EmploymentCard
              title="Direct Employment"
              targetDays={projectTargets.directDays}
              targetPersons={projectTargets.directPersons}
              daysId="achieved_direct_days"
              personsId="achieved_direct_persons"
              daysRegister={register('achieved_direct_days')}
              personsRegister={register('achieved_direct_persons')}
              daysError={errors.achieved_direct_days?.message}
              personsError={errors.achieved_direct_persons?.message}
            />
            <EmploymentCard
              title="Indirect Employment"
              targetDays={projectTargets.indirectDays}
              targetPersons={projectTargets.indirectPersons}
              daysId="achieved_indirect_days"
              personsId="achieved_indirect_persons"
              daysRegister={register('achieved_indirect_days')}
              personsRegister={register('achieved_indirect_persons')}
              daysError={errors.achieved_indirect_days?.message}
              personsError={errors.achieved_indirect_persons?.message}
            />
          </div>
        </section>

        <section className="space-y-2">
          <SectionTitle
            icon={<Info className="h-3.5 w-3.5" />}
            title="Description"
          />
          <Textarea
            id="description"
            rows={5}
            maxLength={2000}
            placeholder="Describe milestones achieved, issues faced, outcomes delivered, and any verification notes for this update."
            aria-invalid={!!errors.description}
            className={cn(
              'min-h-32 resize-y rounded-2xl',
              errors.description &&
              'border-error-red focus-visible:ring-error-red',
            )}
            {...register('description')}
          />
          <div className="flex items-center justify-between gap-3">
            <FieldError>{errors.description?.message as string}</FieldError>
            <p
              className={cn(
                'ml-auto font-mono text-[11px] tabular-nums',
                counterTone,
              )}
              aria-live="polite"
            >
              {desc.length} / 2000
            </p>
          </div>
        </section>

        {savedAt && !isDirty && !hasMedia && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-success-green/30 bg-success-green/5 p-3">
            <p className="flex items-center gap-2 text-xs text-success-green">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Saved at {savedAt}. Add photo or PDF evidence?
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onJumpToMedia}
              className="cursor-pointer border-success-green text-success-green hover:bg-success-green hover:text-white"
            >
              <Images className="h-3.5 w-3.5" />
              Add images
            </Button>
          </div>
        )}
      </form>

      <footer className="sticky bottom-0 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Last updated:{' '}
            <span className="font-medium">{savedAt ?? 'Not yet saved'}</span>
          </p>
          <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-1">
            <Button
              type="submit"
              form="progress-form"
              disabled={pending}
              className="min-h-11 cursor-pointer bg-[#2E7D32] text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 hover:bg-[#256328] hover:shadow-lg"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  Submit Progress
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </footer>
    </>
  );
}

// ===========================================================================
// MEDIA TAB
// ===========================================================================
function MediaTabContent({
  indicatorId,
  indicatorVerifiedOn,
  loading,
  error,
  images,
  setImages,
  documents,
  setDocuments,
  onToast,
}: {
  indicatorId: number;
  indicatorVerifiedOn: string | null;
  loading: boolean;
  error: string | null;
  images: ApiGalleryItem[];
  setImages: React.Dispatch<React.SetStateAction<ApiGalleryItem[]>>;
  documents: ApiDocumentItem[];
  setDocuments: React.Dispatch<React.SetStateAction<ApiDocumentItem[]>>;
  onToast: (msg: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  type Kind = 'images' | 'documents';
  const [kind, setKind] = useState<Kind>('images');
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading'>('idle');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1)));
      if (e.key === 'ArrowRight')
        setLightboxIndex((i) =>
          i === null ? null : Math.min(images.length - 1, i + 1),
        );
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, images.length]);

  const acceptedExts =
    kind === 'images' ? ACCEPTED_IMAGE_EXTS : ACCEPTED_DOC_EXTS;
  const acceptAttr = acceptedExts.map((e) => `.${e}`).join(',');

  function validate(f: File): string | null {
    const ext = extOf(f.name);
    if (!acceptedExts.includes(ext as never)) {
      return `Only ${acceptedExts.join(', ')} files are allowed.`;
    }
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

  async function startUpload() {
    if (!file || !indicatorId) return;
    setUploadState('uploading');
    setProgress(0);

    // XHR for progress events (fetch doesn't expose upload progress in browsers)
    const formData = new FormData();
    formData.append('file', file);
    if (description.trim()) formData.append('description', description.trim());

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/officer/indicators/${indicatorId}/gallery`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText) as {
            item: ApiGalleryItem | ApiDocumentItem;
          };
          const item = json.item;
          if ('galleryId' in item) {
            setImages((prev) => dedupe([item, ...prev], (x) => x.galleryId));
            onToast('Image uploaded');
          } else {
            setDocuments((prev) =>
              dedupe([item, ...prev], (x) => x.documentId),
            );
            onToast('Document uploaded');
          }
        } catch (e) {
          console.error('Bad upload response', e);
          setValidationError('Upload succeeded but server response was unreadable.');
        }
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body?.error) msg = body.error;
        } catch {
          /* swallow */
        }
        setValidationError(msg);
      }
      setFile(null);
      setDescription('');
      setProgress(0);
      setUploadState('idle');
    };
    xhr.onerror = () => {
      setValidationError('Network error during upload.');
      setUploadState('idle');
    };
    xhr.send(formData);
  }

  async function removeImage(galleryId: number) {
    try {
      const res = await fetch(
        `/api/officer/indicators/${indicatorId}/gallery?galleryId=${galleryId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Delete failed');
      setImages((prev) => prev.filter((x) => x.galleryId !== galleryId));
      onToast('Image removed');
    } catch (e) {
      console.error(e);
    }
  }

  async function removeDocument(documentId: number) {
    try {
      const res = await fetch(
        `/api/officer/indicators/${indicatorId}/gallery?documentId=${documentId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Delete failed');
      setDocuments((prev) => prev.filter((x) => x.documentId !== documentId));
      onToast('Document removed');
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading media…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-error-red">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div
          role="radiogroup"
          aria-label="Media type"
          className="inline-flex rounded-full border bg-muted/30 p-0.5 text-xs font-medium"
        >
          {(['images', 'documents'] as Kind[]).map((value) => (
            <button
              type="button"
              key={value}
              role="radio"
              aria-checked={kind === value}
              onClick={() => {
                setKind(value);
                setFile(null);
                setDescription('');
                setValidationError(null);
              }}
              className={cn(
                'cursor-pointer rounded-full px-3 py-1 transition-colors duration-200',
                kind === value
                  ? 'bg-[#2E7D32] text-white shadow'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value === 'images' ? (
                <span className="flex items-center gap-1.5">
                  <Images className="h-3.5 w-3.5" aria-hidden />
                  Images
                  {images.length > 0 && (
                    <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                      {images.length}
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  Documents
                  {documents.length > 0 && (
                    <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                      {documents.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Drop zone / preview */}
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ')
                fileInputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            style={{ minHeight: 120 }}
            className={cn(
              'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/20 px-4 py-5 text-center transition-all duration-200 hover:border-[#2E7D32] hover:bg-[#2E7D32]/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2E7D32]',
              dragActive
                ? 'border-[#2E7D32] bg-[#2E7D32]/10'
                : 'border-muted-foreground/30',
            )}
          >
            <CloudUpload className="h-8 w-8 text-[#2E7D32]" aria-hidden />
            <p className="text-sm font-medium">Drop file or click to browse</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {acceptedExts.map((e) => (
                <Badge key={e} variant="neutral" className="font-mono text-[10px]">
                  .{e}
                </Badge>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">Max 5 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptAttr}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
              className="hidden"
              aria-hidden
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-[#2E7D32]/10 text-[#2E7D32]">
                  <FileText className="h-6 w-6" aria-hidden />
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
                onClick={() => {
                  setFile(null);
                  setDescription('');
                }}
                aria-label="Remove file"
                className="cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors duration-200 hover:bg-error-red hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <Textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a short description (optional)…"
              disabled={uploadState !== 'idle'}
              className="resize-none text-sm"
            />
            {uploadState === 'uploading' && (
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-success-green transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            <Button
              type="button"
              onClick={startUpload}
              disabled={uploadState !== 'idle'}
              className="w-full cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
            >
              {uploadState === 'uploading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading… {progress}%
                </>
              ) : (
                <>
                  <CloudUpload className="h-4 w-4" />
                  Upload
                </>
              )}
            </Button>
          </div>
        )}

        {validationError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-2.5 text-xs text-error-red"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            {validationError}
          </div>
        )}

        {kind === 'images' ? (
          images.length === 0 ? (
            <EmptyHint text="No images uploaded yet" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {images.map((img, idx) => (
                <ImageThumb
                  key={img.galleryId}
                  img={img}
                  indicatorVerifiedOn={indicatorVerifiedOn}
                  onView={() => setLightboxIndex(idx)}
                  onDelete={() => removeImage(img.galleryId)}
                />
              ))}
            </div>
          )
        ) : documents.length === 0 ? (
          <EmptyHint text="No documents uploaded yet" />
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Uploaded Documents
            </p>
            <ul className="divide-y rounded-lg border">
              {documents.map((d) => (
                <li key={d.documentId} className="flex items-center gap-3 p-3">
                  <FileText className="h-4 w-4 text-[#2E7D32]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    {(() => {
                      const verifiedOn = formatVerifiedStamp(d.verifiedDate ?? null);
                      return (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{d.filename}</p>
                            {verifiedOn && (
                              <Badge className="bg-success-green/90 text-[10px] text-white">
                                <CheckCircle2 className="h-3 w-3" />
                                Verified
                              </Badge>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {d.size != null ? formatBytes(d.size) : 'Size unavailable'}
                            {' · '}
                            {d.uploadedOn ?? '-'}
                          </p>
                          {verifiedOn && (
                            <p className="text-[10px] font-medium text-success-green">
                              Verified on {verifiedOn}
                            </p>
                          )}
                        </>
                      );
                    })()}
                    {d.description && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {d.description}
                      </p>
                    )}
                  </div>
                  {d.path && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      asChild
                      className="cursor-pointer"
                    >
                      <a href={`/api/uploads/${d.path}`} target="_blank" rel="noreferrer">
                        <FileText className="h-3.5 w-3.5" />
                        Open
                      </a>
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => removeDocument(d.documentId)}
                    className="cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {lightboxIndex !== null && images[lightboxIndex] && (
        <Lightbox
          gallery={images}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex((i) => Math.max(0, (i ?? 0) - 1))}
          onNext={() =>
            setLightboxIndex((i) => Math.min(images.length - 1, (i ?? 0) + 1))
          }
        />
      )}
    </div>
  );
}

function ImageThumb({
  img,
  indicatorVerifiedOn,
  onView,
  onDelete,
}: {
  img: ApiGalleryItem;
  indicatorVerifiedOn: string | null;
  onView: () => void;
  onDelete: () => void;
}) {
  // imagePath is a relative path under UPLOAD_DIR. Served by
  // /api/uploads/[...path] (auth-gated). External URLs (e.g. video embeds
  // stored on the same column) pass through untouched.
  const src = img.imagePath?.startsWith('http')
    ? img.imagePath
    : `/api/uploads/${img.imagePath}`;
  const verifiedOn = formatVerifiedStamp(
    img.isVerified ? indicatorVerifiedOn ?? img.uploadedOn : null,
  );
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={src ?? ''}
          alt={img.description ?? 'Indicator evidence'}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
        />
        {verifiedOn && (
          <div className="absolute right-1.5 top-1.5 z-10">
            <Badge className="bg-success-green/90 text-[10px] text-white">
              <CheckCircle2 className="h-3 w-3" />
              Verified
            </Badge>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onView}
            className="cursor-pointer bg-white text-foreground hover:bg-white/90"
          >
            <ZoomIn className="h-3.5 w-3.5" />
            View
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            onClick={onDelete}
            className="cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>
      <div className="space-y-1 p-2.5">
        <p className="truncate text-xs font-medium" title={img.description ?? ''}>
          {img.description || 'Untitled image'}
        </p>
        {verifiedOn && (
          <p className="text-[10px] font-medium text-success-green">
            Verified on {verifiedOn}
          </p>
        )}
      </div>
    </div>
  );
}

function Lightbox({
  gallery,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  gallery: ApiGalleryItem[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const img = gallery[index];
  const src = img.imagePath?.startsWith('http')
    ? img.imagePath
    : `/api/uploads/${img.imagePath}`;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20"
      >
        <X className="h-5 w-5" />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
      >
        <img
          src={src ?? ''}
          alt={img.description ?? 'Indicator evidence'}
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
function VideoTabContent({
  indicatorId,
  indicatorVerifiedOn,
  loading,
  error,
  videos,
  setVideos,
  onToast,
}: {
  indicatorId: number;
  indicatorVerifiedOn: string | null;
  loading: boolean;
  error: string | null;
  videos: ApiGalleryItem[];
  setVideos: React.Dispatch<React.SetStateAction<ApiGalleryItem[]>>;
  onToast: (msg: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [pending, startTransition] = useTransition();
  const [howToOpen, setHowToOpen] = useState(false);
  const [embedError, setEmbedError] = useState<string | null>(null);

  const platform = detectPlatform(url);
  const isValid = !!platform && url.trim().length > 6;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!platform || !indicatorId) return;
    setEmbedError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/officer/indicators/${indicatorId}/gallery`,
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
        const json = (await res.json()) as { item: ApiGalleryItem };
        // SINGLE source of truth — server response is the canonical record
        setVideos((prev) => dedupe([json.item, ...prev], (x) => x.galleryId));
        setUrl('');
        onToast('Video embedded');
      } catch (err) {
        setEmbedError(err instanceof Error ? err.message : 'Save failed');
      }
    });
  };

  async function removeVideo(galleryId: number) {
    try {
      const res = await fetch(
        `/api/officer/indicators/${indicatorId}/gallery?galleryId=${galleryId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error();
      setVideos((prev) => prev.filter((v) => v.galleryId !== galleryId));
      onToast('Video removed');
    } catch {
      /* ignore */
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading videos…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-error-red">
        {error}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex-1 space-y-5 overflow-y-auto px-6 py-5"
    >
      <div className="space-y-2 rounded-lg border border-warning-amber/30 bg-warning-amber/10 p-3">
        <div className="flex items-start gap-2">
          <Info
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-amber"
            aria-hidden
          />
          <div className="space-y-0.5">
            <p className="font-malayalam text-xs leading-relaxed">
              സോഷ്യൽ മീഡിയയിൽ അപ്‌ലോഡ് ചെയ്ത വീഡിയോയുടെ ലിങ്ക് ഇവിടെ നൽകുക
            </p>
            <p className="text-[11px] text-muted-foreground">
              Paste your YouTube or Facebook video link below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHowToOpen((v) => !v)}
          aria-expanded={howToOpen}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-kerala-blue/40 bg-background px-2 py-1 text-[11px] font-medium text-kerala-blue transition-colors duration-200 hover:bg-kerala-blue hover:text-white"
        >
          <Info className="h-3 w-3" aria-hidden />
          How to get link
          <ChevronRight
            className={cn(
              'h-3 w-3 transition-transform duration-200',
              howToOpen && 'rotate-90',
            )}
            aria-hidden
          />
        </button>
        {howToOpen && (
          <div className="mt-1 space-y-2 rounded-md border bg-background p-3 text-xs">
            <div>
              <p className="flex items-center gap-1.5 font-semibold">
                <Youtube className="h-3 w-3 text-[#FF0000]" aria-hidden />
                YouTube
              </p>
              <p className="text-muted-foreground">
                Share → <Copy className="inline h-3 w-3" /> Copy link → paste here.
              </p>
            </div>
            <div>
              <p className="flex items-center gap-1.5 font-semibold">
                <Facebook className="h-3 w-3 text-[#1877F2]" aria-hidden />
                Facebook
              </p>
              <p className="text-muted-foreground">
                Open the public post → Share → Copy link → paste here.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="video-url" className="text-xs">
            Video link
          </Label>
          {platform ? (
            <span
              style={{
                backgroundColor: platform === 'youtube' ? '#FF0000' : '#1877F2',
              }}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            >
              {platform === 'youtube' ? (
                <Youtube className="h-3 w-3" />
              ) : (
                <Facebook className="h-3 w-3" />
              )}
              {platform === 'youtube' ? 'YouTube' : 'Facebook'}
            </span>
          ) : url.trim() ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-amber/15 px-2 py-0.5 text-[10px] font-semibold text-warning-amber">
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Unsupported URL
            </span>
          ) : null}
        </div>
        <Textarea
          id="video-url"
          rows={2}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…   or   https://www.facebook.com/…/videos/…"
          className={cn(
            'resize-none font-mono text-xs',
            !!url.trim() && !platform &&
            'border-error-red focus-visible:ring-error-red',
          )}
        />
      </div>

      {embedError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-2.5 text-xs text-error-red"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          {embedError}
        </div>
      )}

      <Button
        type="submit"
        disabled={!isValid || pending}
        size="lg"
        className="h-11 w-full cursor-pointer bg-[#2E7D32] text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 hover:bg-[#256328] hover:shadow-lg"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          <>
            <Link2 className="h-4 w-4" />
            Embed Video
          </>
        )}
      </Button>

      <section className="space-y-3 pt-2">
        <SectionTitle
          icon={<PlayCircle className="h-3.5 w-3.5" />}
          title="Embedded videos"
        />
        {videos.length === 0 ? (
          <EmptyHint text="No videos added yet" />
        ) : (
          <div className="space-y-3">
            {videos.map((v) => {
              const pf = derivePlatform(v);
              const src = deriveEmbedSrc(v);
              const verifiedOn = formatVerifiedStamp(
                v.isVerified ? indicatorVerifiedOn ?? v.uploadedOn : null,
              );
              return (
                <div
                  key={v.galleryId}
                  className="overflow-hidden rounded-lg border bg-card shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <div className="relative aspect-video bg-black">
                    <iframe
                      src={src}
                      title={`Embedded ${pf} video`}
                      className="absolute inset-0 h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 p-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        style={{
                          backgroundColor: pf === 'youtube' ? '#FF0000' : '#1877F2',
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      >
                        {pf === 'youtube' ? (
                          <Youtube className="h-3 w-3" />
                        ) : (
                          <Facebook className="h-3 w-3" />
                        )}
                        {pf === 'youtube' ? 'YouTube' : 'Facebook'}
                      </span>
                      {v.uploadedOn && (
                        <span className="text-[11px] text-muted-foreground">
                          Added {new Date(v.uploadedOn).toLocaleString('en-IN')}
                        </span>
                      )}
                      {verifiedOn && (
                        <Badge className="bg-success-green/90 text-[10px] text-white">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified on {verifiedOn}
                        </Badge>
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeVideo(v.galleryId)}
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
      </section>
    </form>
  );
}

// ===========================================================================
// SHARED
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

function KpiSummaryCard({
  icon,
  title,
  value,
  subtitle,
  progress,
  valueTitle,
  emphasize = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  subtitle: string;
  progress: number;
  valueTitle?: string;
  emphasize?: boolean;
}) {
  return (
    <article
      className={cn(
        'rounded-2xl border bg-card p-4 shadow-sm',
        emphasize && 'border-success-green/40 bg-success-green/5',
      )}
      aria-label={title}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-[#2E7D32]">{icon}</span>
        {title}
      </p>
      <p
        title={valueTitle}
        className={cn(
          'mt-1 line-clamp-2 text-sm font-semibold text-foreground',
          emphasize && 'text-success-green',
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all duration-300', emphasize ? 'bg-success-green' : 'bg-[#2E7D32]')}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </article>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-error-red">
      {children}
    </p>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning-amber/30 bg-warning-amber/10 p-3">
      <AlertTriangle
        className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-amber"
        aria-hidden
      />
      <p className="text-xs font-medium text-warning-amber">{text}</p>
    </div>
  );
}

function EmploymentCard({
  title,
  targetDays,
  targetPersons,
  daysId,
  personsId,
  daysRegister,
  personsRegister,
  daysError,
  personsError,
}: {
  title: string;
  targetDays: number;
  targetPersons: number;
  daysId: string;
  personsId: string;
  daysRegister: UseFormRegisterReturn;
  personsRegister: UseFormRegisterReturn;
  daysError?: string;
  personsError?: string;
}) {
  return (
    <article className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant="neutral" className="text-[10px]">
          Target: {targetDays}d / {targetPersons}p
        </Badge>
      </header>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor={daysId} className="text-xs">
            Days
          </Label>
          <Input
            id={daysId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            aria-invalid={!!daysError}
            className={cn(
              'min-h-11 font-mono',
              daysError && 'border-error-red focus-visible:ring-error-red',
            )}
            {...daysRegister}
          />
          <FieldError>{daysError}</FieldError>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={personsId} className="text-xs">
            Persons
          </Label>
          <Input
            id={personsId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            placeholder="0"
            aria-invalid={!!personsError}
            className={cn(
              'min-h-11 font-mono',
              personsError && 'border-error-red focus-visible:ring-error-red',
            )}
            {...personsRegister}
          />
          <FieldError>{personsError}</FieldError>
        </div>
      </div>
    </article>
  );
}

function dedupe<T>(arr: T[], keyFn: (item: T) => number | string): T[] {
  const seen = new Set<number | string>();
  return arr.filter((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
