'use client';

/**
 * Public sector detail page. Lists every department under the sector
 * using the same DepartmentProgressCard component the homepage uses, so
 * the visual language stays consistent.
 *
 * Route: /public/sectors/[sectorId]
 * Data:  GET /api/public/sector/[sectorId]/departments
 */
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronRight,
  Loader2,
  Banknote,
  Building,
  Cpu,
  Droplets,
  GraduationCap,
  HandHeart,
  Hospital,
  Landmark,
  Leaf,
  Sun,
  Train,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DepartmentProgressCard } from '@/components/public/DepartmentProgressCard';
import { PublicNav } from '@/components/public/PublicNav';

type Status = 'completed' | 'in-progress' | 'not-started';

interface ApiDepartment {
  secId: number;
  nameMal: string;
  projects: number;
  indicators: number;
  costInLakhs: number;
  physicalPct: number;
  financialPct: number;
  status: Status;
  imageCount: number;
  videoCount: number;
}

interface ApiSector {
  sectorId: number;
  sectorName: string;
  imagePath: string | null;
  projects: number;
  indicators: number;
  status: Status;
}

// Same Malayalam-name + icon mapping the SectorGrid uses, kept here so the
// page works even if SectorGrid was not loaded yet.
const SECTOR_META: Record<number, { nameMal: string; icon: typeof Sun }> = {
  1: { nameMal: 'കൃഷി അനുബന്ധ മേഖല', icon: Leaf },
  3: { nameMal: 'സഹകരണ മേഖല', icon: HandHeart },
  4: { nameMal: 'ജലവിഭവ - ജലസേചനം', icon: Droplets },
  5: { nameMal: 'ഊർജ്ജ മേഖല', icon: Sun },
  6: { nameMal: 'വ്യവസായ സംരംഭക മേഖല', icon: Cpu },
  7: { nameMal: 'ഗതാഗതം - പൊതുമേഖല', icon: Train },
  8: { nameMal: 'ശാസ്ത്രസാങ്കേതിക ഗവേഷണ മേഖല', icon: GraduationCap },
  9: { nameMal: 'സാമൂഹിക സേവന മേഖല', icon: Hospital },
  10: { nameMal: 'സാമ്പത്തിക സേവന മേഖല', icon: Banknote },
  11: { nameMal: 'പൊതുസേവന മേഖല', icon: Landmark },
  12: { nameMal: 'തദ്ദേശസ്വയംഭരണം', icon: Building },
};

const STATUS_LABEL_MAL: Record<Status, string> = {
  completed: 'പൂർത്തിയായി',
  'in-progress': 'പുരോഗതിയിൽ',
  'not-started': 'ആരംഭിക്കാൻ',
};

const STATUS_PILL: Record<Status, string> = {
  completed: 'bg-[#E8F5E9] text-[#1B5E20]',
  'in-progress': 'bg-[#FFF8E1] text-[#E65100]',
  'not-started': 'bg-[#FFEBEE] text-[#C62828]',
};

