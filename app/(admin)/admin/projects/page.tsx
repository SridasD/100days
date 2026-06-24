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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catch ?created=HDP-2026-NNNN from the form redirect and surface a toast.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [createdCode, setCreatedCode] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('created');
    if (code) {
      setCreatedCode(code);
      // Strip the query param so the toast doesn't reappear on refresh.
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

      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Master Projects
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage all projects and their indicators
          </p>
        </div>
        <Button asChild className="cursor-pointer">
          <Link href="/admin/projects/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
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
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/projects/${project.projectId}/edit`}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
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
