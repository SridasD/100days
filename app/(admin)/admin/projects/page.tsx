'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Plus,
  AlertTriangle,
  CheckCircle2,
  Copy,
  FolderOpen,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
  projectCode: string | null;
  projectName: string | null;
  projectNameMal: string | null;
  description: string | null;
  projectCost: string | null;
  sectorId: number | null;
  isCompleted: number | null;
  stage: number | null;
  secId: number | null;
  secretaryName: string | null;
  indicatorsCount: number;
}

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

export default function AdminProjectsPage() {
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

  // Catch ?created=HDP-2026-NNNN from the form redirect and surface a toast.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
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
      const res = await fetch(`/api/admin/projects/${project.projectId}/archive`, {
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
          removed from the active list and preserved in Project Archive.
          <div className="mt-2 flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/projects/archive">View Archived Projects</Link>
            </Button>
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

      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Master Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage all projects and their indicators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/admin/projects/archive">Archived Projects</Link>
          </Button>
          <Button asChild className="cursor-pointer">
            <Link href="/admin/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

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

      {!loading && !error && projects && projects.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Secretary</TableHead>
                <TableHead>Indicators</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cost</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.projectId}>
                  <TableCell className="font-mono text-sm">
                    {project.projectCode}
                  </TableCell>
                  <TableCell className="font-medium">
                    {project.projectName}
                  </TableCell>
                  <TableCell className="text-sm">
                    {project.secretaryName ?? '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">
                      {project.indicatorsCount}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ProjectStatusBadge value={project.isCompleted} />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {project.projectCost ? `₹${project.projectCost}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/admin/projects/${project.projectId}/edit`}>
                          Edit
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void openArchiveDialog(project)}
                        disabled={deletingProjectId === project.projectId}
                        className="border-warning-amber/40 text-warning-amber hover:bg-warning-amber hover:text-white"
                      >
                        {deletingProjectId === project.projectId
                          ? 'Loading...'
                          : 'Archive'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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

              <div className="rounded-md border border-warning-amber/40 bg-warning-amber/10 p-3 text-sm text-warning-amber">
                All associated project history, indicators, progress updates,
                uploaded documents, media files, and audit records will be
                preserved. Archived projects can only be viewed or restored by
                authorized users.
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
        return { label: 'Completed', cls: 'bg-success-green/90 text-white' };
      case 1:
        return { label: 'In Progress', cls: 'bg-warning-amber/90 text-white' };
      case 0:
      case null:
      case undefined:
        return {
          label: 'Not Started',
          cls: 'bg-error-red/90 text-white',
        };
      default:
        return {
          label: `Status ${value}`,
          cls: 'bg-muted text-muted-foreground',
        };
    }
  })();
  return <Badge className={meta.cls}>{meta.label}</Badge>;
}
