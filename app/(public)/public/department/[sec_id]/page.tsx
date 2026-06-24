'use client';

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  DepartmentPage,
  type DepartmentProject,
} from '@/components/public/DepartmentPage';
import { PublicNav } from '@/components/public/PublicNav';

// Public department detail at /public/department/[sec_id]. Fetches
// /api/public/department/[secId] on mount and renders the existing
// <DepartmentPage> component with the live data. The folder name uses
// snake_case (sec_id) to match the original /public/* scaffolding.

interface ApiResponse {
  department: {
    secId: number;
    nameMal: string;
    stats: {
      projects: number;
      completed: number;
      indicators: number;
      media: number;
    };
    projects: DepartmentProject[];
  };
}

export default function PublicDepartmentPage({
  params,
}: {
  params: Promise<{ sec_id: string }>;
}) {
  const { sec_id } = use(params);
  const id = Number(sec_id);

  const [data, setData] = useState<ApiResponse['department'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(id) || id <= 0) {
      setError('Invalid department id');
      return;
    }
    let cancelled = false;
    fetch(`/api/public/department/${id}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          throw new Error(b.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<ApiResponse>;
      })
      .then((j) => {
        if (!cancelled) setData(j.department);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-hdp-bg">
        <PublicNav />
        <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
          <div className="rounded-2xl border border-error-red/30 bg-error-red/5 p-8 text-center">
            <p className="font-malayalam text-sm font-semibold text-error-red">
              വകുപ്പ് വിവരങ്ങൾ ലോഡുചെയ്യാൻ കഴിഞ്ഞില്ല
            </p>
            <p className="mt-1 text-xs text-error-red/80">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col bg-hdp-bg">
        <PublicNav />
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-malayalam">വകുപ്പ് ലോഡുചെയ്യുന്നു…</span>
        </div>
      </div>
    );
  }

  return (
    <DepartmentPage
      secId={data.secId}
      nameMal={data.nameMal}
      stats={data.stats}
      projects={data.projects}
    />
  );
}
