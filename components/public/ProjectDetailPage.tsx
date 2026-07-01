'use client';

/**
 * Public project detail page. Mirrors the visual language of the
 * department page: green hero, soft white sections, status borders,
 * Malayalam labels.
 *
 * Layout:
 *   [hero] breadcrumb · project name · code + status + dept chips · stats
 *   [tabs] Indicators | Gallery
 *     Indicators → grid of cards with progress bars + media counts
 *     Gallery    → image grid + embedded videos
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Expand,
  Facebook,
  IndianRupee,
  ImageIcon,
  Images,
  Layers,
  PlayCircle,
  ShieldCheck,
  Target,
  Video,
  X,
  Youtube,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PublicNav } from './PublicNav';
import { VerifiedDataBadge } from './VerifiedDataBadge';
import { FacebookVideoEmbed } from '@/components/media/FacebookVideoEmbed';

export type ProjectStatus = 'completed' | 'in-progress' | 'not-started';

export interface PublicProjectIndicator {
  indicatorId: number;
  name: string;
  unit: string;
  district: string;
  physicalTarget: number;
  physicalAchievement: number;
  financialTarget: number;
  financialAchievement: number;
  physicalPct: number;
  financialPct: number;
  description: string;
  verified: boolean;
  imageCount: number;
  videoCount: number;
}

export interface PublicProjectImage {
  galleryId: number;
  imagePath: string;
  description: string;
  uploadedOn: string | null;
  indicatorId: number;
  indicatorName: string;
}

export interface PublicProjectVideo {
  galleryId: number;
  embedSrc: string;
  description: string;
  uploadedOn: string | null;
  indicatorId: number;
  indicatorName: string;
}

export interface PublicProject {
  projectId: number;
  projectPublicId?: string;
  projectCode: string | null;
  name: string;
  description: string;
  costInLakhs: number;
  status: ProjectStatus;
  completionDate: string | null;
  departments: string;
  primarySecId: number | null;
  primarySecPublicId?: string | null;
  primaryDeptName: string;
  overallPhysicalPct: number;
  overallFinancialPct: number;
  indicators: PublicProjectIndicator[];
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
}

const STATUS_META: Record<
  ProjectStatus,
  { chip: string; chipMal: string; ringBorder: string }
> = {
  completed: {
    chip: 'bg-[#E8F5E9] text-[#1B5E20]',
    chipMal: 'പൂർത്തിയായി',
    ringBorder: 'border-hdp-success',
  },
  'in-progress': {
    chip: 'bg-[#FFF8E1] text-[#E65100]',
    chipMal: 'പുരോഗതിയിൽ',
    ringBorder: 'border-hdp-warning',
  },
  'not-started': {
    chip: 'bg-[#FFEBEE] text-[#C62828]',
    chipMal: 'ആരംഭിച്ചിട്ടില്ല',
    ringBorder: 'border-hdp-danger',
  },
};

const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ProjectDetailPage({ project }: { project: PublicProject }) {
  const [tab, setTab] = useState<'indicators' | 'gallery'>('indicators');
  const tone = STATUS_META[project.status];

  return (
    <div className="flex min-h-screen flex-col bg-hdp-bg">
      <PublicNav />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-hdp-green via-hdp-green to-hdp-green-active text-white">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_50%)]"
        />
        <div className="container relative mx-auto grid gap-6 px-4 py-12 md:grid-cols-[1.5fr_1fr]">
          <div>
            <Breadcrumbs
              primarySecId={project.primarySecId}
              primarySecPublicId={project.primarySecPublicId}
              deptName={project.primaryDeptName}
              projectName={project.name}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {project.projectCode && (
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-semibold text-hdp-gold backdrop-blur">
                  {project.projectCode}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold ${tone.chip}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                <span className="font-malayalam">{tone.chipMal}</span>
              </span>
            </div>

            <h1 className="font-malayalam mt-3 text-xl font-bold leading-tight sm:text-2xl md:text-3xl lg:text-4xl">
              {project.name}
            </h1>

            {project.departments && (
              <p className="mt-2 text-xs text-white/80">
                <span className="opacity-60">വകുപ്പ്: </span>
                <span className="font-malayalam font-medium text-white">
                  {project.departments}
                </span>
              </p>
            )}

            {project.description && (
              <p className="font-malayalam mt-4 max-w-2xl text-sm leading-relaxed text-white/85">
                {project.description}
              </p>
            )}

            {project.completionDate && (
              <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-hdp-gold">
                <CalendarCheck className="h-3.5 w-3.5" />
                <span className="font-malayalam">
                  പൂർത്തിയാക്കിയത്:{' '}
                  {new Date(project.completionDate).toLocaleDateString('ml-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </p>
            )}
          </div>

          {/* Stat box */}
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="grid grid-cols-2 gap-2 text-center">
              <HeroStat
                value={`₹ ${inrFormat.format(project.costInLakhs)}`}
                labelMal="ആകെ തുക"
                subMal="ലക്ഷം"
                icon={IndianRupee}
              />
              <HeroStat
                value={String(project.indicators.length)}
                labelMal="ഘടകങ്ങൾ"
                icon={Layers}
              />
              <HeroStat
                value={`${project.overallPhysicalPct}%`}
                labelMal="ഭൗതിക പുരോഗതി"
                icon={Target}
                verified
              />
              <HeroStat
                value={`${project.overallFinancialPct}%`}
                labelMal="സാമ്പത്തിക"
                icon={ShieldCheck}
                verified
              />
            </div>
          </div>
        </div>
      </section>

      {/* TABS */}
      <section className="border-b bg-white">
        <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div role="tablist" aria-label="Project sections" className="inline-flex rounded-full border bg-white p-0.5 text-xs">
            <TabButton
              active={tab === 'indicators'}
              onClick={() => setTab('indicators')}
            >
              <Layers className="h-3.5 w-3.5" />
              <span className="font-malayalam">
                ഘടകങ്ങൾ ({project.indicators.length})
              </span>
            </TabButton>
            <TabButton
              active={tab === 'gallery'}
              onClick={() => setTab('gallery')}
            >
              <Images className="h-3.5 w-3.5" />
              <span className="font-malayalam">
                ഗാലറി ({project.images.length + project.videos.length})
              </span>
            </TabButton>
          </div>

          {project.primarySecId && (
            <Link
              href={`/public/departments/${project.primarySecPublicId ?? project.primarySecId}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-hdp-green hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="font-malayalam">
                {project.primaryDeptName} വകുപ്പിലേക്ക് മടങ്ങുക
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* CONTENT */}
      <main className="container mx-auto flex-1 px-4 py-10">
        {tab === 'indicators' && (
          <IndicatorsTab indicators={project.indicators} />
        )}
        {tab === 'gallery' && (
          <GalleryTab images={project.images} videos={project.videos} />
        )}
      </main>
    </div>
  );
}

// ===========================================================================
// INDICATORS TAB
// ===========================================================================
function IndicatorsTab({
  indicators,
}: {
  indicators: PublicProjectIndicator[];
}) {
  if (indicators.length === 0) {
    return (
      <EmptyCard
        titleMal="സ്ഥിരീകരിച്ച പുരോഗതി ഡാറ്റ ലഭ്യമല്ല"
        descMal="Verified data not yet available"
      />
    );
  }
  return (
    <ul className="grid gap-5 md:grid-cols-2">
      {indicators.map((ind, idx) => (
        <li key={ind.indicatorId}>
          <IndicatorCard ind={ind} index={idx + 1} />
        </li>
      ))}
    </ul>
  );
}

function IndicatorCard({
  ind,
  index,
}: {
  ind: PublicProjectIndicator;
  index: number;
}) {
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${ind.verified ? 'border-l-hdp-success' : 'border-l-hdp-warning'
        }`}
    >
      <div className="flex items-start justify-between gap-3 p-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-hdp-green/10 font-mono text-sm font-bold text-hdp-green">
          {String(index).padStart(2, '0')}
        </span>
        {ind.verified ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2.5 py-0.5 text-[10px] font-semibold text-[#1B5E20]">
            <ShieldCheck className="h-3 w-3" />
            <span className="font-malayalam">വെരിഫൈഡ്</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8E1] px-2.5 py-0.5 text-[10px] font-semibold text-[#E65100]">
            <Clock className="h-3 w-3" />
            <span className="font-malayalam">സ്ഥിരീകരിച്ചിട്ടില്ല</span>
          </span>
        )}
      </div>

      <h3 className="font-malayalam line-clamp-2 px-5 text-base font-bold leading-snug text-foreground">
        {ind.name}
      </h3>

      <p className="mt-1 px-5 text-[11px] text-muted-foreground">
        <span className="font-malayalam">{ind.district}</span>
        <span className="opacity-50">{' · '}</span>
        <span className="font-malayalam">{ind.unit}</span>
      </p>

      {ind.description && (
        <p className="font-malayalam line-clamp-2 px-5 pt-2 text-[11px] text-muted-foreground">
          “{ind.description}”
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 px-5">
        <Stat
          labelMal="ഭൗതിക"
          primary={`${ind.physicalAchievement} / ${ind.physicalTarget}`}
          pct={ind.physicalPct}
          color="bg-kerala-blue"
          verified
        />
        <Stat
          labelMal="സാമ്പത്തിക"
          primary={`₹ ${inrFormat.format(ind.financialAchievement)} / ₹ ${inrFormat.format(ind.financialTarget)}`}
          pct={ind.financialPct}
          color="bg-hdp-success"
          verified
        />
      </div>

      <div className="mt-auto flex items-center gap-2 px-5 py-4 text-[10px] text-muted-foreground">
        {ind.imageCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
            <ImageIcon className="h-3 w-3" />
            <span className="font-mono font-semibold">{ind.imageCount}</span>
            <span className="font-malayalam">ചിത്രങ്ങൾ</span>
            <VerifiedDataBadge className="ml-1" />
          </span>
        )}
        {ind.videoCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5">
            <Video className="h-3 w-3" />
            <span className="font-mono font-semibold">{ind.videoCount}</span>
            <span className="font-malayalam">വീഡിയോകൾ</span>
            <VerifiedDataBadge className="ml-1" />
          </span>
        )}
        {ind.imageCount === 0 && ind.videoCount === 0 && (
          <span className="font-malayalam rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            Verified data not yet available
          </span>
        )}
      </div>
    </article>
  );
}

