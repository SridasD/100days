'use client';

/**
 * Sector grid driven by hdp.master_sector. On mount the grid hits
 * /api/public/sectors and maps each row to a card. The DB row carries the
 * English sector name and the image filename (`sector_img_path`); this file
 * decorates known sector_ids with a Malayalam label + Lucide icon. Unknown
 * sectors still render with the English name + a generic icon.
 *
 * Clicking a card navigates to /public/sectors/[sectorId] where the
 * department list for that sector is rendered.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  Building,
  Building2,
  Cpu,
  Droplets,
  GraduationCap,
  HandHeart,
  Hospital,
  Landmark,
  Leaf,
  Loader2,
  Sun,
  Train,
} from 'lucide-react';

type Status = 'completed' | 'in-progress' | 'not-started';

interface ApiSector {
  sectorId: number;
  sectorName: string;
  imagePath: string | null;
  projects: number;
  indicators: number;
  status: Status;
}

interface SectorMeta {
  nameMal: string;
  icon: typeof Sun;
}

const SECTOR_META: Record<number, SectorMeta> = {
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

const STATUS_LABELS_MAL: Record<Status, string> = {
  completed: 'പൂർത്തിയായി',
  'in-progress': 'പുരോഗതിയിൽ',
  'not-started': 'ആരംഭിക്കാൻ',
};

const STATUS_BADGE_TONE: Record<Status, string> = {
  completed: 'bg-hdp-success/90 text-white',
  'in-progress': 'bg-hdp-warning/90 text-white',
  'not-started': 'bg-hdp-danger/90 text-white',
};

export function SectorGrid() {
  const [sectors, setSectors] = useState<ApiSector[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/sectors', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ sectors: ApiSector[] }>;
      })
      .then((j) => {
        if (!cancelled) setSectors(j.sectors);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load sectors');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="bg-hdp-bg py-14">
      <div className="container mx-auto px-4">
        <SectionHeader
          eyebrowMal="മേഖലാ പുരോഗതി"
          titleMal="വിവിധ മേഖലകളിലെ പദ്ധതികൾ"
        />

        {sectors === null && !error && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-malayalam">മേഖലകൾ ലോഡുചെയ്യുന്നു...</span>
          </div>
        )}
        {error && (
          <div className="mt-10 rounded-2xl border border-error-red/30 bg-error-red/5 p-5 text-center text-xs text-error-red">
            {error}
          </div>
        )}

        {sectors && sectors.length > 0 && (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sectors.map((s) => (
              <li key={s.sectorId}>
                <SectorCard sector={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SectorCard({ sector }: { sector: ApiSector }) {
  const meta = SECTOR_META[sector.sectorId];
  const Icon = meta?.icon ?? Building2;
  const displayName = meta?.nameMal ?? sector.sectorName;
  const fallbackSrc = '/images/hero-puduyuga-kerala.png';

  return (
    <Link
      href={`/public/sectors/${sector.sectorId}`}
      className="group relative block h-44 overflow-hidden rounded-2xl shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
    >
      <img
        src={sector.imagePath ?? fallbackSrc}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        loading="lazy"
        onError={(e) => {
          const img = e.currentTarget;
          if (img.src.indexOf(fallbackSrc) === -1) img.src = fallbackSrc;
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15"
      />

      <span
        className={`absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold backdrop-blur ${STATUS_BADGE_TONE[sector.status]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white" />
        <span className="font-malayalam">
          {STATUS_LABELS_MAL[sector.status]}
        </span>
      </span>

      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p
              className={`${meta ? 'font-malayalam' : ''} line-clamp-2 text-base font-bold leading-tight`}
            >
              {displayName}
            </p>
            <p className="mt-1 text-[11px] text-white/85">
              <span className="font-mono font-semibold">{sector.projects}</span>{' '}
              <span className="font-malayalam">പദ്ധതി</span>{' '}
              <span className="opacity-50">·</span>{' '}
              <span className="font-mono font-semibold">
                {sector.indicators}
              </span>{' '}
              <span className="font-malayalam">ഘടകങ്ങൾ</span>
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function SectionHeader({
  eyebrowMal,
  titleMal,
}: {
  eyebrowMal: string;
  titleMal: string;
}) {
  return (
    <div className="mb-2">
      <p className="font-malayalam text-xs font-semibold uppercase tracking-wide text-hdp-green">
        {eyebrowMal}
      </p>
      <h2 className="font-malayalam mt-1 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
        {titleMal}
      </h2>
    </div>
  );
}
