'use client';

/**
 * Department progress row — horizontal layout that mirrors the 100days
 * reference design. Donut + status sit on the left, headline + chips at
 * the top, a 4-cell stats strip across the middle, and a wide horizontal
 * progress bar with a CTA button on the right.
 *
 * The card is always-on (no accordion). Rendered by the public sector
 * page from /api/public/sector/[sectorId]/departments; every number is a
 * server-computed field (indicatorsCompleted = verified-complete count,
 * not an estimate).
 */
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Images,
  IndianRupee,
  Layers,
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
  /** Verified-complete indicators (verified_date set AND verified_percentage >= 100) */
  indicatorsCompleted: number;
  costInLakhs: number;
  /** 0-100, verifier-confirmed physical progress */
  physicalPct: number;
  /** 0-100, financial progress (achieved / project cost); null when no project has a recorded cost */
  financialPct: number | null;
  status: Status;
  /** Kept for API compatibility; ignored — card always renders fully expanded */
  defaultOpen?: boolean;
  imageCount?: number;
  videoCount?: number;
  documentCount?: number;
}

export function DepartmentProgressCard({
  secId,
  departmentPublicId,
  nameMal,
  projects,
  indicators,
  indicatorsCompleted,
  costInLakhs,
  physicalPct,
  financialPct,
  status,
  imageCount = 0,
  videoCount = 0,
  documentCount = 0,
}: DepartmentProgressCardProps) {
  const tone = STATUS_META[status];

  return (
    <article className="overflow-hidden rounded-3xl border border-border bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* HEADER */}
      <header className="border-b bg-gradient-to-r from-hdp-bg/80 via-white to-white px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-hdp-green/12 text-hdp-green">
            <ClipboardList className="h-4.5 w-4.5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-malayalam truncate text-[15px] font-bold leading-tight text-foreground">
                {nameMal}
              </h3>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {imageCount > 0 && (
                  <Chip>
                    <Images className="h-3 w-3" />
                    <span className="font-mono font-semibold">{imageCount}</span>
                    <span className="font-malayalam">ചിത്രങ്ങൾ</span>
                  </Chip>
                )}
                {videoCount > 0 && (
                  <Chip>
                    <Video className="h-3 w-3" />
                    <span className="font-mono font-semibold">{videoCount}</span>
                    <span className="font-malayalam">ഗാലറി</span>
                  </Chip>
                )}
                {documentCount > 0 && (
                  <Chip>
                    <FileText className="h-3 w-3" />
                    <span className="font-mono font-semibold">{documentCount}</span>
                    <span className="font-malayalam">രേഖകൾ</span>
                  </Chip>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${tone.chip}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
                  <span className="font-malayalam">{tone.chipMal}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[170px_1fr] lg:items-start">
        {/* DONUT */}
        <div className="flex flex-col items-center gap-2 rounded-2xl border bg-hdp-bg/30 px-4 py-5">
          <div className="relative h-32 w-32">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="78%"
                outerRadius="100%"
                startAngle={90}
                endAngle={-270}
                data={[
                  { name: 'pct', value: physicalPct, fill: tone.ringColor },
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
              <span className="font-mono text-2xl font-extrabold text-foreground">
                {physicalPct}%
              </span>
              <span className="font-malayalam mt-1 text-[10px] text-muted-foreground">
                ഭൗതിക പുരോഗതി
              </span>
            </div>
          </div>
          <p className="font-malayalam text-center text-[11px] leading-tight text-muted-foreground">
            സ്ഥിരീകരിച്ച ഭൗതിക നേട്ടം
          </p>
        </div>

        {/* SUMMARY */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-2xl border border-hdp-green/15 bg-gradient-to-br from-hdp-green/5 via-white to-hdp-green/10 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-malayalam text-[10px] font-semibold uppercase tracking-wide text-hdp-green/80">
                  പദ്ധതികളുടെ സംഗ്രഹം
                </p>
                <h4 className="font-malayalam mt-1 text-sm font-bold text-foreground">
                  വകുപ്പ് അടിസ്ഥാന പദ്ധതി നില
                </h4>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-hdp-green/12 text-hdp-green">
                <ClipboardList className="h-4 w-4" aria-hidden />
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
              <StatCell
                labelMal="പദ്ധതികൾ"
                value={projects.toLocaleString('en-IN')}
                emphasis="primary"
              />
              <StatCell
                labelMal="പൂർത്തിയായ പദ്ധതികൾ"
                value={status === 'completed' ? projects.toString() : '0'}
                emphasis="primary"
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
                emphasis="primary"
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-malayalam text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  പൂർത്തിയായ  ഘടകങ്ങൾ
                </p>
              </div>
              <VerifiedDataBadge className="shrink-0" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-kerala-blue/15 bg-kerala-blue/5 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-malayalam text-[10px] font-semibold uppercase tracking-wide text-kerala-blue/80">
                    രേഖപ്പെടുത്തിയ ഘടകങ്ങൾ
                  </p>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="font-mono text-3xl font-extrabold leading-none text-foreground">
                      {indicators}
                    </span>
                  </div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kerala-blue/10 text-kerala-blue">
                  <Layers className="h-4 w-4" aria-hidden />
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-hdp-success/15 bg-hdp-success/5 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-malayalam text-[10px] font-semibold uppercase tracking-wide text-hdp-success/80">
                    പൂർത്തിയായ  ഘടകങ്ങൾ
                  </p>
                  <div className="mt-1 flex items-end gap-2">
                    <span className="font-mono text-3xl font-extrabold leading-none text-foreground">
                      {indicatorsCompleted}
                    </span>
                  </div>
                </div>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hdp-success/15 text-hdp-success">
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-malayalam">സാമ്പത്തിക പുരോഗതി</span>
                <span className="font-mono font-semibold text-foreground">
                  {financialPct === null ? '—' : `${financialPct}%`}
                </span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-kerala-blue transition-all duration-700"
                  style={{
                    width: `${financialPct === null ? 0 : Math.max(0, Math.min(100, financialPct))}%`,
                  }}
                />
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-kerala-blue" />
                  <span className="font-malayalam">സാമ്പത്തിക പുരോഗതി</span>
                </span>
                <span className="font-mono font-semibold text-foreground">
                  {financialPct === null ? '—' : `${financialPct}%`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="lg:col-span-2 lg:justify-self-end">
          <Link
            href={`/public/departments/${departmentPublicId ?? secId}`}
            className="group inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-hdp-green px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-hdp-green-active hover:shadow-md sm:w-auto"
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
  emphasis = 'default',
}: {
  labelMal: string;
  value: React.ReactNode;
  subMal?: string;
  tone?: 'muted' | 'info';
  emphasis?: 'default' | 'primary';
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
      <p className={`mt-0.5 font-mono font-bold leading-none text-foreground ${emphasis === 'primary' ? 'text-lg' : 'text-base'}`}>
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
