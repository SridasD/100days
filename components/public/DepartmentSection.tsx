'use client';

/**
 * Public landing page — "Department-wise Progress" section. Sits above
 * SectorGrid; shows Administrative Department-wise project counts with a
 * search/filter/sort list and a drill-down drawer per department
 * (DepartmentDrawer: department -> projects -> indicators).
 *
 * Header area is split into three visually distinct zones so it is
 * obvious what each control does:
 *   1. Summary cards  — read-only statistics (no hover, no pointer)
 *   2. Toolbar        — search input + sort dropdown (user input)
 *   3. Status filters — labelled pill tabs that filter the list
 */
import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  BarChart3,
  Building2,
  CheckCircle2,
  Loader2,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SectionHeader } from './HomePage';
import { DepartmentRow, type DepartmentRowData } from './DepartmentRow';
import { DepartmentDrawer } from './DepartmentDrawer';

type SortKey = 'progress' | 'projects' | 'name';
type StatusFilter = 'all' | 'completed' | 'in-progress';

const STATUS_FILTERS: {
  key: StatusFilter;
  labelMal: string;
  activeClass: string;
}[] = [
  { key: 'all', labelMal: 'വകുപ്പുകൾ', activeClass: 'bg-hdp-green text-white' },
  {
    key: 'completed',
    labelMal: 'പൂർത്തിയായ വകുപ്പുകൾ',
    activeClass: 'bg-hdp-success text-white',
  },
  {
    key: 'in-progress',
    labelMal: 'പുരോഗതിയിലുള്ള വകുപ്പുകൾ',
    activeClass: 'bg-hdp-warning text-white',
  },
];

const SORT_OPTIONS: { key: SortKey; labelMal: string }[] = [
  { key: 'progress', labelMal: 'പുരോഗതി' },
  { key: 'projects', labelMal: 'പദ്ധതികളുടെ എണ്ണം' },
  { key: 'name', labelMal: 'പദ്ധതിയുടെ പേര്' },
];

