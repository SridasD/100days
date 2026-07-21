'use client';

/**
 * Public home page composition.
 *
 *   <PublicNav />
 *   <HeroSection />
 *   <StatsOverview />
 *   <ProjectStatusOverview />     ← two-up: counts | indicator bars
 *   <ProjectsByNature />          ← livelihood vs infrastructure
 *   <SectorGrid />
 *   <DepartmentProgress />        ← list of DepartmentProgressCard
 *   <SiteFooter />
 *
 * On mount we hit /api/public/dashboard and slot the live counts into the
 * hero stats + status overview. Phase boundaries are read from env vars
 * (NEXT_PUBLIC_HDP_PHASE_START / NEXT_PUBLIC_HDP_PHASE_END) so a new cycle
 * can roll over without a code change.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { HeroSection } from './HeroSection';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { PublicNav } from './PublicNav';
import { StatsOverview } from './StatsOverview';
import { SectorGrid } from './SectorGrid';
import { DepartmentProgressCard } from './DepartmentProgressCard';

// ---------------------------------------------------------------------------
// CONFIG — phase boundaries (override via NEXT_PUBLIC_HDP_PHASE_*)
// ---------------------------------------------------------------------------
const PHASE_START =
  process.env.NEXT_PUBLIC_PHASE_START ??
  process.env.NEXT_PUBLIC_HDP_PHASE_START ??
  '2026-07-01';
const PHASE_END =
  process.env.NEXT_PUBLIC_PHASE_END ??
  process.env.NEXT_PUBLIC_HDP_PHASE_END ??
  '2026-10-22';

// ---------------------------------------------------------------------------
// Shapes used by the three public endpoints we consume here
// ---------------------------------------------------------------------------
interface NatureSummary {
  livelihood: { total: number; completed: number };
  infrastructure: { total: number; completed: number };
}

interface ApiDepartment {
  secId: number;
  departmentPublicId: string;
  nameMal: string;
  projects: number;
  indicators: number;
  costInLakhs: number;
  physicalPct: number;
  financialPct: number;
  status: 'completed' | 'in-progress' | 'not-started';
  imageCount: number;
  videoCount: number;
}

interface DashboardStats {
  totalProjects: number;
  completedProjects: number;
  /** Authoritative server-side count of master_projects.is_completed = 1 */
  inProgressProjects: number;
  /** Authoritative count of NULL or 0 (legacy: "Not started") */
  notStartedProjects: number;
  totalIndicators: number;
  verifiedIndicators: number;
}

