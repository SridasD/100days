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
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  IndianRupee,
  ImageIcon,
  Images,
  Layers,
  ShieldCheck,
  Target,
  Video,
} from 'lucide-react';
import { PublicNav } from './PublicNav';
import { VerifiedDataBadge } from './VerifiedDataBadge';
import {
  ProjectGallery,
  type PublicProjectDocument,
  type PublicProjectImage,
  type PublicProjectVideo,
} from './ProjectGallery';

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
  /** null when the indicator has no financial target to measure against */
  financialPct: number | null;
  description: string;
  verified: boolean;
  imageCount: number;
  videoCount: number;
}

export type { PublicProjectImage, PublicProjectVideo, PublicProjectDocument };

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
  /** null when the project has no usable cost to measure achievement against */
  overallFinancialPct: number | null;
  indicators: PublicProjectIndicator[];
  images: PublicProjectImage[];
  videos: PublicProjectVideo[];
  documents: PublicProjectDocument[];
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

  // Deep-link support for `?tab=gallery` (e.g. from a media chip elsewhere
  // on the site). Read on mount rather than via useSearchParams so the
  // server-rendered HTML and first client render stay in sync — this page
  // starts on Indicators and flips right after mount if requested.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'gallery') setTab('gallery');
  }, []);

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

            <h1 className="font-malayalam mt-3 text-3xl font-bold leading-tight md:text-4xl">
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
                value={
                  project.overallFinancialPct === null
                    ? '—'
                    : `${project.overallFinancialPct}%`
                }
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
                ഗാലറി ({project.images.length + project.videos.length + project.documents.length})
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
          <ProjectGallery
            images={project.images}
            videos={project.videos}
            documents={project.documents}
          />
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
  const verifiedNote = (
    <div className="flex items-start gap-2 rounded-xl border border-[#2E7D32]/15 bg-[#2E7D32]/5 px-4 py-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#2E7D32]" />
      <p>
        Only verified indicators are shown here. The project may have more
        indicators overall.
      </p>
    </div>
  );

  if (indicators.length === 0) {
    return (
      <div className="space-y-4">
        {verifiedNote}
        <EmptyCard
          titleMal="സ്ഥിരീകരിച്ച പുരോഗതി ഡാറ്റ ലഭ്യമല്ല"
          descMal="Verified data not yet available"
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {verifiedNote}
      <ul className="grid gap-5 md:grid-cols-2">
        {indicators.map((ind, idx) => (
          <li key={ind.indicatorId}>
            <IndicatorCard ind={ind} index={idx + 1} />
          </li>
        ))}
      </ul>
    </div>
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
  pct: number | null;
  color: string;
  verified?: boolean;
}) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(100, pct));
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
        {pct === null ? '—' : `${clamped}%`}
      </p>
    </div>
  );
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
