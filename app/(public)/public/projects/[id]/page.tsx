'use client';

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ProjectDetailPage,
  type PublicProject,
} from '@/components/public/ProjectDetailPage';
import { PublicNav } from '@/components/public/PublicNav';

// Public project detail at /public/projects/[id]. Fetches
// /api/public/project/[projectId] and renders <ProjectDetailPage>.

export default function PublicProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = Number(id);

  const [project, setProject] = useState<PublicProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(projectId) || projectId <= 0) {
      setError('Invalid project id');
      return;
    }
    let cancelled = false;
    fetch(`/api/public/project/${projectId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ project: PublicProject }>;
      })
      .then((j) => {
        if (!cancelled) setProject(j.project);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-hdp-bg">
        <PublicNav />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
          <div className="rounded-2xl border border-error-red/30 bg-error-red/5 p-8 text-center">
            <p className="font-malayalam text-sm font-semibold text-error-red">
              പദ്ധതി വിവരങ്ങൾ ലോഡുചെയ്യാൻ കഴിഞ്ഞില്ല
            </p>
            <p className="mt-1 text-xs text-error-red/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen flex-col bg-hdp-bg">
        <PublicNav />
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-malayalam">പദ്ധതി ലോഡുചെയ്യുന്നു…</span>
        </div>
      </div>
    );
  }

  return <ProjectDetailPage project={project} />;
}
