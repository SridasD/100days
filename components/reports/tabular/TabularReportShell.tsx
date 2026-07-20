'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Download, Landmark, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { DepartmentGroup, ReportFilters, Summary } from './types';
import { indicatorStatus, verificationStatus } from './lib';
import { KPISummaryCards } from './KPISummaryCards';
import { FilterToolbar } from './FilterToolbar';
import { HierarchicalTable } from './HierarchicalTable';
import { Pagination } from './Pagination';

const PER_PAGE_OPTIONS = [10, 15, 20, 25, 50];

const DEFAULT_FILTERS: ReportFilters = {
  search: '',
  department: 'All',
  agency: 'All',
  verification: 'All',
  status: 'All',
};

type TabularReportShellProps = {
  departments: DepartmentGroup[];
  summary: Summary;
  projectCount: number;
  reportId: string;
  title: string;
  reportHref: string;
  viewHref: string;
  generatedAt: string;
};

export function TabularReportShell({
  departments,
  summary,
  projectCount,
  reportId,
  title,
  reportHref,
  viewHref,
  generatedAt,
}: TabularReportShellProps) {
  const router = useRouter();
  const [applied, setApplied] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [resetCount, setResetCount] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const departmentOptions = useMemo(
    () => Array.from(new Set(departments.map((dept) => dept.name))).sort(),
    [departments],
  );

  const agencyOptions = useMemo(
    () =>
      Array.from(
        new Set(departments.flatMap((dept) => dept.projects.map((project) => project.agencyName))),
      ).sort(),
    [departments],
  );

  const filtersActive =
    applied.search.trim() !== '' ||
    applied.department !== 'All' ||
    applied.agency !== 'All' ||
    applied.verification !== 'All' ||
    applied.status !== 'All';

  const filteredDepartments = useMemo(() => {
    const searchLower = applied.search.trim().toLowerCase();

    return departments
      .filter((dept) => applied.department === 'All' || dept.name === applied.department)
      .map((dept) => {
        const projects = dept.projects
          .filter((project) => applied.agency === 'All' || project.agencyName === applied.agency)
          .map((project) => {
            const indicators = project.indicators.filter((row) => {
              const matchesSearch =
                searchLower === '' ||
                [dept.name, project.agencyName, project.hodNames, project.projectName, project.projectCode, row.indicator_name]
                  .some((field) => field.toLowerCase().includes(searchLower));
              if (!matchesSearch) return false;

              if (applied.verification !== 'All' && verificationStatus(row) !== applied.verification) return false;
              if (applied.status !== 'All' && indicatorStatus(row) !== applied.status) return false;
              return true;
            });
            return { ...project, indicators };
          })
          .filter((project) => project.indicators.length > 0);
        return { ...dept, projects };
      })
      .filter((dept) => dept.projects.length > 0);
  }, [departments, applied]);

  const totalPages = Math.max(1, Math.ceil(filteredDepartments.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * perPage;
  const paginatedDepartments = filteredDepartments.slice(startIndex, startIndex + perPage);

  function handleApply(filters: ReportFilters) {
    setApplied(filters);
    setPage(1);
  }

  function handleClear() {
    setApplied(DEFAULT_FILTERS);
    setPage(1);
    setResetCount((count) => count + 1);
  }

  function toggleDept(key: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleProject(key: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleExpandedDepts = filtersActive
    ? new Set(paginatedDepartments.map((dept) => dept.name))
    : expandedDepts;
  const visibleExpandedProjects = filtersActive
    ? new Set(paginatedDepartments.flatMap((dept) => dept.projects.map((project) => `${dept.name}::${project.key}`)))
    : expandedProjects;

  return (
    <main className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-kerala-blue/10">
              <Landmark className="h-5 w-5 text-kerala-blue" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Administrative Department</span>
                <ChevronRight className="h-3 w-3" />
                <span>Project</span>
                <ChevronRight className="h-3 w-3" />
                <span>Indicator</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
            <Button asChild variant="outline" size="sm">
              <Link href={`/api/admin/reports/${reportId}?format=xlsx`}>
                <Download className="h-4 w-4" />
                Export
              </Link>
            </Button>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <span>Last updated: {generatedAt}</span>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={reportHref}>
              <ArrowLeft className="h-4 w-4" />
              Back to Reports
            </Link>
          </Button>
          <div className="inline-flex items-center gap-1 rounded-lg border bg-white p-1 text-xs font-medium shadow-sm">
            <Link href={viewHref} className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted">
              Hierarchy
            </Link>
            <span className="rounded-md bg-kerala-blue px-3 py-1.5 text-white">Tabular</span>
          </div>
        </div>
      </section>

      <KPISummaryCards
        departmentCount={departments.length}
        projectCount={projectCount}
        indicatorCount={summary.totalIndicators}
        laggingCount={summary.lagging}
        avgPhysical={summary.physical}
        avgFinancial={summary.financial}
        images={summary.images}
        videos={summary.videos}
        documents={summary.documents}
      />

      <FilterToolbar
        key={resetCount}
        initial={applied}
        departmentOptions={departmentOptions}
        agencyOptions={agencyOptions}
        onApply={handleApply}
        onClear={handleClear}
      />

      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-base">Tabular Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {filteredDepartments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border bg-slate-50/60 py-12 text-center">
              <p className="text-sm font-medium text-foreground">No departments match your filters</p>
              <p className="text-xs text-muted-foreground">Try adjusting the search text or clearing filters.</p>
            </div>
          ) : (
            <>
              <HierarchicalTable
                departments={paginatedDepartments}
                startIndex={startIndex}
                expandedDepts={visibleExpandedDepts}
                expandedProjects={visibleExpandedProjects}
                onToggleDept={toggleDept}
                onToggleProject={toggleProject}
              />

              <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Showing {paginatedDepartments.length} of {filteredDepartments.length} departments
                  </span>
                  <span className="flex items-center gap-1.5">
                    Departments per page:
                    <Select value={String(perPage)} onValueChange={(value) => { setPerPage(Number(value)); setPage(1); }}>
                      <SelectTrigger className="h-7 w-16 text-xs" aria-label="Departments per page">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PER_PAGE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={String(option)}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </span>
                </div>
                <Pagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