// ===========================================================================
// MAIN
// ===========================================================================
export function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [nature, setNature] = useState<NatureSummary | null>(null);
  const [departments, setDepartments] = useState<ApiDepartment[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Fire all three reads in parallel.
    Promise.allSettled([
      fetch('/api/public/dashboard', { cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch('/api/public/nature-summary', { cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch('/api/public/departments', { cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
    ]).then(([dashboardR, natureR, deptR]) => {
      if (cancelled) return;
      if (dashboardR.status === 'fulfilled') {
        setStats(dashboardR.value.stats as DashboardStats);
      }
      if (natureR.status === 'fulfilled') {
        setNature(natureR.value as NatureSummary);
      }
      if (deptR.status === 'fulfilled') {
        setDepartments(
          (deptR.value as { departments: ApiDepartment[] }).departments ?? [],
        );
      } else {
        setDepartments([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Total departments — derive from the live departments list when we have
  // it, falling back to the dashboard distinct-secretary heuristic.
  const depCount = departments?.length ?? 0;

  // Derive the values used by the hero + status sections from live stats,
  // falling back to 0 while the request is in flight. Project status counts
  // come straight from the server so that the three buckets always sum to
  // `totalProjects` even when `is_completed` has unexpected values.
  const totalProjects = stats?.totalProjects ?? 0;
  const completedProjects = stats?.completedProjects ?? 0;
  const inProgressProjects = stats?.inProgressProjects ?? 0;
  const notStartedProjects = stats?.notStartedProjects ?? 0;
  const totalIndicators = stats?.totalIndicators ?? 0;
  const verifiedIndicators = stats?.verifiedIndicators ?? 0;
  const inProgressIndicators = Math.max(
    0,
    totalIndicators - verifiedIndicators,
  );
  const projectCompletionPct =
    totalProjects > 0
      ? Math.round((completedProjects / totalProjects) * 100)
      : 0;
  const indicatorVerifiedPct =
    totalIndicators > 0
      ? Math.round((verifiedIndicators / totalIndicators) * 100)
      : 0;

  return (
    <div className="flex min-h-screen flex-col bg-hdp-bg">
      <PublicNav />

      <HeroSection
        phaseStart={PHASE_START}
        phaseEnd={PHASE_END}
        miniStats={[
          {
            label: 'ആകെ പദ്ധതികൾ',
            value: totalProjects,
            pct: projectCompletionPct,
          },
          {
            label: 'പൂർത്തിയായ ഘടകങ്ങൾ',
            value: verifiedIndicators,
            pct: indicatorVerifiedPct,
          },
        ]}
      />

      <StatsOverview
        totalDepartments={depCount}
        totalProjects={totalProjects}
        completedProjects={completedProjects}
        totalIndicators={totalIndicators}
      />

      <ProjectStatusOverview
        totalProjects={totalProjects}
        completedProjects={completedProjects}
        inProgressProjects={inProgressProjects}
        notStartedProjects={notStartedProjects}
        totalIndicators={totalIndicators}
        verifiedIndicators={verifiedIndicators}
        inProgressIndicators={inProgressIndicators}
      />

      <ProjectsByNature nature={nature} />

      <SectorGrid />

      <SiteFooter />
    </div>
  );
}

// ===========================================================================
// PROJECT STATUS OVERVIEW (counts + indicator progress)
// ===========================================================================
function ProjectStatusOverview({
  totalProjects,
  completedProjects,
  inProgressProjects,
  notStartedProjects,
  totalIndicators,
  verifiedIndicators,
  inProgressIndicators,
}: {
  totalProjects: number;
  completedProjects: number;
  inProgressProjects: number;
  notStartedProjects: number;
  totalIndicators: number;
  verifiedIndicators: number;
  inProgressIndicators: number;
}) {
  return (
    <section className="bg-white pb-14 pt-10">
      <div className="container mx-auto px-4">
        <SectionHeader
          eyebrowMal="പുരോഗതി അവലോകനം"
          titleMal="പദ്ധതികളുടെ നിലവിലെ ചിത്രം"
          rightAction={
            <span className="hidden items-center gap-2 text-xs text-muted-foreground md:inline-flex">
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="font-malayalam">വിവരങ്ങൾ തത്സമയം</span>
            </span>
          }
        />
        <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* LEFT — project counts as 3 colour-coded stat blocks */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-malayalam flex items-center gap-2 text-base font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-hdp-green/10 text-hdp-green">
                  <ClipboardList className="h-4 w-4" />
                </span>
                പദ്ധതികൾ
              </h3>
              <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-hdp-green/10 px-2.5 py-0.5 font-mono text-xs font-bold text-hdp-green">
                {totalProjects}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <StatusBlock
                tone="success"
                icon={CheckCircle2}
                labelMal="പൂർത്തിയായ"
                subMal="പദ്ധതികൾ"
                value={completedProjects}
              />
              <StatusBlock
                tone="warning"
                icon={Loader2}
                labelMal="പുരോഗതിയിലുള്ള"
                subMal="പദ്ധതികൾ"
                value={inProgressProjects}
              />
              <StatusBlock
                tone="danger"
                icon={AlertCircle}
                labelMal="ആരംഭിക്കാനുള്ള"
                subMal="പദ്ധതികൾ"
                value={notStartedProjects}
              />
            </div>
          </div>

          {/* RIGHT — indicator progress with violet bars */}
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-malayalam flex items-center gap-2 text-base font-bold text-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7C3AED]/10 text-[#7C3AED]">
                  <BarChart3 className="h-4 w-4" />
                </span>
                പദ്ധതിഘടകങ്ങൾ
              </h3>
              <span className="inline-flex min-w-9 items-center justify-center rounded-full bg-[#7C3AED]/10 px-2.5 py-0.5 font-mono text-xs font-bold text-[#7C3AED]">
                {totalIndicators}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              <BarRow
                labelMal="പൂർത്തിയായ ഘടകങ്ങൾ"
                value={verifiedIndicators}
                total={totalIndicators}
                color="bg-[#7C3AED]"
              />
              <BarRow
                labelMal="പുരോഗതിയിലുള്ള ഘടകങ്ങൾ"
                value={inProgressIndicators}
                total={totalIndicators}
                color="bg-[#A78BFA]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusBlock({
  tone,
  icon: Icon,
  labelMal,
  subMal,
  value,
}: {
  tone: 'success' | 'warning' | 'danger';
  icon: typeof CheckCircle2;
  labelMal: string;
  subMal: string;
  value: number;
}) {
  const meta = {
    success: {
      // light green
      bg: 'bg-[#E8F5E9]',
      border: 'border-[#C8E6C9]',
      text: 'text-[#1B5E20]',
      iconBg: 'bg-[#C8E6C9] text-[#1B5E20]',
    },
    warning: {
      bg: 'bg-[#FFF8E1]',
      border: 'border-[#FFE082]',
      text: 'text-[#E65100]',
      iconBg: 'bg-[#FFE082] text-[#E65100]',
    },
    danger: {
      bg: 'bg-[#FFEBEE]',
      border: 'border-[#FFCDD2]',
      text: 'text-[#C62828]',
      iconBg: 'bg-[#FFCDD2] text-[#C62828]',
    },
  }[tone];
  return (
    <div
      className={`rounded-xl border ${meta.border} ${meta.bg} p-3 text-center transition-transform duration-200 hover:-translate-y-0.5`}
    >
      <span
        className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full ${meta.iconBg}`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <p
        className={`mt-2 font-mono text-2xl font-extrabold leading-none ${meta.text}`}
      >
        {value}
      </p>
      <p className={`font-malayalam mt-1 text-[11px] font-semibold ${meta.text}`}>
        {labelMal}
      </p>
      <p
        className={`font-malayalam text-[10px] opacity-70 ${meta.text}`}
      >
        {subMal}
      </p>
    </div>
  );
}

function BarRow({
  labelMal,
  value,
  total,
  color,
}: {
  labelMal: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-malayalam text-foreground">{labelMal}</span>
        <span className="font-mono font-semibold text-muted-foreground">
          {value} / {total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// PROJECTS BY NATURE
// ===========================================================================
function ProjectsByNature({ nature }: { nature: NatureSummary | null }) {
  const livelihood = nature?.livelihood ?? { total: 0, completed: 0 };
  const infrastructure = nature?.infrastructure ?? { total: 0, completed: 0 };
  return (
    <section id="sectors-section" className="bg-hdp-bg py-14">
      <div className="container mx-auto px-4">
        <SectionHeader
          eyebrowMal=""
          titleMal="പദ്ധതികളുടെ സ്വഭാവം"
        />
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <NatureCard
            iconBg="bg-hdp-success/15 text-hdp-success"
            icon={Users}
            titleMal="ഉപജീവനമാർഗ്ഗ പദ്ധതികൾ"
            descMal="തൊഴിൽ, വരുമാനം"
            count={livelihood.total}
            completed={livelihood.completed}
            tone="success"
          />
          <NatureCard
            iconBg="bg-hdp-warning/15 text-hdp-warning"
            icon={Building2}
            titleMal="പശ്ചാത്തല വികസന പദ്ധതികൾ"
            descMal="കേരളത്തിന്റെ ഭാവിക്കായി ദീർഘമായ അടിസ്ഥാന സൗകര്യങ്ങൾ"
            count={infrastructure.total}
            completed={infrastructure.completed}
            tone="warning"
          />
        </div>
      </div>
    </section>
  );
}

function NatureCard({
  icon: Icon,
  iconBg,
  titleMal,
  descMal,
  count,
  completed,
  tone,
}: {
  icon: typeof Users;
  iconBg: string;
  titleMal: string;
  descMal: string;
  count: number;
  completed: number;
  tone: 'success' | 'warning';
}) {
  const completedTone =
    tone === 'success'
      ? 'bg-[#E8F5E9] text-[#1B5E20]'
      : 'bg-[#FFF8E1] text-[#E65100]';
  return (
    <article className="group flex items-stretch gap-4 rounded-2xl border bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <span
        className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl ${iconBg}`}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <p className="font-malayalam text-sm font-semibold text-foreground">
            {titleMal}
          </p>
          <p className="font-malayalam mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {descMal}
          </p>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-4xl font-extrabold leading-none text-foreground">
              {count}
            </p>
            <p className="font-malayalam mt-1 text-[11px] text-muted-foreground">
              പദ്ധതികൾ
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${completedTone}`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>
              {completed} <span className="font-malayalam">പൂർത്തിയായ</span>
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

// ===========================================================================
// DEPARTMENT PROGRESS
// ===========================================================================
function DepartmentProgress({
  departments,
}: {
  departments: ApiDepartment[] | null;
}) {
  return (
    <section className="bg-white py-14">
      <div className="container mx-auto px-4">
        <SectionHeader
          eyebrowMal="വകുപ്പുതല വിശദാംശങ്ങൾ"
          titleMal="വകുപ്പുകളുടെ പദ്ധതി പുരോഗതി"
          rightAction={
            <span className="hidden text-xs text-muted-foreground md:inline-flex">
              <span className="font-malayalam">
                പ്രതീ പദ്ധതിയും, അവൻ്റേ കീഴിലുള്ള ഘടകങ്ങൾ, വകുപ്പുവാർ ക്രമത്തിൽ
              </span>
            </span>
          }
        />

        {departments === null && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-malayalam">
              വകുപ്പുകൾ ലോഡുചെയ്യുന്നു…
            </span>
          </div>
        )}

        {departments !== null && departments.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed bg-hdp-bg p-10 text-center">
            <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="font-malayalam mt-3 text-sm font-semibold text-foreground">
              ഇതുവരെ ഒരു വകുപ്പിലും പദ്ധതികൾ ചേർത്തിട്ടില്ല
            </p>
            <p className="font-malayalam mt-1 text-xs text-muted-foreground">
              ഭരണപരമായ വകുപ്പ് പദ്ധതികൾ ചേർക്കുമ്പോൾ ഇവിടെ കാണാം.
            </p>
          </div>
        )}

        {departments !== null && departments.length > 0 && (
          <div className="mt-8 space-y-4">
            {departments.map((d, i) => (
              <DepartmentProgressCard
                key={d.secId}
                {...d}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ===========================================================================
// SHARED — section header
// ===========================================================================
function SectionHeader({
  eyebrowMal,
  titleMal,
  rightAction,
}: {
  eyebrowMal: string;
  titleMal: string;
  rightAction?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-2 md:flex-row md:items-end">
      <div>
        <p className="font-malayalam text-xs font-semibold uppercase tracking-wide text-hdp-green">
          {eyebrowMal}
        </p>
        <h2 className="font-malayalam mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {titleMal}
        </h2>
      </div>
      {rightAction}
    </div>
  );
}