function Stat({
  labelMal,
  primary,
  pct,
  color,
  verified = false,
}: {
  labelMal: string;
  primary: string;
  pct: number;
  color: string;
  verified?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-xl border bg-white p-2">
      <div className="flex items-center justify-between gap-1">
        <p className="font-malayalam text-[10px] uppercase tracking-wide text-muted-foreground">
          {labelMal}
        </p>
        {verified ? <VerifiedDataBadge /> : null}
      </div>
      <p className="mt-0.5 truncate font-mono text-[11px] font-bold text-foreground">
        {primary}
      </p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="mt-0.5 text-right font-mono text-[10px] text-muted-foreground">
        {clamped}%
      </p>
    </div>
  );
}

// ===========================================================================
// GALLERY TAB
// ===========================================================================
/**
 * Build per-indicator media groups, preserving the indicator order from
 * the page (sorted by indicator_id from the API).
 */
interface IndicatorMediaGroup {
  indicatorId: number;
  indicatorName: string;
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
}

function groupMediaByIndicator(
  images: PublicProjectImage[],
  videos: PublicProjectVideo[],
): IndicatorMediaGroup[] {
  const map = new Map<number, IndicatorMediaGroup>();
  const upsert = (id: number, name: string) => {
    if (!map.has(id))
      map.set(id, { indicatorId: id, indicatorName: name, images: [], videos: [] });
    return map.get(id)!;
  };
  for (const img of images) {
    upsert(img.indicatorId, img.indicatorName).images.push(img);
  }
  for (const v of videos) {
    upsert(v.indicatorId, v.indicatorName).videos.push(v);
  }
  // Sort by indicator id so groups stay in stable creation order.
  return [...map.values()].sort((a, b) => a.indicatorId - b.indicatorId);
}

