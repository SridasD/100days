'use client';

/**
 * Single department row for the public landing page's department-wise
 * section. Clicking anywhere on the row opens the drill-down drawer
 * (handled by the parent — this component is purely presentational).
 */
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  Images,
  Video,
} from 'lucide-react';
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
  { dot: string; chip: string; chipMal: string; ringColor: string }
> = {
  completed: {
    dot: 'bg-hdp-success',
    chip: 'bg-hdp-success/10 text-hdp-success',
    chipMal: 'പദ്ധതി പൂർത്തിയായവ',
    ringColor: '#4CAF50',
  },
  'in-progress': {
    dot: 'bg-hdp-warning',
    chip: 'bg-hdp-warning/10 text-hdp-warning',
    chipMal: 'പുരോഗതിയിൽ',
    ringColor: '#FF8F00',
  },
  'not-started': {
    dot: 'bg-hdp-danger',
    chip: 'bg-hdp-danger/10 text-hdp-danger',
    chipMal: 'ആരംഭിച്ചിട്ടില്ല',
    ringColor: '#E53935',
  },
};

/**
 * Department-level status shown on the row badge and used for the
 * "completed" filter: a department counts as completed once it has at
 * least one finished project, not only once every project is done. This
 * is deliberately looser than the strict per-project `status` field (used
 * for a single project's own status pill, e.g. inside the drill-down).
 */
export function getDepartmentEffectiveStatus(d: {
  projectsCompleted: number;
}): 'completed' | 'in-progress' {
  return d.projectsCompleted > 0 ? 'completed' : 'in-progress';
}

export function DepartmentRow({
  department: d,
  onOpen,
}: {
  department: DepartmentRowData;
  onOpen: () => void;
}) {
  const tone = STATUS_META[getDepartmentEffectiveStatus(d)];

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
            data={[{ name: 'pct', value: d.physicalPct, fill: tone.ringColor }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: '#F1F5F9' }}
              cornerRadius={20}
              dataKey="value"
              fill={tone.ringColor}
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
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-mono font-semibold">{d.indicators}</span>{' '}
          <span className="font-malayalam">ഘടകങ്ങൾ</span>
        </p>
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

      {/* STAT STRIP */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-hdp-bg/40 p-2 sm:min-w-[180px]">
        <StatCell icon={ClipboardList} labelMal="പദ്ധതികൾ" value={d.projects} />
        <StatCell
          icon={CheckCircle2}
          labelMal="പൂർത്തിയായവ"
          value={d.projectsCompleted}
          tone="success"
        />
      </div>

      {/* CHEVRON */}
      <span className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hdp-green/10 text-hdp-green transition-transform duration-200 group-hover:translate-x-0.5">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </article>
  );
}

function StatCell({
  icon: Icon,
  labelMal,
  value,
  tone = 'default',
}: {
  icon: typeof ClipboardList;
  labelMal: string;
  value: number | string;
  tone?: 'default' | 'success';
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-white px-1.5 py-2 text-center shadow-sm">
      <Icon
        className={`h-3.5 w-3.5 ${tone === 'success' ? 'text-hdp-success' : 'text-hdp-green'}`}
        aria-hidden
      />
      <span
        className={`mt-1 font-mono text-sm font-extrabold leading-none ${tone === 'success' ? 'text-hdp-success' : 'text-foreground'}`}
      >
        {value}
      </span>
      <span className="font-malayalam mt-0.5 text-[9px] leading-tight text-muted-foreground">
        {labelMal}
      </span>
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
