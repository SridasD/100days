'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, Download, Landmark, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  sourceOfFunding: 'All',
  natureOfProject: 'All',
  projectExecutionType: 'All',
  verification: 'All',
  status: 'All',
};

type TabularReportShellProps = {
  departments: DepartmentGroup[];
  summary: Summary;
  projectCount: number;
  completedProjectCount: number;
  reportId: string;
  title: string;
  reportHref: string;
  viewHref: string;
  generatedAt: string;
  /** Hides the Hierarchy/Tabular view-switcher — used on the dashboard page,
   * which only ever renders the tabular view. Defaults to true. */
  showHierarchyToggle?: boolean;
};

export function TabularReportShell({
  departments,
  summary,
  projectCount,
  completedProjectCount,
  reportId,
  title,
  reportHref,
  viewHref,
  generatedAt,
  showHierarchyToggle = true,
}: TabularReportShellProps) {
  const router = useRouter();
  const [applied, setApplied] = useState<ReportFilters>(DEFAULT_FILTERS);
  const [resetCount, setResetCount] = useState(0);
  const [perPage, setPerPage] = useState(20);
  const [page, setPage] = useState(1);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [showNoIndicatorDialog, setShowNoIndicatorDialog] = useState(false);
  const [showCompletedDialog, setShowCompletedDialog] = useState(false);
  const [expandedNoIndicatorAgencies, setExpandedNoIndicatorAgencies] = useState<Set<string>>(new Set());
  const [expandedNoIndicatorProjects, setExpandedNoIndicatorProjects] = useState<Set<string>>(new Set());
  const [expandedCompletedAgencies, setExpandedCompletedAgencies] = useState<Set<string>>(new Set());
  const [expandedCompletedProjects, setExpandedCompletedProjects] = useState<Set<string>>(new Set());

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
    applied.sourceOfFunding !== 'All' ||
    applied.natureOfProject !== 'All' ||
    applied.projectExecutionType !== 'All' ||
    applied.verification !== 'All' ||
    applied.status !== 'All';

  const appliedFiltersCount = [
    applied.search.trim() !== '',
    applied.department !== 'All',
    applied.agency !== 'All',
    applied.sourceOfFunding !== 'All',
    applied.natureOfProject !== 'All',
    applied.projectExecutionType !== 'All',
    applied.verification !== 'All',
    applied.status !== 'All',
  ].filter(Boolean).length;

  const appliedFilterPills = useMemo(() => {
    const pills: string[] = [];
    if (applied.search.trim() !== '') pills.push(`Search: ${applied.search.trim()}`);
    if (applied.department !== 'All') pills.push(`Department: ${applied.department}`);
    if (applied.agency !== 'All') pills.push(`Implementing: ${applied.agency}`);
    if (applied.verification !== 'All') pills.push(`Verification: ${applied.verification}`);
    if (applied.status !== 'All') pills.push(`Status: ${applied.status}`);
    if (applied.natureOfProject !== 'All') pills.push(`Nature: ${applied.natureOfProject}`);
    if (applied.sourceOfFunding !== 'All') pills.push(`Funding: ${applied.sourceOfFunding}`);
    if (applied.projectExecutionType !== 'All') pills.push(`Execution: ${applied.projectExecutionType}`);
    return pills;
  }, [applied]);

  const sourceOfFundingOptions = useMemo(
    () =>
      Array.from(
        new Set(departments.flatMap((dept) => dept.projects.map((project) => project.sourceOfFunding))),
      ).sort(),
    [departments],
  );

  const natureOfProjectOptions = useMemo(
    () =>
      Array.from(
        new Set(departments.flatMap((dept) => dept.projects.map((project) => project.natureOfProject))),
      ).sort(),
    [departments],
  );

  const projectExecutionTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(departments.flatMap((dept) => dept.projects.map((project) => project.projectExecutionType))),
      ).sort(),
    [departments],
  );

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set('format', 'xlsx');
    if (applied.search.trim() !== '') params.set('search', applied.search.trim());
    if (applied.department !== 'All') params.set('department', applied.department);
    if (applied.agency !== 'All') params.set('agency', applied.agency);
    if (applied.sourceOfFunding !== 'All') params.set('sourceOfFunding', applied.sourceOfFunding);
    if (applied.natureOfProject !== 'All') params.set('natureOfProject', applied.natureOfProject);
    if (applied.projectExecutionType !== 'All') params.set('projectExecutionType', applied.projectExecutionType);
    if (applied.verification !== 'All') params.set('verification', applied.verification);
    if (applied.status !== 'All') params.set('status', applied.status);
    return `/api/admin/reports/${reportId}?${params.toString()}`;
  }, [applied, reportId]);

  const filteredDepartments = useMemo(() => {
    const searchLower = applied.search.trim().toLowerCase();

    return departments
      .filter((dept) => applied.department === 'All' || dept.name === applied.department)
      .map((dept) => {
        const projects = dept.projects
          .filter((project) => {
            if (applied.agency !== 'All' && project.agencyName !== applied.agency) return false;
            if (applied.sourceOfFunding !== 'All' && project.sourceOfFunding !== applied.sourceOfFunding) return false;
            if (applied.natureOfProject !== 'All' && project.natureOfProject !== applied.natureOfProject) return false;
            if (applied.projectExecutionType !== 'All' && project.projectExecutionType !== applied.projectExecutionType) {
              return false;
            }
            return true;
          })
          .map((project) => {
            const indicators = project.indicators.filter((row) => {
              const matchesSearch =
                searchLower === '' ||
                [
                  dept.name,
                  project.agencyName,
                  project.hodNames,
                  project.projectName,
                  project.projectCode,
                  project.sourceOfFunding,
                  project.natureOfProject,
                  project.projectExecutionType,
                  row.indicator_name,
                ]
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

  function toggleNoIndicatorProject(key: string) {
    setExpandedNoIndicatorProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleNoIndicatorAgency(key: string) {
    setExpandedNoIndicatorAgencies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCompletedProject(key: string) {
    setExpandedCompletedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCompletedAgency(key: string) {
    setExpandedCompletedAgencies((prev) => {
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

  const noIndicatorByDepartment = useMemo(() => {
    return departments
      .map((dept) => {
        const noIndicatorProjects = dept.projects.filter((project) =>
          project.indicators.every((row) => row.indicator_id === null),
        );

        const agencyMap = new Map<string, { key: string; projectCode: string; projectName: string }[]>();
        for (const project of noIndicatorProjects) {
          if (!agencyMap.has(project.agencyName)) {
            agencyMap.set(project.agencyName, []);
          }
          agencyMap.get(project.agencyName)?.push({
            key: project.key,
            projectCode: project.projectCode,
            projectName: project.projectName,
          });
        }

        const agencies = Array.from(agencyMap.entries())
          .map(([agencyName, projects]) => ({
            agencyName,
            count: projects.length,
            projects: projects.sort((left, right) => left.projectName.localeCompare(right.projectName)),
          }))
          .sort((left, right) => right.count - left.count || left.agencyName.localeCompare(right.agencyName));

        const count = agencies.reduce((sum, agency) => sum + agency.count, 0);

        return {
          department: dept.name,
          count,
          agencies,
        };
      })
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count || left.department.localeCompare(right.department));
  }, [departments]);

  const completedByDepartment = useMemo(() => {
    return departments
      .map((dept) => {
        const completedProjects = dept.projects.filter((project) => project.isCompleted);

        const agencyMap = new Map<string, { key: string; projectCode: string; projectName: string }[]>();
        for (const project of completedProjects) {
          if (!agencyMap.has(project.agencyName)) {
            agencyMap.set(project.agencyName, []);
          }
          agencyMap.get(project.agencyName)?.push({
            key: project.key,
            projectCode: project.projectCode,
            projectName: project.projectName,
          });
        }

        const agencies = Array.from(agencyMap.entries())
          .map(([agencyName, projects]) => ({
            agencyName,
            count: projects.length,
            projects: projects.sort((left, right) => left.projectName.localeCompare(right.projectName)),
          }))
          .sort((left, right) => right.count - left.count || left.agencyName.localeCompare(right.agencyName));

        const count = agencies.reduce((sum, agency) => sum + agency.count, 0);

        return {
          department: dept.name,
          count,
          agencies,
        };
      })
      .filter((row) => row.count > 0)
      .sort((left, right) => right.count - left.count || left.department.localeCompare(right.department));
  }, [departments]);

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
                <span>Implementing Department</span>
                <ChevronRight className="h-3 w-3" />
                <span>Project</span>
                <ChevronRight className="h-3 w-3" />
                <span>Indicator</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 lg:items-end">
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
          {showHierarchyToggle && (
            <div className="inline-flex items-center gap-1 rounded-lg border bg-white p-1 text-xs font-medium shadow-sm">
              <Link href={viewHref} className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted">
                Hierarchy
              </Link>
              <span className="rounded-md bg-kerala-blue px-3 py-1.5 text-white">Tabular</span>
            </div>
          )}
        </div>
      </section>

      <KPISummaryCards
        departmentCount={departments.length}
        projectCount={projectCount}
        projectsWithNoIndicators={summary.projectsWithNoIndicators}
        indicatorCount={summary.totalIndicators}
        completedProjectCount={completedProjectCount}
        completedIndicatorCount={summary.completedIndicators}
        images={summary.images}
        videos={summary.videos}
        documents={summary.documents}
      />

      <Card className="border-amber-200 bg-amber-50/60">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-amber-900">Projects without indicators</p>
            <p className="mt-1 text-xs text-amber-800/90">
              Department-wise drill down is available in modal view.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-900">
              {summary.projectsWithNoIndicators}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNoIndicatorDialog(true)}
              disabled={noIndicatorByDepartment.length === 0}
              className="w-full border-amber-300 bg-white text-amber-900 hover:bg-amber-100 sm:w-auto"
            >
              View by department
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-emerald-200 bg-emerald-50/60">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-emerald-900">Projects completed</p>
            <p className="mt-1 text-xs text-emerald-800/90">
              Department-wise drill down is available in modal view.
            </p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">
              {completedProjectCount}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCompletedDialog(true)}
              disabled={completedByDepartment.length === 0}
              className="w-full border-emerald-300 bg-white text-emerald-900 hover:bg-emerald-100 sm:w-auto"
            >
              View by department
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="border-b bg-white">
          <CardTitle className="text-base">Indicator Progress Distribution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <BandStat title="0%" count={summary.indicatorBands.zero} tone="slate" />
            <BandStat title="1-25%" count={summary.indicatorBands.oneTo25} tone="rose" />
            <BandStat title=">25-50%" count={summary.indicatorBands.above25To50} tone="orange" />
            <BandStat title="50-75%" count={summary.indicatorBands.above50To75} tone="amber" />
            <BandStat title="75-99%" count={summary.indicatorBands.above75To99} tone="blue" />
            <BandStat title="100%" count={summary.indicatorBands.completed100} tone="emerald" />
          </div>

          <div className="space-y-2">
            <BandRow
              label="0%"
              count={summary.indicatorBands.zero}
              total={summary.totalIndicators}
              barClass="bg-slate-500"
            />
            <BandRow
              label="1-25%"
              count={summary.indicatorBands.oneTo25}
              total={summary.totalIndicators}
              barClass="bg-rose-500"
            />
            <BandRow
              label=">25-50%"
              count={summary.indicatorBands.above25To50}
              total={summary.totalIndicators}
              barClass="bg-orange-500"
            />
            <BandRow
              label="50-75%"
              count={summary.indicatorBands.above50To75}
              total={summary.totalIndicators}
              barClass="bg-amber-500"
            />
            <BandRow
              label="75-99%"
              count={summary.indicatorBands.above75To99}
              total={summary.totalIndicators}
              barClass="bg-sky-500"
            />
            <BandRow
              label="100% completed"
              count={summary.indicatorBands.completed100}
              total={summary.totalIndicators}
              barClass="bg-emerald-500"
            />
          </div>
        </CardContent>
      </Card>

      <FilterToolbar
        key={resetCount}
        initial={applied}
        departmentOptions={departmentOptions}
        agencyOptions={agencyOptions}
        sourceOfFundingOptions={sourceOfFundingOptions}
        natureOfProjectOptions={natureOfProjectOptions}
        projectExecutionTypeOptions={projectExecutionTypeOptions}
        onApply={handleApply}
        onClear={handleClear}
      />

      <Card className="overflow-hidden border-slate-200">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Project Progress & Performance - Tabular Report</CardTitle>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700">
                Applied filters: {appliedFiltersCount}
              </span>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link href={exportHref}>
                  <Download className="h-4 w-4" />
                  Export
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Applied filters:</span>
            {appliedFilterPills.length > 0 ? (
              appliedFilterPills.map((pill) => (
                <span
                  key={pill}
                  className="inline-flex max-w-full items-center rounded-full border border-kerala-blue/20 bg-kerala-blue/5 px-2.5 py-1 text-[11px] font-medium text-kerala-blue"
                  title={pill}
                >
                  <span className="truncate">{pill}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
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

      <Dialog open={showNoIndicatorDialog} onOpenChange={setShowNoIndicatorDialog}>
        <DialogContent className="max-h-[88vh] w-[96vw] max-w-5xl overflow-hidden p-0">
          <DialogHeader>
            <div className="border-b bg-slate-50 px-5 py-4">
              <DialogTitle>Projects Without Indicators - Department Breakdown</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.projectsWithNoIndicators} project(s) need indicator mapping.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Click administrative department and implementing department rows to drill down.
              </p>
            </div>
          </DialogHeader>
          <div className="max-h-[68vh] space-y-3 overflow-y-auto px-5 pb-5 pt-3">
            {noIndicatorByDepartment.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                No departments with missing indicator mappings.
              </div>
            ) : (
              noIndicatorByDepartment.map((row) => (
                <div key={row.department} className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.department}</p>
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      {row.count} projects
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {row.agencies.map((agency) => {
                      const agencyKey = `${row.department}::${agency.agencyName}`;
                      const agencyExpanded = expandedNoIndicatorAgencies.has(agencyKey);

                      return (
                        <div key={agencyKey} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                          <button
                            type="button"
                            onClick={() => toggleNoIndicatorAgency(agencyKey)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left transition-colors duration-150 hover:bg-slate-100"
                            aria-expanded={agencyExpanded}
                          >
                            <span className="text-xs font-semibold text-slate-700">{agency.agencyName}</span>
                            <span className="inline-flex items-center gap-2">
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {agency.count}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500">
                                {agencyExpanded ? 'Hide projects' : 'Show projects'}
                              </span>
                            </span>
                          </button>

                          {agencyExpanded && (
                            <div className="mt-1 grid gap-1.5">
                              {agency.projects.map((project) => {
                                const projectKey = `${row.department}::${agency.agencyName}::${project.key}`;
                                const projectExpanded = expandedNoIndicatorProjects.has(projectKey);

                                return (
                                  <button
                                    key={project.key}
                                    type="button"
                                    onClick={() => toggleNoIndicatorProject(projectKey)}
                                    className="w-full rounded-md bg-white px-2.5 py-2 text-left text-xs text-slate-700 transition-colors duration-150 hover:bg-slate-100"
                                    aria-expanded={projectExpanded}
                                  >
                                    <span className="grid gap-1 sm:grid-cols-[130px_1fr_auto] sm:items-start sm:gap-2">
                                      <span className="font-mono font-semibold">{project.projectCode}</span>
                                      <span className={projectExpanded ? 'break-words' : 'line-clamp-1'}>
                                        {project.projectName}
                                      </span>
                                      <span className="text-[10px] font-medium text-slate-500 sm:text-right">
                                        {projectExpanded ? 'Collapse' : 'Show full'}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCompletedDialog} onOpenChange={setShowCompletedDialog}>
        <DialogContent className="max-h-[88vh] w-[96vw] max-w-5xl overflow-hidden p-0">
          <DialogHeader>
            <div className="border-b bg-emerald-50 px-5 py-4">
              <DialogTitle>Projects Completed - Department Breakdown</DialogTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {completedProjectCount} completed project(s) across departments.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Click administrative department and implementing department rows to drill down.
              </p>
            </div>
          </DialogHeader>
          <div className="max-h-[68vh] space-y-3 overflow-y-auto px-5 pb-5 pt-3">
            {completedByDepartment.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                No completed projects found.
              </div>
            ) : (
              completedByDepartment.map((row) => (
                <div key={row.department} className="rounded-xl border bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">{row.department}</p>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      {row.count} projects
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2">
                    {row.agencies.map((agency) => {
                      const agencyKey = `${row.department}::${agency.agencyName}`;
                      const agencyExpanded = expandedCompletedAgencies.has(agencyKey);

                      return (
                        <div key={agencyKey} className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                          <button
                            type="button"
                            onClick={() => toggleCompletedAgency(agencyKey)}
                            className="flex w-full items-center justify-between gap-2 rounded-md px-1 py-1.5 text-left transition-colors duration-150 hover:bg-slate-100"
                            aria-expanded={agencyExpanded}
                          >
                            <span className="text-xs font-semibold text-slate-700">{agency.agencyName}</span>
                            <span className="inline-flex items-center gap-2">
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                {agency.count}
                              </span>
                              <span className="text-[10px] font-medium text-slate-500">
                                {agencyExpanded ? 'Hide projects' : 'Show projects'}
                              </span>
                            </span>
                          </button>

                          {agencyExpanded && (
                            <div className="mt-1 grid gap-1.5">
                              {agency.projects.map((project) => {
                                const projectKey = `${row.department}::${agency.agencyName}::${project.key}`;
                                const projectExpanded = expandedCompletedProjects.has(projectKey);

                                return (
                                  <button
                                    key={project.key}
                                    type="button"
                                    onClick={() => toggleCompletedProject(projectKey)}
                                    className="w-full rounded-md bg-white px-2.5 py-2 text-left text-xs text-slate-700 transition-colors duration-150 hover:bg-slate-100"
                                    aria-expanded={projectExpanded}
                                  >
                                    <span className="grid gap-1 sm:grid-cols-[130px_1fr_auto] sm:items-start sm:gap-2">
                                      <span className="font-mono font-semibold">{project.projectCode}</span>
                                      <span className={projectExpanded ? 'break-words' : 'line-clamp-1'}>
                                        {project.projectName}
                                      </span>
                                      <span className="text-[10px] font-medium text-slate-500 sm:text-right">
                                        {projectExpanded ? 'Collapse' : 'Show full'}
                                      </span>
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function BandStat({
  title,
  count,
  tone,
}: {
  title: string;
  count: number;
  tone: 'slate' | 'rose' | 'orange' | 'amber' | 'blue' | 'emerald';
}) {
  const toneClass: Record<typeof tone, string> = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    blue: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass[tone]}`}>
      <div className="text-[11px] font-semibold tracking-wide">{title}</div>
      <div className="mt-1 text-2xl font-bold leading-none">{count}</div>
    </div>
  );
}

function BandRow({
  label,
  count,
  total,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[90px_1fr_64px] items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-right text-xs font-semibold text-foreground">
        {count} ({pct}%)
      </span>
    </div>
  );
}