function GalleryTab({
  images,
  videos,
}: {
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
}) {
  // Lightbox state — { groupId, imageIndex } so ← / → navigation stays
  // scoped to the same indicator group, matching the brief.
  const [lightbox, setLightbox] = useState<{
    groupId: number;
    index: number;
  } | null>(null);

  const groups = useMemo(
    () => groupMediaByIndicator(images, videos),
    [images, videos],
  );

  // Filter out indicators with neither images nor videos — per the brief
  // they simply shouldn't appear in this tab.
  const groupsWithMedia = groups.filter(
    (g) => g.images.length > 0 || g.videos.length > 0,
  );

  if (groupsWithMedia.length === 0) {
    return (
      <EmptyCard
        titleMal="സ്ഥിരീകരിച്ച മീഡിയ ലഭ്യമല്ല"
        descMal="Verified data not yet available"
      />
    );
  }

  const currentGroup = lightbox
    ? groupsWithMedia.find((g) => g.indicatorId === lightbox.groupId) ?? null
    : null;

  return (
    <>
      <div className="space-y-10">
        {groupsWithMedia.map((group) => (
          <IndicatorMediaGroupCard
            key={group.indicatorId}
            group={group}
            onOpenImage={(index) =>
              setLightbox({ groupId: group.indicatorId, index })
            }
          />
        ))}
      </div>

      <Lightbox
        open={!!lightbox && !!currentGroup}
        group={currentGroup}
        index={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
        onNavigate={(nextIndex) =>
          setLightbox((cur) =>
            cur ? { groupId: cur.groupId, index: nextIndex } : cur,
          )
        }
      />
    </>
  );
}

function IndicatorMediaGroupCard({
  group,
  onOpenImage,
}: {
  group: IndicatorMediaGroup;
  onOpenImage: (index: number) => void;
}) {
  const totalCount = group.images.length + group.videos.length;
  return (
    <section
      aria-label={group.indicatorName}
      className="overflow-hidden rounded-2xl border-l-4 border-l-hdp-green bg-white shadow-sm"
    >
      {/* Group header — stacks on small screens, side-by-side >= sm */}
      <header className="flex flex-col gap-2 border-b bg-hdp-bg/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="font-malayalam line-clamp-2 text-base font-bold text-foreground">
            {group.indicatorName || 'ഇൻഡിക്കേറ്റർ'}
          </h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {totalCount}
            </span>{' '}
            <span className="font-malayalam">മാദ്ധ്യമ ഇനങ്ങൾ</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {group.images.length > 0 && (
            <Badge variant="outline" className="bg-hdp-green/5 text-hdp-green">
              <ImageIcon className="h-3 w-3" />
              <span className="ml-1 font-mono font-semibold">
                {group.images.length}
              </span>
              <span className="font-malayalam ml-1">ചിത്രങ്ങൾ</span>
              <VerifiedDataBadge className="ml-1" />
            </Badge>
          )}
          {group.videos.length > 0 && (
            <Badge variant="outline" className="bg-[#7C3AED]/5 text-[#7C3AED]">
              <Video className="h-3 w-3" />
              <span className="ml-1 font-mono font-semibold">
                {group.videos.length}
              </span>
              <span className="font-malayalam ml-1">വീഡിയോ</span>
              <VerifiedDataBadge className="ml-1" />
            </Badge>
          )}
        </div>
      </header>

      <div className="space-y-5 p-3 sm:space-y-6 sm:p-5">
        {/* Image grid: 2 cols on mobile, 3 from sm, 4 from xl */}
        {group.images.length > 0 && (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
            {group.images.map((img, idx) => (
              <li key={img.galleryId}>
                <ImageThumb img={img} onOpen={() => onOpenImage(idx)} />
              </li>
            ))}
          </ul>
        )}

        {/* Videos: 1 col mobile, 2 cols >= md */}
        {group.videos.length > 0 && (
          <ul className="grid gap-3 md:grid-cols-2">
            {group.videos.map((v) => (
              <li key={v.galleryId}>
                <VideoThumb video={v} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ImageThumb({
  img,
  onOpen,
}: {
  img: PublicProjectImage;
  onOpen: () => void;
}) {
  const src = imageSrc(img.imagePath);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  return (
    <figure className="group overflow-hidden rounded-xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <button
        type="button"
        onClick={state === 'ready' ? onOpen : undefined}
        disabled={state !== 'ready'}
        aria-label={img.description || 'View image'}
        className="relative block aspect-[4/3] w-full cursor-pointer overflow-hidden bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-hdp-green disabled:cursor-default"
      >
        {/* Skeleton — visible until the image either loads or errors */}
        {state === 'loading' && (
          <div
            aria-hidden
            className="absolute inset-0 animate-pulse bg-gradient-to-br from-hdp-bg via-muted to-hdp-bg"
          />
        )}

        {/* Broken-image placeholder */}
        {state === 'error' && (
          <div
            aria-hidden
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-hdp-bg text-muted-foreground"
          >
            <ImageIcon className="h-7 w-7 opacity-50" />
            <p className="font-malayalam text-[10px]">ചിത്രം ലഭ്യമല്ല</p>
          </div>
        )}

        <img
          src={src ?? ''}
          alt={img.description || 'Project image'}
          onLoad={() => setState('ready')}
          onError={() => setState('error')}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${state === 'ready' ? 'opacity-100' : 'opacity-0'
            }`}
          loading="lazy"
          decoding="async"
        />

        {/* Hover overlay (only when image is actually loaded) */}
        {state === 'ready' && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-hdp-green shadow">
              <Expand className="h-3.5 w-3.5" />
              <span className="font-malayalam">വലുതാക്കുക</span>
            </span>
          </span>
        )}
      </button>

      {/* Caption — only render when a non-empty caption exists */}
      {img.description && img.description.trim() !== '' && (
        <figcaption className="border-t bg-white px-3 py-2">
          <p className="font-malayalam line-clamp-2 text-xs text-muted-foreground">
            {img.description}
          </p>
        </figcaption>
      )}
    </figure>
  );
}

function VideoThumb({ video }: { video: PublicProjectVideo }) {
  const [playing, setPlaying] = useState(false);
  const isYouTube = /youtube|youtu\.be/i.test(video.embedSrc ?? '');
  const ytId = isYouTube ? extractYouTubeId(video.embedSrc) : null;
  const thumbUrl = ytId
    ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
    : null;

  return (
    <figure className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="relative aspect-video bg-black">
        {isYouTube ? (
          playing ? (
            // Only mount the iframe after the user clicks play — saves
            // bandwidth + avoids autoplay surprises.
            <iframe
              src={`${video.embedSrc}${video.embedSrc.includes('?') ? '&' : '?'
                }autoplay=1`}
              title={video.description || 'Project video'}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              loading="lazy"
              allowFullScreen
            />
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              aria-label={video.description || 'Play video'}
              className="group absolute inset-0 cursor-pointer"
            >
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover opacity-90 transition-opacity duration-200 group-hover:opacity-100"
                  loading="lazy"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-black via-[#161616] to-[#1f1f1f]" />
              )}
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-hdp-green shadow-lg transition-transform duration-200 group-hover:scale-110">
                  <PlayCircle className="h-8 w-8" />
                </span>
              </span>
            </button>
          )
        ) : (
          <FacebookVideoEmbed
            sourceUrl={video.embedSrc}
            title={video.description || 'Facebook project video'}
          />
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t bg-white p-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${isYouTube ? 'bg-[#FF0000]' : 'bg-[#1877F2]'
            }`}
        >
          {isYouTube ? (
            <Youtube className="h-3 w-3" />
          ) : (
            <Facebook className="h-3 w-3" />
          )}
          {isYouTube ? 'YouTube' : 'Facebook'}
        </span>
        {video.description && (
          <span className="font-malayalam line-clamp-1 text-[11px] text-muted-foreground">
            {video.description}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

// ===========================================================================
// LIGHTBOX — ShadCN Dialog, scoped to one indicator group
// ===========================================================================
function Lightbox({
  open,
  group,
  index,
  onClose,
  onNavigate,
}: {
  open: boolean;
  group: IndicatorMediaGroup | null;
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const total = group?.images.length ?? 0;
  const safeIndex = Math.max(0, Math.min(total - 1, index));
  const img = group?.images[safeIndex] ?? null;

  // Keyboard nav: ← / → cycles within the group. Escape is handled by
  // the Dialog primitive itself.
  useEffect(() => {
    if (!open || !group) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onNavigate(safeIndex > 0 ? safeIndex - 1 : total - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onNavigate(safeIndex < total - 1 ? safeIndex + 1 : 0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, group, safeIndex, total, onNavigate]);

  if (!group || !img) return null;

  const src = imageSrc(img.imagePath);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-h-[95vh] max-w-5xl gap-0 overflow-hidden border-0 bg-black p-0 text-white"
      // The Dialog primitive supplies its own close button; this lightbox
      // adds clearer navigation controls below.
      >
        {/* Header — indicator name + position */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">
              <span className="font-malayalam">ഇൻഡിക്കേറ്റർ</span>
            </p>
            <p className="font-malayalam line-clamp-1 text-sm font-semibold">
              {group.indicatorName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white/70">
              {safeIndex + 1} / {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer rounded-full p-1.5 text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative flex flex-1 items-center justify-center bg-black px-2 py-4 sm:px-6 sm:py-6">
          <LightboxImage
            key={img.galleryId}
            src={src}
            alt={img.description || 'Project image'}
          />

          {/* Prev / Next */}
          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  onNavigate(safeIndex > 0 ? safeIndex - 1 : total - 1)
                }
                aria-label="Previous image"
                className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/25"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onNavigate(safeIndex < total - 1 ? safeIndex + 1 : 0)
                }
                aria-label="Next image"
                className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-white/10 p-2 text-white backdrop-blur transition-colors duration-150 hover:bg-white/25"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        {/* Caption */}
        {img.description && img.description.trim() !== '' && (
          <div className="border-t border-white/10 px-4 py-3">
            <p className="font-malayalam text-sm text-white/85">
              {img.description}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lightbox-internal image with skeleton + error fallback. Reset by `key`
 * when the user navigates between images so each new image re-renders its
 * loading state cleanly.
 */
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  return (
    <div className="relative flex max-h-[70vh] w-full items-center justify-center sm:max-h-[75vh]">
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-2 text-white/80">
          <ImageIcon className="h-9 w-9 opacity-60" />
          <p className="font-malayalam text-xs">ചിത്രം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല</p>
        </div>
      )}
      <img
        src={src ?? ''}
        alt={alt}
        onLoad={() => setState('ready')}
        onError={() => setState('error')}
        className={`max-h-[70vh] max-w-full rounded-lg object-contain shadow-2xl transition-opacity duration-300 sm:max-h-[75vh] ${state === 'ready' ? 'opacity-100' : 'opacity-0'
          }`}
        decoding="async"
      />
    </div>
  );
}

// --- Helpers ---------------------------------------------------------------
function imageSrc(path: string) {
  if (!path) return '';
  return path.startsWith('http') ? path : `/api/uploads/${path}`;
}

/** Extract a YouTube video id from any reasonable URL shape. */
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) ||
    url.match(/embed\/([A-Za-z0-9_-]{11})/) ||
    url.match(/shorts\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ===========================================================================
// shared
// ===========================================================================
function Breadcrumbs({
  primarySecId,
  primarySecPublicId,
  deptName,
  projectName,
}: {
  primarySecId: number | null;
  primarySecPublicId?: string | null;
  deptName: string;
  projectName: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="font-malayalam inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 backdrop-blur"
    >
      <Link href="/" className="hover:text-white">
        ഹോം
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      {primarySecId ? (
        <>
          <Link
            href={`/public/departments/${primarySecPublicId ?? primarySecId}`}
            className="hover:text-white"
          >
            {deptName || 'വകുപ്പ്'}
          </Link>
          <ChevronRight className="h-3 w-3 opacity-50" />
        </>
      ) : (
        <>
          <span>വകുപ്പ്</span>
          <ChevronRight className="h-3 w-3 opacity-50" />
        </>
      )}
      <span className="line-clamp-1 max-w-[20ch] font-semibold text-white">
        {projectName}
      </span>
    </nav>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors duration-150 ${active
        ? 'bg-hdp-green text-white shadow'
        : 'text-muted-foreground hover:text-hdp-green'
        }`}
    >
      {children}
    </button>
  );
}

function HeroStat({
  value,
  labelMal,
  subMal,
  icon: Icon,
  verified = false,
}: {
  value: string;
  labelMal: string;
  subMal?: string;
  icon: typeof Layers;
  verified?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <Icon className="mx-auto h-3.5 w-3.5 text-hdp-gold" />
      <p className="mt-1 font-mono text-lg font-extrabold leading-none">
        {value}
      </p>
      <p className="font-malayalam mt-1 text-[10px] text-white/80">
        {labelMal}
        {subMal && <span className="block opacity-70">{subMal}</span>}
      </p>
      {verified ? (
        <div className="mt-1 flex justify-center">
          <VerifiedDataBadge />
        </div>
      ) : null}
    </div>
  );
}

function EmptyCard({
  titleMal,
  descMal,
}: {
  titleMal: string;
  descMal: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
      <CheckCircle2 className="mx-auto h-7 w-7 text-muted-foreground" />
      <p className="font-malayalam mt-3 text-sm font-semibold text-foreground">
        {titleMal}
      </p>
      <p className="font-malayalam mt-1 text-xs text-muted-foreground">
        {descMal}
      </p>
    </div>
  );
}
