'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ProjectForm,
  type ProjectFormValues,
} from '@/components/forms/ProjectForm';

interface ApiProject {
  projectId: number;
  projectPublicId: string;
  projectCode: string | null;
  projectNameMal: string;
  projectName: string;
  description: string;
  projectOutcome: string;
  isNew: number;
  projectCost: number;
  sectorId: number | null;
  sourceOfFundingId: number | null;
  natureOfProject: number | null;
  priority: number | null;
  projectExecutionType: number | null;
  isCompleted: number;
  completionDate: string | null;
  noDaysEmployedDirect: number;
  noPersonsEmployedDirect: number;
  noDaysEmployedIndirect: number;
  noPersonsEmployedIndirect: number;
  otherBenefits: string;
  govtPolicyLinkage: string;
  manifestoLinkage: string;
  extraOne: string;
  extraTwo: string;
  extraThree: string;
  secId: number | null;
  deptIds: number[];
  departmentNames: string[];
}

export default function AdminProjectEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectRef = String(params.id ?? '').trim();

  const [data, setData] = useState<ApiProject | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectRef) return;
    fetch(`/api/admin/projects/${projectRef}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ project: ApiProject }>;
      })
      .then((j) => setData(j.project))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [projectRef]);

  useEffect(() => {
    if (data?.projectPublicId && data.projectPublicId !== projectRef) {
      router.replace(`/admin/projects/${data.projectPublicId}/edit`);
    }
  }, [data?.projectPublicId, projectRef, router]);

  const defaults: Partial<ProjectFormValues> | undefined = data
    ? {
      project_name: data.projectName,
      description: data.description,
      is_new: data.isNew,
      project_cost: data.projectCost,
      nature_of_project: data.natureOfProject ?? 2,
      priority: data.priority ?? 2,
      source_of_funding_id: data.sourceOfFundingId ?? 0,
      project_execution_type: data.projectExecutionType ?? 1,
      is_completed: data.isCompleted,
      completion_date: data.completionDate
        ? data.completionDate.slice(0, 10)
        : '',
      sector_id: data.sectorId ?? 0,
      sec_id: data.secId ?? 0,
      dept_ids: data.deptIds ?? [],
      no_days_employed_direct: data.noDaysEmployedDirect,
      no_persons_employed_direct: data.noPersonsEmployedDirect,
      no_days_employed_indirect: data.noDaysEmployedIndirect,
      no_persons_employed_indirect: data.noPersonsEmployedIndirect,
      project_outcome: data.projectOutcome ?? '',
      other_benefits: data.otherBenefits ?? '',
      govt_policy_linkage: data.govtPolicyLinkage ?? '',
      manifesto_linkage: data.manifestoLinkage ?? '',
      extra_one: data.extraOne ?? '',
      extra_two: data.extraTwo ?? '',
      extra_three: data.extraThree ?? '',
    }
    : undefined;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit Project{data?.projectCode ? ` · ${data.projectCode}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update master project details and reassign departments if needed.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="cursor-pointer">
          <Link href="/admin/projects">
            <ArrowLeft className="h-4 w-4" />
            Back to projects
          </Link>
        </Button>
      </div>

      {error && (
        <Card className="border-error-red/30 bg-error-red/5">
          <CardContent className="flex items-center gap-2 py-6 text-sm text-error-red">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {!error && !data && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading project…
        </div>
      )}

      {data && <ProjectForm projectId={projectRef} defaults={defaults} />}
    </main>
  );
}
