'use client';

/**
 * Single department row for the public landing page's department-wise
 * section. Clicking anywhere on the row opens the drill-down drawer
 * (handled by the parent — this component is purely presentational).
 */
import { ChevronRight, FileText, Images, Video } from 'lucide-react';
import {
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
} from 'recharts';

export type DepartmentStatus = 'completed' | 'in-progress' | 'not-started';

export interface DepartmentRowData {
  secId: number;
  departmentPublicId?: string;
  nameMal: string;
  nameEn?: string;
  projects: number;
  projectsCompleted: number;
  indicators: number;
  indicatorsCompleted: number;
  costInLakhs: number;
  physicalPct: number;
  financialPct: number | null;
  status: DepartmentStatus;
  imageCount?: number;
  videoCount?: number;
  documentCount?: number;
}

const STATUS_META: Record<
  DepartmentStatus,
  { dot: string; chip: string; chipMal: string }
> = {
  completed: {
    dot: 'bg-hdp-success',
    chip: 'bg-hdp-success/10 text-hdp-success',
    chipMal: 'പദ്ധതി പൂർത്തിയായവ',
  },
  'in-progress': {
    dot: 'bg-hdp-warning',
    chip: 'bg-hdp-warning/10 text-hdp-warning',
    chipMal: 'പുരോഗതിയിൽ',
  },
  'not-started': {
    dot: 'bg-hdp-danger',
    chip: 'bg-hdp-danger/10 text-hdp-danger',
    chipMal: 'ആരംഭിച്ചിട്ടില്ല',
  },
};

/**
 * Progress-ring colour purely by physical-progress magnitude, independent
 * of the department's completion status:
 *   >= 80%  green   ·   50–79%  orange   ·   < 50%  red
 */
function ringColorForPct(pct: number): string {
  if (pct >= 80) return '#4CAF50';
  if (pct >= 50) return '#FF8F00';
  return '#E53935';
}

export function DepartmentRow({
  department: d,
  onOpen,
}: {
  department: DepartmentRowData;
  onOpen: () => void;
}) {
  // Badge = real department completion status (all projects done / any in
  // progress / none started). Ring colour is driven separately by %.
  const tone = STATUS_META[d.status];
  const ringColor = ringColorForPct(d.physicalPct);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-wrap items-center gap-4 rounded-3xl border border-border bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5"
    >
      {/* DONUT */}
      <div className="relative h-20 w-20 shrink-0 sm:h-24 sm:w-24">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="78%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={[{ name: 'pct', value: d.physicalPct, fill: ringColor }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#F1F5F9' }}
              cornerRadius={20}
              dataKey="value"
              fill={ringColor}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-extrabold text-foreground sm:text-xl">
            {d.physicalPct}%
          </span>
          <span className="font-malayalam text-[9px] text-muted-foreground">ഭൗതികം</span>
        </div>
      </div>

      {/* NAME + STATUS */}
      <div className="min-w-[180px] flex-1 sm:min-w-[220px]">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-malayalam text-[15px] font-bold leading-tight text-foreground">
            {d.nameMal}
          </h3>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            <span className="font-malayalam">{tone.chipMal}</span>
            <span className="font-mono">
              {d.projectsCompleted}/{d.projects}
            </span>
          </span>
        </div>
        {d.nameEn && d.nameEn !== d.nameMal && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{d.nameEn}</p>
        )}
        {(d.imageCount || d.videoCount || d.documentCount) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {!!d.imageCount && (
              <MediaChip icon={Images} count={d.imageCount} labelMal="ചിത്രങ്ങൾ" />
            )}
            {!!d.videoCount && (
              <MediaChip icon={Video} count={d.videoCount} labelMal="ഗാലറി" />
            )}
            {!!d.documentCount && (
              <MediaChip icon={FileText} count={d.documentCount} labelMal="രേഖകൾ" />
            )}
          </div>
        )}
      </div>

      {/* STAT STRIP — total vs completed, for projects and indicators */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-hdp-bg/40 p-2 sm:min-w-[220px]">
        <MetricGroup labelMal="പദ്ധതികൾ" total={d.projects} completed={d.projectsCompleted} />
        <MetricGroup labelMal="ഘടകങ്ങൾ" total={d.indicators} completed={d.indicatorsCompleted} />
      </div>

      {/* CHEVRON */}
      <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hdp-green/10 text-hdp-green transition-transform duration-200 group-hover:translate-x-0.5">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </article>
  );
}

/**
 * One metric group in the stat strip: a bold total under the group label,
 * and the completed count beneath it in success green.
 */
function MetricGroup({
  labelMal,
  total,
  completed,
}: {
  labelMal: string;
  total: number;
  completed: number;
}) {
  return (
    <div className="rounded-xl bg-white px-2.5 py-2 shadow-sm">
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-malayalam text-[10px] font-semibold leading-tight text-muted-foreground">
          {labelMal}
        </span>
        <span className="font-mono text-sm font-extrabold leading-none text-foreground">
          {total}
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-1 border-t border-border/70 pt-1.5">
        <span className="font-malayalam text-[10px] font-medium leading-tight text-hdp-success">
          പൂർത്തിയായവ
        </span>
        <span className="font-mono text-sm font-extrabold leading-none text-hdp-success">
          {completed}
        </span>
      </div>
    </div>
  );
}

function MediaChip({
  icon: Icon,
  count,
  labelMal,
}: {
  icon: typeof Images;
  count: number;
  labelMal: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-hdp-bg px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
      <Icon className="h-3 w-3" aria-hidden />
      <span className="font-mono font-semibold">{count}</span>
      <span className="font-malayalam">{labelMal}</span>
    </span>
  );
}
