'use client';

/**
 * Public department detail page — green hero, 4-stat box, search + filter
 * pill bar, and a grid of project cards with status-coded left borders.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  IndianRupee,
  Images,
  Layers,
  Search,
  Trophy,
  Video,
} from 'lucide-react';
import { PublicNav } from './PublicNav';
import { VerifiedDataBadge } from './VerifiedDataBadge';

type Status = 'completed' | 'in-progress' | 'not-started';

const STATUS_META: Record<
  Status,
  {
    chip: string;
    border: string;
    bg: string;
    indexBg: string;
    chipMal: string;
  }
> = {
  completed: {
    chip: 'bg-[#E8F5E9] text-[#1B5E20]',
    border: 'border-l-hdp-success',
    bg: 'bg-[#E8F5E9]/30',
    indexBg: 'bg-[#E8F5E9] text-[#1B5E20]',
    chipMal: 'പൂർത്തിയായി',
  },
  'in-progress': {
    chip: 'bg-[#FFF8E1] text-[#E65100]',
    border: 'border-l-hdp-warning',
    bg: 'bg-[#FFF8E1]/30',
    indexBg: 'bg-[#FFF8E1] text-[#E65100]',
    chipMal: 'പുരോഗതിയിൽ',
  },
  'not-started': {
    chip: 'bg-[#FFEBEE] text-[#C62828]',
    border: 'border-l-hdp-danger',
    bg: 'bg-[#FFEBEE]/30',
    indexBg: 'bg-[#FFEBEE] text-[#C62828]',
    chipMal: 'ആരംഭിച്ചിട്ടില്ല',
  },
};

export interface DepartmentProject {
  projectId: number;
  projectPublicId?: string;
  /** Project name as shown — usually Malayalam */
  name: string;
  costInLakhs: number;
  indicatorsTotal: number;
  indicatorsCompleted: number;
  imageCount: number;
  videoCount: number;
  physicalPct: number;
  financialPct: number;
  verified: boolean;
  status: Status;
}

export interface DepartmentPageProps {
  secId: number;
  departmentPublicId?: string;
  nameMal: string;
  stats: {
    projects: number;
    completed: number;
    indicators: number;
    media: number;
  };
  projects: DepartmentProject[];
}

type Filter = 'all' | Status;

const FILTER_LABELS_MAL: Record<Filter, string> = {
  all: 'എല്ലാം',
  completed: 'പൂർത്തിയായി',
  'in-progress': 'പുരോഗതിയിൽ',
  'not-started': 'ആരംഭിച്ചിട്ടില്ല',
};