export function DepartmentSection({
  departments,
}: {
  departments: DepartmentRowData[] | null;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('progress');
  const [activeDept, setActiveDept] = useState<DepartmentRowData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Search-filtered, but NOT status-filtered — this is what the summary
  // cards and the filter tabs' counts are computed against, so counts
  // reflect "how many match the current search" regardless of which
  // status tab is currently active.
  const bySearch = useMemo(() => {
    if (!departments) return [];
    if (!search.trim()) return departments;
    const q = search.trim().toLowerCase();
    return departments.filter(
      (d) => d.nameMal.toLowerCase().includes(q) || (d.nameEn ?? '').toLowerCase().includes(q),
    );
  }, [departments, search]);

  // A department is "completed" only when every one of its projects is
  // completed (server-derived `status`). Everything else — some project
  // still in progress, or nothing started yet — is treated as in-progress
  // so the two status tabs together account for every department.
  const statusCounts = useMemo(() => {
    const completed = bySearch.filter((d) => d.status === 'completed').length;
    return {
      all: bySearch.length,
      completed,
      'in-progress': bySearch.length - completed,
    } satisfies Record<StatusFilter, number>;
  }, [bySearch]);

  // Portal-wide project / indicator totals — shown as the read-only
  // summary cards above the toolbar.
  const totals = useMemo(() => {
    let projects = 0;
    let projectsCompleted = 0;
    let indicators = 0;
    for (const d of bySearch) {
      projects += d.projects;
      projectsCompleted += d.projectsCompleted;
      indicators += d.indicators;
    }
    return {
      departments: bySearch.length,
      projectsCompleted,
      projectsInProgress: Math.max(projects - projectsCompleted, 0),
      indicators,
    };
  }, [bySearch]);

  const visible = useMemo(() => {
    const list =
      statusFilter === 'all'
        ? bySearch
        : statusFilter === 'completed'
          ? bySearch.filter((d) => d.status === 'completed')
          : bySearch.filter((d) => d.status !== 'completed');
    return [...list].sort((a, b) => {
      if (sortBy === 'progress') return b.physicalPct - a.physicalPct;
      if (sortBy === 'projects') return b.projects - a.projects;
      return a.nameMal.localeCompare(b.nameMal, 'ml');
    });
  }, [bySearch, statusFilter, sortBy]);

  function openDepartment(d: DepartmentRowData) {
    setActiveDept(d);
    setDrawerOpen(true);
  }

  const activeSortLabel =
    SORT_OPTIONS.find((o) => o.key === sortBy)?.labelMal ?? SORT_OPTIONS[0].labelMal;

  return (
    <section className="bg-white py-14">
      <div className="container mx-auto px-4">
        <SectionHeader
          eyebrowMal="വകുപ്പുതല വിശദാംശങ്ങൾ"
          titleMal="ഭരണവകുപ്പുകളുടെ പദ്ധതി പുരോഗതി"
          rightAction={
            departments && (
              <span className="font-malayalam inline-flex items-center gap-1.5 rounded-full bg-hdp-bg px-3 py-1 text-xs text-muted-foreground ring-1 ring-border">
                <span className="font-mono font-semibold text-foreground">{visible.length}</span>
                വകുപ്പുകൾ കാണിക്കുന്നു
              </span>
            )
          }
        />

        {/* ── ZONE 1 · SUMMARY CARDS (read-only statistics) ─────────────── */}
        {departments !== null && (
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              tone="green"
              icon={Building2}
              labelMal="വകുപ്പുകൾ"
              value={totals.departments}
            />
            <SummaryCard
              tone="success"
              icon={CheckCircle2}
              labelMal="പൂർത്തിയായ പദ്ധതികൾ"
              value={totals.projectsCompleted}
            />
            <SummaryCard
              tone="warning"
              icon={TrendingUp}
              labelMal="പുരോഗതിയിലുള്ള പദ്ധതികൾ"
              value={totals.projectsInProgress}
            />
            <SummaryCard
              tone="violet"
              icon={BarChart3}
              labelMal="പദ്ധതിഘടകങ്ങൾ"
              value={totals.indicators}
            />
          </div>
        )}

        {/* ── ZONE 2 · TOOLBAR (search + sort) ──────────────────────────── */}
        <div className="mt-5 rounded-2xl border border-border bg-hdp-bg/50 p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="വകുപ്പ് തിരയുക..."
                aria-label="വകുപ്പ് തിരയുക"
                className="font-malayalam h-10 rounded-full border-border bg-white pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="dept-sort" className="shrink-0 text-muted-foreground">
                <ArrowUpDown className="h-4 w-4" aria-hidden />
                <span className="sr-only font-malayalam">ക്രമം</span>
              </label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger
                  id="dept-sort"
                  aria-label="ക്രമം"
                  className="font-malayalam h-10 w-full rounded-full border-border bg-white sm:w-[190px]"
                >
                  <SelectValue>{activeSortLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key} className="font-malayalam">
                      {o.labelMal}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── ZONE 3 · STATUS FILTER TABS ──────────────────────────────── */}
          <div className="mt-3 flex items-start gap-2.5 border-t border-border pt-3">
            <SlidersHorizontal
              className="mt-2 h-4 w-4 shrink-0 text-muted-foreground"
              aria-label="ഫിൽട്ടർ"
            />
            <div
              role="group"
              aria-label="നിലയനുസരിച്ച് ഫിൽട്ടർ ചെയ്യുക"
              className="flex flex-wrap gap-2"
            >
              {STATUS_FILTERS.map((f) => {
                const active = statusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(f.key)}
                    className={cn(
                      'font-malayalam inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors',
                      active
                        ? `${f.activeClass} border-transparent shadow-sm`
                        : 'border-border bg-white text-muted-foreground hover:border-hdp-green/40 hover:text-foreground',
                    )}
                  >
                    {f.labelMal}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold',
                        active ? 'bg-white/25 text-white' : 'bg-hdp-bg text-foreground',
                      )}
                    >
                      {statusCounts[f.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* LOADING */}
        {departments === null && (
          <div className="mt-8 space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-3xl bg-hdp-bg" />
            ))}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="font-malayalam">വകുപ്പുകൾ ലോഡുചെയ്യുന്നു…</span>
            </div>
          </div>
        )}

        {/* EMPTY */}
        {departments !== null && departments.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed bg-hdp-bg p-10 text-center">
            <Building2 className="mx-auto h-7 w-7 text-muted-foreground" />
            <p className="font-malayalam mt-3 text-sm font-semibold text-foreground">
              ഇതുവരെ ഒരു വകുപ്പിലും പദ്ധതികൾ ചേർത്തിട്ടില്ല
            </p>
          </div>
        )}

        {/* NO SEARCH RESULTS */}
        {departments !== null && departments.length > 0 && visible.length === 0 && (
          <div className="mt-8 rounded-2xl border border-dashed bg-hdp-bg p-10 text-center">
            <p className="font-malayalam text-sm text-muted-foreground">
              തിരയലിന് ഫലങ്ങളൊന്നും ലഭിച്ചില്ല
            </p>
          </div>
        )}

        {/* LIST */}
        {visible.length > 0 && (
          <div className="mt-6 space-y-3">
            {visible.map((d) => (
              <DepartmentRow key={d.secId} department={d} onOpen={() => openDepartment(d)} />
            ))}
          </div>
        )}
      </div>

      <DepartmentDrawer department={activeDept} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </section>
  );
}

const SUMMARY_TONES = {
  green: {
    bg: 'bg-hdp-green/[0.06]',
    ring: 'ring-hdp-green/15',
    value: 'text-hdp-green',
    iconBg: 'bg-hdp-green/10 text-hdp-green',
  },
  success: {
    bg: 'bg-[#E8F5E9]',
    ring: 'ring-[#C8E6C9]',
    value: 'text-[#1B5E20]',
    iconBg: 'bg-[#C8E6C9] text-[#1B5E20]',
  },
  warning: {
    bg: 'bg-[#FFF8E1]',
    ring: 'ring-[#FFE082]',
    value: 'text-[#E65100]',
    iconBg: 'bg-[#FFE082] text-[#E65100]',
  },
  violet: {
    bg: 'bg-[#7C3AED]/[0.08]',
    ring: 'ring-[#7C3AED]/20',
    value: 'text-[#7C3AED]',
    iconBg: 'bg-[#7C3AED]/15 text-[#7C3AED]',
  },
} as const;

function SummaryCard({
  tone,
  icon: Icon,
  labelMal,
  value,
}: {
  tone: keyof typeof SUMMARY_TONES;
  icon: typeof Building2;
  labelMal: string;
  value: number;
}) {
  const t = SUMMARY_TONES[tone];
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl p-3.5 ring-1 sm:p-4', t.bg, t.ring)}>
      <span
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t.iconBg)}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className={cn('font-mono text-xl font-extrabold leading-none sm:text-2xl', t.value)}>
          {value}
        </div>
        <div className="font-malayalam mt-1 text-[11px] font-medium leading-tight text-muted-foreground">
          {labelMal}
        </div>
      </div>
    </div>
  );
}
