'use client';

/**
 * Public landing page — "Department-wise Progress" section. Sits below
 * SectorGrid (untouched); shows Administrative Department-wise project
 * counts with a search/filter/sort list and a drill-down drawer per
 * department (DepartmentDrawer: department -> projects -> indicators).
 */
import { useMemo, useState } from 'react';
import { Building2, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SectionHeader } from './HomePage';
import {
  DepartmentRow,
  getDepartmentEffectiveStatus,
  type DepartmentRowData,
} from './DepartmentRow';
import { DepartmentDrawer } from './DepartmentDrawer';

type SortKey = 'progress' | 'projects' | 'name';
type StatusFilter = 'all' | 'completed' | 'in-progress';

const STATUS_FILTERS: {
  key: StatusFilter;
  labelMal: string;
  activeClass: string;
}[] = [
  { key: 'all', labelMal: 'എല്ലാം', activeClass: 'bg-hdp-green text-white' },
  {
    key: 'completed',
    labelMal: 'പദ്ധതി പൂർത്തിയായവ',
    activeClass: 'bg-hdp-success text-white',
  },
  {
    key: 'in-progress',
    labelMal: 'പുരോഗതിയിൽ',
    activeClass: 'bg-hdp-warning text-white',
  },
];

const SORT_OPTIONS: { key: SortKey; labelMal: string }[] = [
  { key: 'progress', labelMal: 'പുരോഗതി' },
  { key: 'projects', labelMal: 'പദ്ധതികൾ' },
  { key: 'name', labelMal: 'പേര്' },
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

  // Search-filtered, but NOT status-filtered — this is what the filter
  // chips' counts are computed against, so counts reflect "how many would
  // show for this status given the current search" regardless of which
  // status chip is currently active.
  const bySearch = useMemo(() => {
    if (!departments) return [];
    if (!search.trim()) return departments;
    const q = search.trim().toLowerCase();
    return departments.filter(
      (d) => d.nameMal.toLowerCase().includes(q) || (d.nameEn ?? '').toLowerCase().includes(q),
    );
  }, [departments, search]);

  // Department count per filter bucket, plus the total number of completed
  // PROJECTS across the departments in that bucket — shown together on each
  // chip so "7 departments" and "18 completed projects" aren't conflated.
  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: bySearch.length,
      completed: 0,
      'in-progress': 0,
    };
    for (const d of bySearch) counts[getDepartmentEffectiveStatus(d)] += 1;
    return counts;
  }, [bySearch]);

  const completedProjectsByBucket = useMemo(() => {
    const sums: Record<StatusFilter, number> = {
      all: 0,
      completed: 0,
      'in-progress': 0,
    };
    for (const d of bySearch) {
      sums.all += d.projectsCompleted;
      sums[getDepartmentEffectiveStatus(d)] += d.projectsCompleted;
    }
    return sums;
  }, [bySearch]);

  const visible = useMemo(() => {
    const list =
      statusFilter === 'all'
        ? bySearch
        : bySearch.filter((d) => getDepartmentEffectiveStatus(d) === statusFilter);
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

  return (
    <section className="bg-white py-14">
      <div className="container mx-auto px-4">
        <SectionHeader
          eyebrowMal="വകുപ്പുതല വിശദാംശങ്ങൾ"
          titleMal="ഭരണവകുപ്പുകളുടെ പദ്ധതി പുരോഗതി"
          rightAction={
            departments && (
              <span className="text-xs text-muted-foreground">
                <span className="font-mono font-semibold">{visible.length}</span>{' '}
                <span className="font-malayalam">വകുപ്പുകൾ</span>
              </span>
            )
          }
        />

        {/* CONTROLS */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="വകുപ്പ് തിരയുക..."
              className="font-malayalam h-10 rounded-full pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-hdp-bg/60 p-1">
              <span className="font-malayalam pl-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                ഫിൽട്ടർ
              </span>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={`font-malayalam inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    statusFilter === f.key
                      ? f.activeClass
                      : 'bg-white text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.labelMal}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 font-mono text-[10px] font-bold ${
                      statusFilter === f.key ? 'bg-white/25 text-white' : 'bg-hdp-bg text-foreground'
                    }`}
                  >
                    {statusCounts[f.key]}
                    {f.key !== 'in-progress' && (
                      <span className="opacity-70">({completedProjectsByBucket[f.key]})</span>
                    )}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-hdp-bg/60 p-1">
              <span className="font-malayalam pl-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                ക്രമം
              </span>
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSortBy(o.key)}
                  className={`font-malayalam rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sortBy === o.key
                      ? 'bg-hdp-green text-white'
                      : 'bg-white text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {o.labelMal}
                </button>
              ))}
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