export function DepartmentPage({
  secId,
  departmentPublicId,
  nameMal,
  stats,
  projects,
}: DepartmentPageProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (filter !== 'all' && p.status !== filter) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, query, filter]);

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
              nameMal={nameMal}
              departmentRef={departmentPublicId ?? secId}
            />
            <p className="font-malayalam mt-4 text-xs font-semibold uppercase tracking-wide text-hdp-gold">
              വകുപ്പുതല ഡാഷ്ബോർഡ്
            </p>
            <h1 className="font-malayalam mt-2 text-3xl font-bold leading-tight md:text-4xl">
              {nameMal}
            </h1>
            <p className="font-malayalam mt-3 max-w-xl text-sm leading-relaxed text-white/80">
              പദ്ധതികളുടെ ഭൗതികവും സാമ്പത്തികവുമായ പുരോഗതി, ഘടകങ്ങൾ എന്നിവ
            </p>
          </div>

          {/* 4-stat box */}
          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="grid grid-cols-4 gap-2 text-center">
              <HeroStat
                value={stats.projects}
                labelMal="പദ്ധതികൾ"
                icon={ClipboardList}
              />
              <HeroStat
                value={stats.completed}
                labelMal="പൂർത്തിയായി"
                icon={Trophy}
              />
              <HeroStat
                value={stats.indicators}
                labelMal="ഘടകങ്ങൾ"
                icon={Layers}
              />
              <HeroStat
                value={stats.media}
                labelMal="വീഡിയോകൾ"
                icon={Video}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FILTER + SEARCH */}
      <section className="border-b bg-white">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-malayalam text-xl font-bold text-foreground">
              വകുപ്പിലെ പദ്ധതികൾ
            </h2>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="പദ്ധതി തിരയുക"
                className="font-malayalam h-10 w-full min-w-[260px] rounded-full border border-input bg-white pl-9 pr-4 text-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hdp-green md:w-auto"
              />
            </div>

            <div
              role="tablist"
              aria-label="Project filter"
              className="inline-flex rounded-full border bg-white p-0.5 text-xs"
            >
              {(['all', 'completed', 'in-progress', 'not-started'] as Filter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={`cursor-pointer rounded-full px-3 py-1.5 font-medium transition-colors duration-150 ${filter === f
                      ? 'bg-hdp-green text-white shadow'
                      : 'text-muted-foreground hover:text-hdp-green'
                      }`}
                  >
                    <span className="font-malayalam">
                      {FILTER_LABELS_MAL[f]}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* PROJECT CARDS */}
      <main className="container mx-auto flex-1 px-4 py-10">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
            <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="font-malayalam mt-3 text-sm font-semibold text-foreground">
              ഈ വിഭാഗത്തിൽ പദ്ധതികൾ കണ്ടെത്തിയില്ല
            </p>
            <p className="font-malayalam mt-1 text-xs text-muted-foreground">
              തിരയൽ വാക്കോ ഫിൽറ്ററോ മാറ്റി ശ്രമിക്കുക.
            </p>
          </div>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {filtered.map((p, idx) => (
              <li key={p.projectId}>
                <ProjectCard project={p} index={idx + 1} secId={secId} departmentPublicId={departmentPublicId} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------
function ProjectCard({
  project,
  index,
  secId,
  departmentPublicId,
}: {
  project: DepartmentProject;
  index: number;
  secId: number;
  departmentPublicId?: string;
}) {
  const tone = STATUS_META[project.status];
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${tone.border}`}
    >
      {/* HEAD */}
      <div className="flex items-start justify-between gap-3 p-5">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl font-mono text-sm font-bold ${tone.indexBg}`}
        >
          {String(index).padStart(2, '0')}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
          <span className="font-malayalam">{tone.chipMal}</span>
        </span>
      </div>

      <h3
        title={project.name}
        className="font-malayalam line-clamp-2 px-5 text-base font-bold leading-snug text-foreground"
      >
        {project.name}
      </h3>

      {/* indicator + media chip row */}
      <div className="mt-3 flex flex-wrap items-center gap-2 px-5">
        <Chip>
          <Layers className="h-3 w-3" />
          <span className="font-mono font-semibold">
            {project.indicatorsTotal}
          </span>
          <span className="font-malayalam">ഘടകങ്ങൾ</span>
        </Chip>
        {project.indicatorsCompleted > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5E9] px-2 py-0.5 text-[10px] text-[#1B5E20]">
            <CheckCircle2 className="h-3 w-3" />
            <span className="font-mono font-semibold">
              {project.indicatorsCompleted}
            </span>
            <span className="font-malayalam">ഘടകം</span>
          </span>
        )}
        {project.imageCount > 0 && (
          <Chip>
            <Images className="h-3 w-3" />
            <span className="font-mono font-semibold">
              {project.imageCount}
            </span>
            <span className="font-malayalam">ചിത്രങ്ങൾ</span>
            <VerifiedDataBadge />
          </Chip>
        )}
        {project.videoCount > 0 && (
          <Chip>
            <Video className="h-3 w-3" />
            <span className="font-mono font-semibold">
              {project.videoCount}
            </span>
            <span className="font-malayalam">വീഡിയോകൾ</span>
            <VerifiedDataBadge />
          </Chip>
        )}
        {project.imageCount === 0 && project.videoCount === 0 && (
          <span className="font-malayalam rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
            Verified data not yet available
          </span>
        )}
      </div>

      {/* STATS */}
      <div className="mt-4 grid grid-cols-3 gap-2 px-5">
        <StatCell
          icon={IndianRupee}
          value={project.costInLakhs.toLocaleString('en-IN')}
          labelMal="ആകെ തുക"
          subMal="ലക്ഷം രൂപ"
        />
        <StatCell
          icon={Layers}
          value={String(project.indicatorsTotal)}
          labelMal="പദ്ധതിഘടകങ്ങൾ"
        />
        <StatCell
          icon={CheckCircle2}
          value={String(project.indicatorsCompleted)}
          labelMal="പൂർത്തിയായ ഘടകങ്ങൾ"
        />
      </div>

      {/* PROGRESS */}
      <div className={`mt-4 space-y-2.5 ${tone.bg} px-5 py-4`}>
        <div className="flex items-center justify-between">
          <p className="font-malayalam text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            പദ്ധതിപുരോഗതി
          </p>
          {project.verified && (
            <span className="font-malayalam rounded-full bg-hdp-success/15 px-2 py-0.5 text-[10px] text-hdp-success">
              സ്ഥിരീകരിച്ചത്
            </span>
          )}
        </div>
        {project.verified ? (
          <>
            <Bar
              labelMal="ഭൗതിക പുരോഗതി"
              pct={project.physicalPct}
              color="bg-kerala-blue"
            />
            <Bar
              labelMal="സാമ്പത്തിക പുരോഗതി"
              pct={project.financialPct}
              color="bg-hdp-success"
            />
          </>
        ) : (
          <p className="font-malayalam rounded-lg border border-dashed border-border bg-white/70 px-3 py-2 text-xs text-muted-foreground">
            Verified data not yet available
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="mt-auto px-5 py-4">
        <Link
          href={`/public/departments/${departmentPublicId ?? secId}/projects/${project.projectPublicId ?? project.projectId}`}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-hdp-green px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-hdp-green-active"
        >
          <span className="font-malayalam">ഘടകങ്ങൾ വിശദമായി കാണുക</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}

function StatCell({
  icon: Icon,
  value,
  labelMal,
  subMal,
}: {
  icon: typeof IndianRupee;
  value: string;
  labelMal: string;
  subMal?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-2.5 text-center">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hdp-green/10 text-hdp-green">
        <Icon className="h-3 w-3" aria-hidden />
      </span>
      <p className="mt-1 font-mono text-base font-bold leading-none text-foreground">
        {value}
      </p>
      <p className="font-malayalam mt-1 text-[10px] leading-tight text-muted-foreground">
        {labelMal}
        {subMal && <span className="block opacity-70">{subMal}</span>}
      </p>
    </div>
  );
}

function Bar({
  labelMal,
  pct,
  color,
}: {
  labelMal: string;
  pct: number;
  color: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-malayalam text-muted-foreground">{labelMal}</span>
        <VerifiedDataBadge />
        <span className="font-mono font-semibold text-foreground">
          {clamped}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function HeroStat({
  value,
  labelMal,
  icon: Icon,
}: {
  value: number;
  labelMal: string;
  icon: typeof ClipboardList;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <Icon className="mx-auto h-3.5 w-3.5 text-hdp-gold" aria-hidden />
      <p className="mt-1 font-mono text-2xl font-extrabold leading-none">
        {value}
      </p>
      <p className="font-malayalam mt-1 text-[10px] text-white/80">
        {labelMal}
      </p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
      {children}
    </span>
  );
}

function Breadcrumbs({
  nameMal,
  departmentRef,
}: {
  nameMal: string;
  departmentRef: string | number;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="font-malayalam inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 backdrop-blur"
    >
      <Link href="/" className="hover:text-white">
        ഹോം
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <Link
        href={`/public/departments/${departmentRef}`}
        className="hover:text-white"
      >
        വകുപ്പുകൾ
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <span className="font-semibold text-white">{nameMal}</span>
    </nav>
  );
}
