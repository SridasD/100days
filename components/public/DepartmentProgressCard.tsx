'use client';

/**
 * Department progress row — horizontal layout that mirrors the 100days
 * reference design. Donut + status sit on the left, headline + chips at
 * the top, a 4-cell stats strip across the middle, and a wide horizontal
 * progress bar with a CTA button on the right.
 *
 * The card is always-on (no accordion). All numbers come from
 * /api/public/departments via the parent HomePage.
 */
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Images,
  IndianRupee,
  Layers,
  PawPrint,
  Video,
} from 'lucide-react';
import { VerifiedDataBadge } from './VerifiedDataBadge';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';

type Status = 'completed' | 'in-progress' | 'not-started';

const STATUS_META: Record<
  Status,
  { dot: string; chip: string; chipMal: string; ringColor: string }
> = {
  completed: {
    dot: 'bg-hdp-success',
    chip: 'bg-[#E8F5E9] text-[#1B5E20]',
    chipMal: 'പൂർത്തിയായി',
    ringColor: '#4CAF50',
  },
  'in-progress': {
    dot: 'bg-hdp-warning',
    chip: 'bg-[#FFF8E1] text-[#E65100]',
    chipMal: 'പുരോഗതിയിൽ',
    ringColor: '#FF8F00',
  },
  'not-started': {
    dot: 'bg-hdp-danger',
    chip: 'bg-[#FFEBEE] text-[#C62828]',
    chipMal: 'ആരംഭിച്ചിട്ടില്ല',
    ringColor: '#E53935',
  },
};

export interface DepartmentProgressCardProps {
  secId: number;
  departmentPublicId?: string;
  nameMal: string;
  projects: number;
  indicators: number;
  costInLakhs: number;
  /** 0-100, verifier-confirmed physical progress */
  physicalPct: number;
  /** 0-100, financial progress (achieved / target) */
  financialPct: number;
  status: Status;
  /** Kept for API compatibility; ignored — card always renders fully expanded */
  defaultOpen?: boolean;
  imageCount?: number;
  videoCount?: number;
}