export default function PublicSectorPage({
  params,
}: {
  params: Promise<{ sectorId: string }>;
}) {
  const { sectorId } = use(params);
  const id = Number(sectorId);

  const [sector, setSector] = useState<ApiSector | null>(null);
  const [departments, setDepartments] = useState<ApiDepartment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('Invalid sector id');
      return;
    }
    let cancelled = false;

    // Fetch sectors + this sector's departments in parallel. Sectors comes
    // back as a list so we pluck the matching one for headline data.
    Promise.allSettled([
      fetch('/api/public/sectors', { cache: 'no-store' }).then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
      fetch(`/api/public/sector/${id}/departments`, { cache: 'no-store' }).then(
        (r) =>
          r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)),
      ),
    ]).then(([sectorsR, depsR]) => {
      if (cancelled) return;
      if (sectorsR.status === 'fulfilled') {
        const list = (sectorsR.value as { sectors: ApiSector[] }).sectors ?? [];
        const found = list.find((s) => s.sectorId === id) ?? null;
        setSector(found);
      }
      if (depsR.status === 'fulfilled') {
        setDepartments(
          (depsR.value as { departments: ApiDepartment[] }).departments ?? [],
        );
      } else {
        setError(
          (depsR.reason instanceof Error
            ? depsR.reason.message
            : 'Failed to load'),
        );
        setDepartments([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const meta = SECTOR_META[id];
  const Icon = meta?.icon ?? Building2;
  const nameMal = meta?.nameMal ?? sector?.sectorName ?? 'മേഖല';

  return (
    <div className="flex min-h-screen flex-col bg-hdp-bg">
      <PublicNav />

      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-hdp-green via-hdp-green to-hdp-green-active text-white">
        {sector?.imagePath && (
          <div
            aria-hidden
            className="absolute inset-0 -z-10 opacity-25"
            style={{
              backgroundImage: `url(${sector.imagePath})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_50%)]"
        />
        <div className="container relative mx-auto grid gap-6 px-4 py-12 md:grid-cols-[1.6fr_1fr]">
          <div>
            <Breadcrumbs nameMal={nameMal} />

            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Icon className="h-6 w-6 text-hdp-gold" />
              </span>
              <div>
                <p className="font-malayalam text-xs font-semibold uppercase tracking-wide text-hdp-gold">
                  മേഖലാ ഡാഷ്ബോർഡ്
                </p>
                <h1 className="font-malayalam text-3xl font-bold leading-tight md:text-4xl">
                  {nameMal}
                </h1>
              </div>
            </div>

            <p className="font-malayalam mt-3 max-w-xl text-sm leading-relaxed text-white/80">
              ഈ മേഖലയിലെ വകുപ്പുകൾ, പദ്ധതികൾ, പുരോഗതി എന്നിവ വിശദമായി കാണാം.
            </p>
          </div>

          {sector && (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <div className="grid grid-cols-3 gap-2 text-center">
                <HeroStat value={sector.projects} labelMal="പദ്ധതികൾ" />
                <HeroStat value={sector.indicators} labelMal="ഘടകങ്ങൾ" />
                <HeroStat
                  value={departments?.length ?? 0}
                  labelMal="വകുപ്പുകൾ"
                />
              </div>
              <div className="mt-3 flex justify-center">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold ${STATUS_PILL[sector.status]}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                  <span className="font-malayalam">
                    {STATUS_LABEL_MAL[sector.status]}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DEPARTMENTS LIST */}
      <main className="container mx-auto flex-1 px-4 py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-malayalam text-xs font-semibold uppercase tracking-wide text-hdp-green">
              വകുപ്പുതല വിശദാംശങ്ങൾ
            </p>
            <h2 className="font-malayalam text-2xl font-bold tracking-tight text-foreground">
              വകുപ്പുകൾ
            </h2>
          </div>
          {departments && departments.length > 0 && (
            <Badge variant="outline" className="bg-hdp-green/5 text-hdp-green">
              <span className="font-mono font-semibold">
                {departments.length}
              </span>
              <span className="font-malayalam ml-1">വകുപ്പ്</span>
            </Badge>
          )}
        </div>

        {/* Loading */}
        {departments === null && !error && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-error-red/30 bg-error-red/5 p-6 text-center text-sm text-error-red">
            <AlertTriangle className="mx-auto h-6 w-6" />
            <p className="mt-2">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!error && departments !== null && departments.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white p-12 text-center">
            <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="font-malayalam mt-3 text-sm font-semibold text-foreground">
              ഈ മേഖലയിൽ വകുപ്പുകൾ ഒന്നും ചേർത്തിട്ടില്ല
            </p>
            <p className="font-malayalam mt-1 text-xs text-muted-foreground">
              ഭരണപരമായ വകുപ്പുകൾ പദ്ധതികൾ ചേർക്കുമ്പോൾ ഇവിടെ കാണാം.
            </p>
          </div>
        )}

        {/* List */}
        {!error && departments && departments.length > 0 && (
          <div className="space-y-4">
            {departments.map((d) => (
              <DepartmentProgressCard key={d.secId} {...d} defaultOpen />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
function Breadcrumbs({ nameMal }: { nameMal: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="font-malayalam inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80 backdrop-blur"
    >
      <Link href="/" className="hover:text-white">
        മുഖപ്പ്
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <Link href="/" className="hover:text-white">
        മേഖലകൾ
      </Link>
      <ChevronRight className="h-3 w-3 opacity-50" />
      <span className="line-clamp-1 max-w-[24ch] font-semibold text-white">
        {nameMal}
      </span>
    </nav>
  );
}

function HeroStat({ value, labelMal }: { value: number; labelMal: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-2.5">
      <p className="font-mono text-xl font-extrabold leading-none">{value}</p>
      <p className="font-malayalam mt-1 text-[10px] text-white/80">
        {labelMal}
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b bg-hdp-bg/40 px-5 py-3">
        <div className="h-10 w-10 animate-pulse rounded-2xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-2 w-1/3 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
      <div className="grid gap-3 px-5 py-5 md:grid-cols-[160px_1fr_auto]">
        <div className="mx-auto h-28 w-28 animate-pulse rounded-full bg-muted" />
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-12 animate-pulse rounded-xl bg-muted/70"
              />
            ))}
          </div>
          <div className="h-2 w-full animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-9 w-36 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  );
}
