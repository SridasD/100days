'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FilePenLine,
  FolderOpen,
  Loader2,
  ListFilter,
  Rows3,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AdminProject {
  projectId: number;
  projectPublicId: string | null;
  projectCode: string | null;
  projectName: string | null;
  projectNameMal: string | null;
  description: string | null;
  projectOutcome: string | null;
  projectCost: string | null;
  sectorId: number | null;
  sourceOfFundingId: number | null;
  sourceOfFundingName: string | null;
  isCompleted: number | null;
  stage: number | null;
  secId: number | null;
  secretaryName: string | null;
  departmentNames: string | null;
  indicatorsCount: number;
}

type ProjectStatus = 'completed' | 'in-progress' | 'not-started';

interface ArchivePreview {
  project: {
    projectId: number;
    projectCode: string;
    projectName: string;
    department: string;
    sector: string;
    district: string;
    projectStatus: string;
    createdDate: string | null;
    lastUpdated: string | null;
  };
  impact: {
    totalIndicators: number;
    verifiedIndicators: number;
    pendingVerification: number;
    imagesUploaded: number;
    documentsUploaded: number;
    videosUploaded: number;
    totalProgressUpdates: number;
  };
}

function AdminProjectsPageContent() {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archivePreview, setArchivePreview] = useState<ArchivePreview | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveCodeInput, setArchiveCodeInput] = useState('');
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [departmentSearch, setDepartmentSearch] = useState('');

  // Catch ?created=HDP-2026-NNNN from the form redirect and surface a toast.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isOsd = pathname.startsWith('/admin/osd');
  const projectsBasePath = isOsd ? '/admin/osd/projects' : '/admin/projects';
  const dashboardPath = isOsd ? '/admin/osd/project-performance-dashboard' : '/admin/dashboard';
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [archivedCode, setArchivedCode] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('created');
    const archived = searchParams.get('archived');
    if (code) {
      setCreatedCode(code);
    }
    if (archived) {
      setArchivedCode(archived);
    }
    if (code || archived) {
      // Strip the query params so the toasts don't reappear on refresh.
      const t = setTimeout(() => {
        router.replace(pathname);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [searchParams, router, pathname]);

  useEffect(() => {
    if (!createdCode) return;
    const t = setTimeout(() => setCreatedCode(null), 6000);
    return () => clearTimeout(t);
  }, [createdCode]);

  useEffect(() => {
    if (!archivedCode) return;
    const t = setTimeout(() => setArchivedCode(null), 6000);
    return () => clearTimeout(t);
  }, [archivedCode]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/projects', { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { projects: AdminProject[] };
        setProjects(json.projects);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const departmentOptions = useMemo(() => {
    return Array.from(
      new Set((projects ?? []).map((project) => project.secretaryName?.trim() || 'Unassigned')),
    ).sort((left, right) => left.localeCompare(right));
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (projects ?? []).filter((project) => {
      const status = deriveProjectStatus(project.isCompleted);
      const department = project.secretaryName?.trim() || 'Unassigned';
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (departmentFilter !== 'all' && department !== departmentFilter) return false;
      if (!term) return true;

      return [
        project.projectCode ?? '',
        project.projectName ?? '',
        project.projectNameMal ?? '',
        project.secretaryName ?? '',
        project.departmentNames ?? '',
        project.description ?? '',
        project.projectOutcome ?? '',
        project.sourceOfFundingName ?? '',
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [departmentFilter, projects, query, statusFilter]);

  const groupedProjects = useMemo(() => {
    const groups = new Map<string, AdminProject[]>();
    for (const project of filteredProjects) {
      const department = project.secretaryName?.trim() || 'Unassigned';
      const current = groups.get(department) ?? [];
      current.push(project);
      groups.set(department, current);
    }

    return Array.from(groups.entries())
      .map(([department, rows]) => ({
        department,
        rows: rows.sort((left, right) => Number(right.projectId) - Number(left.projectId)),
      }))
      .sort((left, right) => right.rows.length - left.rows.length || left.department.localeCompare(right.department));
  }, [filteredProjects]);

  const summary = useMemo(() => {
    const total = filteredProjects.length;
    const completed = filteredProjects.filter((project) => deriveProjectStatus(project.isCompleted) === 'completed').length;
    const inProgress = filteredProjects.filter((project) => deriveProjectStatus(project.isCompleted) === 'in-progress').length;
    const departments = new Set(filteredProjects.map((project) => project.secretaryName?.trim() || 'Unassigned')).size;

    return { total, completed, inProgress, departments };
  }, [filteredProjects]);

  const hasActiveFilters = query.trim() || statusFilter !== 'all' || departmentFilter !== 'all';

  useEffect(() => {
    if (departmentFilter === 'all') {
      setDepartmentSearch('');
      return;
    }
    setDepartmentSearch(departmentFilter);
  }, [departmentFilter]);

  const openArchiveDialog = async (project: AdminProject) => {
    setDeletingProjectId(project.projectId);
    setArchiveLoading(true);
    setArchivePreview(null);
    setArchiveCodeInput('');
    setArchiveReason('');
    setArchiveError(null);
    setError(null);
    setArchiveDialogOpen(true);

    try {
      const res = await fetch(`/api/admin/projects/${project.projectPublicId ?? project.projectId}/archive`, {
        cache: 'no-store',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setArchivePreview(body as ArchivePreview);
    } catch (e) {
      setArchiveDialogOpen(false);
      setError(e instanceof Error ? e.message : 'Failed to load archive preview');
    } finally {
      setArchiveLoading(false);
      setDeletingProjectId(null);
    }
  };

  const archiveProject = async () => {
    if (!archivePreview) return;
    setArchiveSubmitting(true);
    setArchiveError(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/projects/${archivePreview.project.projectId}/archive`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            confirmationCode: archiveCodeInput,
            reason: archiveReason.trim() || null,
          }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setArchiveDialogOpen(false);
      setProjects((prev) =>
        prev
          ? prev.filter((p) => p.projectId !== archivePreview.project.projectId)
          : prev,
      );
      router.replace(
        `${pathname}?archived=${encodeURIComponent(
          archivePreview.project.projectCode,
        )}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to archive project';
      setArchiveError(msg);
      setError(msg);
    } finally {
      setArchiveSubmitting(false);
    }
  };

  return (
    <main className="space-y-8">
      {createdCode && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success-green/30 bg-success-green/5 p-4"
        >
          <div className="flex items-center gap-2 text-sm text-success-green">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span>
              Project created.{' '}
              <span className="font-mono font-semibold">{createdCode}</span>{' '}
              is its official code — share with the nodal officer.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void navigator.clipboard.writeText(createdCode);
            }}
            className="cursor-pointer border-success-green/40 text-success-green hover:bg-success-green hover:text-white"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy code
          </Button>
        </div>
      )}

      {archivedCode && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-warning-amber/40 bg-warning-amber/10 p-4 text-sm text-warning-amber"
        >
          Project archived successfully.{' '}
          <span className="font-mono font-semibold">{archivedCode}</span> was
          {isOsd
            ? ' removed from the active portfolio. Archived records remain available to authorized technical administrators.'
            : ' removed from the active list and preserved in Project Archive.'}
          <div className="mt-2 flex items-center gap-2">
            {!isOsd && (
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/projects/archive">View Archived Projects</Link>
              </Button>
            )}
            <Button
              size="sm"
              className="bg-warning-amber text-white hover:bg-warning-amber/90"
              onClick={() => setArchivedCode(null)}
            >
              Return to Project List
            </Button>
          </div>
        </div>
      )}

      <section className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(247,249,252,1)_58%,rgba(241,246,240,1)_100%)] shadow-sm">
        <div className="flex flex-col items-start justify-between gap-4 p-6 md:flex-row md:items-center md:p-8">
          <div className="space-y-2">
            {isOsd ? (
              <Button
                asChild
                size="sm"
                className="group mb-2 rounded-full border border-success-green/30 bg-white text-success-green shadow-sm transition-all hover:-translate-y-0.5 hover:bg-success-green hover:text-white"
              >
                <Link href={dashboardPath}>
                  <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                  Return to Dashboard
                </Link>
              </Button>
            ) : null}
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
              <Rows3 className="h-3.5 w-3.5 text-success-green" />
              {isOsd ? 'Project Administration' : 'Master Project Registry'}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {isOsd ? 'Projects' : 'Master Projects'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isOsd
                  ? 'Create, review, edit, and archive active projects.'
                  : 'Manage all projects and their indicators'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isOsd && (
              <Button asChild variant="outline" className="cursor-pointer">
                <Link href="/admin/projects/archive">Archived Projects</Link>
              </Button>
            )}
            <Button asChild className="cursor-pointer">
              <Link href={`${projectsBasePath}/new`}>
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {!loading && !error && projects && projects.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Visible Projects" value={summary.total} note="After applying current filters" />
          <MetricCard title="Departments" value={summary.departments} note="Administrative groups represented" />
          <MetricCard title="In Progress" value={summary.inProgress} note="Projects actively underway" />
          <MetricCard title="Completed" value={summary.completed} note="Projects marked complete" />
        </section>
      )}

      {!loading && !error && projects && projects.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Search and Group Projects</CardTitle>
            <CardDescription>
              Search by code, project name, department, or description. Results are grouped by department for faster scanning.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1.5fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by code, project name, department, or description"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value: 'all' | ProjectStatus) => setStatusFilter(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="not-started">Not Started</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                value={departmentSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  setDepartmentSearch(value);

                  if (!value.trim()) {
                    setDepartmentFilter('all');
                    return;
                  }

                  const match = departmentOptions.find(
                    (department) => department.toLowerCase() === value.trim().toLowerCase(),
                  );
                  if (match) {
                    setDepartmentFilter(match);
                  }
                }}
                onBlur={() => {
                  const value = departmentSearch.trim();
                  if (!value) {
                    setDepartmentFilter('all');
                    return;
                  }

                  const match = departmentOptions.find(
                    (department) => department.toLowerCase() === value.toLowerCase(),
                  );
                  if (match) {
                    setDepartmentFilter(match);
                  }
                }}
                placeholder="Type to find a department"
                aria-label="Filter by department"
                list="department-filter-options"
              />
              <datalist id="department-filter-options">
                {departmentOptions.map((department) => (
                  <option key={department} value={department} />
                ))}
              </datalist>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={!hasActiveFilters}
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
                setDepartmentFilter('all');
                setDepartmentSearch('');
              }}
              className="gap-2"
            >
              <ListFilter className="h-4 w-4" />
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-4 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-error-red/30 bg-error-red/5">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-error-red" />
            <p className="text-sm text-error-red">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (!projects || projects.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FolderOpen className="h-7 w-7 text-muted-foreground" />
            <div>
              <p className="text-base font-semibold text-foreground">
                No projects found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first project to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && projects && projects.length > 0 && filteredProjects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <Search className="h-7 w-7 text-muted-foreground" />
            <div>
              <p className="text-base font-semibold text-foreground">No projects match the current filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Adjust the search term or filters to broaden the result set.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && groupedProjects.length > 0 && (
        <section className="space-y-5">
          {groupedProjects.map((group) => (
            <Card key={group.department} className="overflow-hidden shadow-sm">
              <CardHeader className="border-b bg-slate-50/80 pb-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <CardTitle className="text-xl">{group.department}</CardTitle>
                    <CardDescription>
                      {group.rows.length} {group.rows.length === 1 ? 'project' : 'projects'} in this department group.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{group.rows.reduce((sum, project) => sum + project.indicatorsCount, 0)} indicators</Badge>
                    <Badge variant="outline">{group.rows.filter((project) => deriveProjectStatus(project.isCompleted) === 'in-progress').length} in progress</Badge>
                    <Badge variant="outline">{group.rows.filter((project) => deriveProjectStatus(project.isCompleted) === 'completed').length} completed</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead className="text-center">Indicators</TableHead>
                        <TableHead className="w-[140px] text-center">Status</TableHead>
                        <TableHead className="text-right">Cost</TableHead>
                        <TableHead className="text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.rows.map((project) => (
                        <TableRow key={project.projectId}>
                          <TableCell className="font-mono text-sm leading-6">
                            {project.projectCode ?? '—'}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{project.projectName ?? 'Untitled Project'}</p>
                              {project.departmentNames ? (
                                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                  {project.departmentNames}
                                </p>
                              ) : null}
                              {project.sourceOfFundingName ? (
                                <p className="text-[11px] font-medium text-success-green/90">
                                  Funding: {project.sourceOfFundingName}
                                </p>
                              ) : null}
                              {project.description ? (
                                <p className="line-clamp-2 max-w-4xl text-xs leading-5 text-muted-foreground">
                                  {project.description}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="min-w-8 justify-center">
                              {project.indicatorsCount}
                            </Badge>
                          </TableCell>
                          <TableCell className="w-[140px] text-center">
                            <div className="flex justify-center">
                              <ProjectStatusBadge value={project.isCompleted} />
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {project.projectCost ? `₹${project.projectCost}` : '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center gap-2">
                              <Button
                                asChild
                                size="sm"
                                className="border border-success-green/35 bg-success-green/10 text-success-green hover:bg-success-green hover:text-white"
                              >
                                <Link href={`${projectsBasePath}/${project.projectPublicId ?? project.projectId}/edit`}>
                                  <FilePenLine className="h-3.5 w-3.5" />
                                  Edit
                                </Link>
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => void openArchiveDialog(project)}
                                disabled={deletingProjectId === project.projectId}
                                className="border border-warning-amber/45 bg-warning-amber/10 text-warning-amber hover:bg-warning-amber hover:text-white"
                              >
                                {deletingProjectId === project.projectId ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Archive className="h-3.5 w-3.5" />
                                )}
                                {deletingProjectId === project.projectId ? 'Loading...' : 'Archive'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Dialog
        open={archiveDialogOpen}
        onOpenChange={(open) => {
          if (!archiveSubmitting) setArchiveDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Archive Project</DialogTitle>
            <DialogDescription>
              This project will be removed from the active project list and moved
              to the Project Archive.
            </DialogDescription>
          </DialogHeader>

          {archiveLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project archive summary...
            </div>
          )}

          {!archiveLoading && archivePreview && (
            <div className="space-y-4">
              {archiveError && (
                <div className="rounded-md border border-error-red/30 bg-error-red/5 p-3 text-sm text-error-red">
                  {archiveError}
                </div>
              )}

              <Card>
                <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-2">
                  <p><span className="font-medium">Project Name:</span> {archivePreview.project.projectName}</p>
                  <p><span className="font-medium">Project Code:</span> <span className="font-mono">{archivePreview.project.projectCode}</span></p>
                  <p><span className="font-medium">Department:</span> {archivePreview.project.department}</p>
                  <p><span className="font-medium">Sector:</span> {archivePreview.project.sector}</p>
                  <p><span className="font-medium">District:</span> {archivePreview.project.district}</p>
                  <p><span className="font-medium">Project Status:</span> {archivePreview.project.projectStatus}</p>
                  <p><span className="font-medium">Created Date:</span> {archivePreview.project.createdDate ?? '—'}</p>
                  <p><span className="font-medium">Last Updated:</span> {archivePreview.project.lastUpdated ?? '—'}</p>
                </CardContent>
              </Card>

              <Card className="border-warning-amber/30 bg-warning-amber/5">
                <CardContent className="grid gap-2 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <p>Total Indicators: {archivePreview.impact.totalIndicators}</p>
                  <p>Verified Indicators: {archivePreview.impact.verifiedIndicators}</p>
                  <p>Pending Verification: {archivePreview.impact.pendingVerification}</p>
                  <p>Images Uploaded: {archivePreview.impact.imagesUploaded}</p>
                  <p>Documents Uploaded: {archivePreview.impact.documentsUploaded}</p>
                  <p>Videos Uploaded: {archivePreview.impact.videosUploaded}</p>
                  <p>Total Progress Updates: {archivePreview.impact.totalProgressUpdates}</p>
                </CardContent>
              </Card>

              <div className="rounded-md border border-error-red/40 bg-error-red/10 p-3 text-sm text-error-red">
                This action is permanent. All indicators, uploaded images, and
                documents for this project will be deleted and cannot be
                recovered — only the summary counts shown above are kept in
                the Project Archive. The project itself can still be restored
                to the active list, but its indicator data will not come
                back.
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type the project code to confirm:
                </label>
                <Input
                  value={archiveCodeInput}
                  onChange={(e) => setArchiveCodeInput(e.target.value)}
                  placeholder={archivePreview.project.projectCode}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Reason for Archive (optional)
                </label>
                <Input
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  placeholder="Administrative consolidation / superseded project / duplicate entry"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
              disabled={archiveSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void archiveProject()}
              disabled={
                archiveSubmitting ||
                archiveLoading ||
                !archivePreview ||
                archiveCodeInput !== archivePreview.project.projectCode
              }
              className="bg-warning-amber text-white hover:bg-warning-amber/90"
            >
              {archiveSubmitting ? 'Archiving...' : 'Archive Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function AdminProjectsPage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-8">
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading projects...</CardContent>
          </Card>
        </main>
      }
    >
      <AdminProjectsPageContent />
    </Suspense>
  );
}

function MetricCard({ title, value, note }: { title: string; value: number; note: string }) {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function deriveProjectStatus(value: number | null): ProjectStatus {
  switch (value) {
    case 2:
      return 'completed';
    case 1:
      return 'in-progress';
    default:
      return 'not-started';
  }
}

/**
 * Map hdp.master_projects.is_completed to a visible status pill.
 *
 *   0 (or NULL) → "Not Started" — red
 *   1          → "In Progress" — amber
 *   2          → "Completed"   — green
 *   anything else → echo the raw value so a misconfigured row is obvious
 */
function ProjectStatusBadge({ value }: { value: number | null }) {
  const meta = (() => {
    switch (value) {
      case 2:
        return {
          label: 'Completed',
          cls: 'border border-success-green/35 bg-success-green/10 text-success-green',
          dot: 'bg-success-green',
        };
      case 1:
        return {
          label: 'In Progress',
          cls: 'border border-warning-amber/45 bg-warning-amber/10 text-warning-amber',
          dot: 'bg-warning-amber',
        };
      case 0:
      case null:
      case undefined:
        return {
          label: 'Not Started',
          cls: 'border border-error-red/35 bg-error-red/10 text-error-red',
          dot: 'bg-error-red',
        };
      default:
        return {
          label: `Status ${value}`,
          cls: 'border border-border bg-muted/50 text-muted-foreground',
          dot: 'bg-muted-foreground',
        };
    }
  })();
  return (
    <Badge
      className={`inline-flex min-w-[112px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${meta.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
      {meta.label}
    </Badge>
  );
}