export function DepartmentProgressCard({
  secId,
  departmentPublicId,
  nameMal,
  projects,
  indicators,
  costInLakhs,
  physicalPct,
  financialPct,
  status,
  imageCount = 0,
  videoCount = 0,
}: DepartmentProgressCardProps) {
  const tone = STATUS_META[status];
  const overallPct = Math.round((physicalPct + financialPct) / 2);
  const indicatorsCompleted = Math.round((physicalPct / 100) * indicators);

  return (
    <article className="overflow-hidden rounded-2xl border border-l-4 border-l-hdp-warning bg-white shadow-sm transition-shadow duration-200 hover:shadow-lg">
      {/* ============== TOP STRIP — name + chips ============== */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-hdp-bg/40 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-hdp-green/10 text-hdp-green">
            <PawPrint className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="font-malayalam truncate text-base font-bold text-foreground">
            {nameMal}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip>
            <Layers className="h-3 w-3" />
            <span className="font-mono font-semibold">{indicators}</span>
            <span className="font-malayalam">ഘടകങ്ങൾ</span>
          </Chip>
          <Chip>
            <ClipboardList className="h-3 w-3" />
            <span className="font-mono font-semibold">{projects}</span>
            <span className="font-malayalam">പദ്ധതി</span>
          </Chip>
          {imageCount > 0 && (
            <Chip>
              <Images className="h-3 w-3" />
              <span className="font-mono font-semibold">{imageCount}</span>
              <span className="font-malayalam">ചിത്രങ്ങൾ</span>
              <VerifiedDataBadge />
            </Chip>
          )}
          {videoCount > 0 && (
            <Chip>
              <Video className="h-3 w-3" />
              <span className="font-mono font-semibold">{videoCount}</span>
              <span className="font-malayalam">വീഡിയോകൾ</span>
              <VerifiedDataBadge />
            </Chip>
          )}
          {imageCount === 0 && videoCount === 0 && (
            <span className="font-malayalam rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">
              Verified data not yet available
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            <span className="font-malayalam">{tone.chipMal}</span>
          </span>
        </div>
      </header>

      {/* ============== MAIN ROW — donut + stats + CTA ============== */}
      <div className="grid gap-5 px-5 py-5 md:grid-cols-[160px_1fr_auto] md:items-center">
        {/* DONUT */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative h-28 w-28">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="78%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                data={[
                  { name: 'pct', value: overallPct, fill: tone.ringColor },
                ]}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: '#F1F5F9' }}
                  cornerRadius={20}
                  dataKey="value"
                  fill={tone.ringColor}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-xl font-extrabold text-foreground">
                {overallPct}%
              </span>
              <span className="font-malayalam mt-0.5 text-[9px] uppercase text-muted-foreground">
                മൊത്തം പുരോഗതി
              </span>
            </div>
          </div>
          <span className="font-malayalam text-[10px] text-muted-foreground">
            ഭൗതിക പുരോഗതി
          </span>
        </div>

        {/* MIDDLE — 4 stat cells + progress strip */}
        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCell
              labelMal="പദ്ധതികൾ"
              value={projects.toLocaleString('en-IN')}
            />
            <StatCell
              labelMal="പൂർത്തിയായ പദ്ധതികൾ"
              value={status === 'completed' ? projects.toString() : '0'}
            />
            <StatCell
              labelMal="ആകെ തുക"
              subMal="ലക്ഷം രൂപ"
              value={
                <>
                  <IndianRupee className="-mt-0.5 inline h-3.5 w-3.5" />{' '}
                  {costInLakhs.toLocaleString('en-IN')}
                </>
              }
              tone="info"
            />
          </div>

          {/* progress strip */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-malayalam flex items-center gap-2 text-muted-foreground">
                <span>പുരോഗതി രേഖ</span>
                <VerifiedDataBadge />
                <span className="opacity-50">·</span>
                <span className="font-mono font-semibold text-foreground">
                  {indicators}
                </span>{' '}
                <span>ഘടകങ്ങൾ</span>
              </span>
              <span className="font-mono text-[11px] font-semibold text-foreground">
                {indicatorsCompleted}{' '}
                <span className="font-malayalam font-medium text-muted-foreground">
                  പൂർത്തിയായി
                </span>
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
              {/* completed (verified) */}
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-hdp-success transition-all duration-700"
                style={{ width: `${Math.max(0, Math.min(100, physicalPct))}%` }}
              />
              {/* financial overlay shown as a thinner top stripe */}
              <div
                className="absolute inset-x-0 top-0 h-0.5 bg-kerala-blue/70 transition-all duration-700"
                style={{
                  width: `${Math.max(0, Math.min(100, financialPct))}%`,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-hdp-success" />
                <span className="font-malayalam">ഭൗതിക</span>
                <span className="font-mono font-semibold">{physicalPct}%</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-kerala-blue" />
                <span className="font-malayalam">സാമ്പത്തിക</span>
                <span className="font-mono font-semibold">{financialPct}%</span>
              </span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="md:ml-2">
          <Link
            href={`/public/departments/${departmentPublicId ?? secId}`}
            className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-hdp-green px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-hdp-green-active hover:shadow-md md:w-auto"
          >
            <span className="font-malayalam">വകുപ്പ് വിശദമായി കാണുക</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>

    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
      {children}
    </span>
  );
}

function StatCell({
  labelMal,
  value,
  subMal,
  tone = 'muted',
}: {
  labelMal: string;
  value: React.ReactNode;
  subMal?: string;
  tone?: 'muted' | 'info';
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 ${tone === 'info'
        ? 'border-kerala-blue/20 bg-kerala-blue/5'
        : 'border-border bg-white'
        }`}
    >
      <p className="font-malayalam text-[10px] text-muted-foreground">
        {labelMal}
      </p>
      <p className="mt-0.5 font-mono text-base font-bold leading-none text-foreground">
        {value}
      </p>
      {subMal && (
        <p className="font-malayalam mt-0.5 text-[9px] text-muted-foreground/80">
          {subMal}
        </p>
      )}
    </div>
  );
}
