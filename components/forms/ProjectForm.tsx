'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, CheckCircle2, Loader2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Master-data shape returned by GET /api/admin/master
// ---------------------------------------------------------------------------
interface MasterData {
  secretaries: { sec_id: number; secretary_name: string | null }[];
  sectors: { sector_id: number; sector_name: string | null }[];
}

// ---------------------------------------------------------------------------
// Form schema (mirrors POST /api/admin/projects body)
// ---------------------------------------------------------------------------
const formSchema = z.object({
  project_name: z.string().min(3, 'Required (min 3 chars)').max(500),
  description: z.string().min(1, 'Required'),
  is_new: z.coerce.number().int().min(0).max(1),
  project_cost: z.coerce.number().min(0).optional(),
  nature_of_project: z.coerce.number().int().min(1).max(2),
  priority: z.coerce.number().int().min(1).max(3),
  project_execution_type: z.coerce.number().int().min(1).max(2),
  is_completed: z.coerce.number().int().min(0).max(2),
  completion_date: z.string().optional(),
  sector_id: z.coerce.number().int().positive('Select a sector'),
  // One or more administrative departments
  sec_ids: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Select at least one department'),
  no_days_employed_direct: z.coerce.number().int().min(0).default(0),
  no_persons_employed_direct: z.coerce.number().int().min(0).default(0),
  no_days_employed_indirect: z.coerce.number().int().min(0).default(0),
  no_persons_employed_indirect: z.coerce.number().int().min(0).default(0),
  other_benefits: z.string().optional(),
  govt_policy_linkage: z.string().optional(),
  manifesto_linkage: z.string().optional(),
  extra_one: z.string().optional(),
  extra_two: z.string().optional(),
  extra_three: z.string().optional(),
}).superRefine((d, ctx) => {
  // Completion date is required iff Project Status is Completed (is_completed = 2)
  if (d.is_completed === 2 && (!d.completion_date || !d.completion_date.trim())) {
    ctx.addIssue({
      code: 'custom',
      path: ['completion_date'],
      message: 'Required when status is Completed',
    });
  }
});

export type ProjectFormValues = z.infer<typeof formSchema>;

interface Props {
  /** When provided, the form runs in edit mode (PATCH /api/admin/projects/[id]). */
  projectId?: number;
  defaults?: Partial<ProjectFormValues>;
  /** Where to redirect after a successful save. */
  redirectTo?: string;
}

export function ProjectForm({ projectId, defaults, redirectTo = '/admin/projects' }: Props) {
  const router = useRouter();
  const isEdit = !!projectId;

  const [master, setMaster] = useState<MasterData | null>(null);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [deptSearch, setDeptSearch] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_name: defaults?.project_name ?? '',
      description: defaults?.description ?? '',
      is_new: defaults?.is_new ?? 1,
      project_cost: defaults?.project_cost ?? 0,
      nature_of_project: defaults?.nature_of_project ?? 2,
      priority: defaults?.priority ?? 2,
      project_execution_type: defaults?.project_execution_type ?? 1,
      is_completed: defaults?.is_completed ?? 0,
      completion_date: defaults?.completion_date ?? '',
      sector_id: defaults?.sector_id ?? 0,
      sec_ids: defaults?.sec_ids ?? [],
      no_days_employed_direct: defaults?.no_days_employed_direct ?? 0,
      no_persons_employed_direct: defaults?.no_persons_employed_direct ?? 0,
      no_days_employed_indirect: defaults?.no_days_employed_indirect ?? 0,
      no_persons_employed_indirect: defaults?.no_persons_employed_indirect ?? 0,
      other_benefits: defaults?.other_benefits ?? '',
      govt_policy_linkage: defaults?.govt_policy_linkage ?? '',
      manifesto_linkage: defaults?.manifesto_linkage ?? '',
      extra_one: defaults?.extra_one ?? '',
      extra_two: defaults?.extra_two ?? '',
      extra_three: defaults?.extra_three ?? '',
    },
    mode: 'onTouched',
  });

  const selectedSecIds = (watch('sec_ids') ?? []) as number[];
  const isCompletedStatus = Number(watch('is_completed')) === 2;

  // When the admin flips status away from "Completed", clear the date so a
  // stale value doesn't get submitted.
  useEffect(() => {
    if (!isCompletedStatus) {
      setValue('completion_date', '', {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [isCompletedStatus, setValue]);

  useEffect(() => {
    fetch('/api/admin/master', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setMaster(j))
      .catch((e) => setMasterError(e.message));
  }, []);

  const onValid = (values: ProjectFormValues) => {
    setServerError(null);
    startTransition(async () => {
      try {
        const url = isEdit
          ? `/api/admin/projects/${projectId}`
          : '/api/admin/projects';
        const res = await fetch(url, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const debug = body.debug
            ? `\nDB: ${body.debug.message ?? ''}${
                body.debug.detail ? ' · ' + body.debug.detail : ''
              }${body.debug.column ? ' · column: ' + body.debug.column : ''}${
                body.debug.constraint
                  ? ' · constraint: ' + body.debug.constraint
                  : ''
              }`
            : '';
          throw new Error((body.error ?? `HTTP ${res.status}`) + debug);
        }
        // Surface the new HDP-2026-NNNN code to the admin so they can copy
        // it before navigating away. We append `?created=<code>` to the
        // redirect URL — the projects list page can pick it up and toast.
        if (!isEdit) {
          try {
            const body = (await res.json()) as { projectCode?: string };
            const code = body?.projectCode;
            if (code) {
              const sep = redirectTo.includes('?') ? '&' : '?';
              router.push(
                `${redirectTo}${sep}created=${encodeURIComponent(code)}`,
              );
              router.refresh();
              return;
            }
          } catch {
            /* fall through to plain redirect */
          }
        }
        router.push(redirectTo);
        router.refresh();
      } catch (e) {
        setServerError(e instanceof Error ? e.message : 'Save failed');
      }
    });
  };

  if (!master && !masterError) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading form…
      </div>
    );
  }
  if (masterError) {
    return (
      <Card className="border-error-red/30 bg-error-red/5">
        <CardContent className="flex items-center gap-2 py-6 text-sm text-error-red">
          <AlertTriangle className="h-4 w-4" />
          {masterError}
        </CardContent>
      </Card>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="space-y-6"
      noValidate
      aria-label={isEdit ? 'Edit project' : 'New project'}
    >
      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-3 text-sm text-error-red">
          <AlertTriangle className="h-4 w-4" />
          {serverError}
        </div>
      )}

      {/* PROJECT BASICS */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Project basics
          </h2>

          <Field label="Project Name" required error={errors.project_name?.message}>
            <Input {...register('project_name')} />
          </Field>

          <Field label="Description" required error={errors.description?.message}>
            <Textarea rows={3} {...register('description')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Project Type" required>
              <select {...register('is_new')} className={selectClass}>
                <option value={1}>New</option>
                <option value={0}>Continuing</option>
              </select>
            </Field>
            <Field label="Total Project Cost (₹ Lakhs)">
              <Input
                type="number"
                step="0.01"
                min={0}
                {...register('project_cost')}
              />
            </Field>
            <Field label="Project Status" required>
              <select {...register('is_completed')} className={selectClass}>
                <option value={0}>Not Started</option>
                <option value={1}>In Progress</option>
                <option value={2}>Completed</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nature of project" required>
              <select {...register('nature_of_project')} className={selectClass}>
                <option value={1}>ഉപജീവനം / Livelihood</option>
                <option value={2}>പശ്ചാത്തല സൗകര്യം / Infrastructure</option>
              </select>
            </Field>
            <Field label="Project Impact" required>
              <select {...register('priority')} className={selectClass}>
                <option value={1}>സംസ്ഥാനതലം / State</option>
                <option value={2}>ജില്ലാതലം / District</option>
                <option value={3}>ഉപജില്ലാതലം / Sub-district</option>
              </select>
            </Field>
            <Field label="Project execution type" required>
              <select
                {...register('project_execution_type')}
                className={selectClass}
              >
                <option value={1}>പദ്ധതി പൂർത്തികരണം / Completion</option>
                <option value={2}>നിർമ്മാണ ഉദ്ഘാടനം / Inauguration</option>
              </select>
            </Field>
          </div>

          <Field
            label={`Administrative departments — ${selectedSecIds.length} selected`}
            required
            error={errors.sec_ids?.message as string}
          >
            <DepartmentMultiSelect
              secretaries={master?.secretaries ?? []}
              selected={selectedSecIds}
              search={deptSearch}
              onSearchChange={setDeptSearch}
              onToggle={(id) => {
                const next = selectedSecIds.includes(id)
                  ? selectedSecIds.filter((x) => x !== id)
                  : [...selectedSecIds, id];
                setValue('sec_ids', next, { shouldValidate: true, shouldDirty: true });
              }}
              onClear={() =>
                setValue('sec_ids', [], { shouldValidate: true, shouldDirty: true })
              }
            />
            {/* Keep the field registered so Zod validation runs */}
            <input type="hidden" {...register('sec_ids')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sector" required error={errors.sector_id?.message}>
              <select {...register('sector_id')} className={selectClass}>
                <option value={0}>— Select —</option>
                {master?.sectors.map((s) => (
                  <option key={s.sector_id} value={s.sector_id}>
                    {s.sector_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Completed Date"
              required={isCompletedStatus}
              error={errors.completion_date?.message as string}
            >
              <Input
                type="date"
                disabled={!isCompletedStatus}
                aria-disabled={!isCompletedStatus}
                className={cn(
                  !isCompletedStatus && 'cursor-not-allowed opacity-60',
                  isCompletedStatus &&
                    'border-success-green/40 ring-1 ring-success-green/20',
                )}
                {...register('completion_date')}
              />
              <p
                className={cn(
                  'text-[11px]',
                  isCompletedStatus
                    ? 'font-medium text-success-green'
                    : 'text-muted-foreground',
                )}
              >
                {isCompletedStatus
                  ? '✓ Enabled — select the date the project was completed.'
                  : 'Available only when Project Status is set to "Completed".'}
              </p>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* EMPLOYMENT */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Employment opportunity
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Direct (Man Days)">
              <Input type="number" min={0} {...register('no_days_employed_direct')} />
            </Field>
            <Field label="Direct (Persons)">
              <Input type="number" min={0} {...register('no_persons_employed_direct')} />
            </Field>
            <Field label="Indirect (Man Days)">
              <Input
                type="number"
                min={0}
                {...register('no_days_employed_indirect')}
              />
            </Field>
            <Field label="Indirect (Persons)">
              <Input
                type="number"
                min={0}
                {...register('no_persons_employed_indirect')}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ADDITIONAL */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Additional information
          </h2>
          <Field label="Other benefits"><Textarea rows={2} {...register('other_benefits')} /></Field>
          <Field label="Linkage with Govt. policy"><Textarea rows={2} {...register('govt_policy_linkage')} /></Field>
          <Field label="Linkage with Manifesto"><Textarea rows={2} {...register('manifesto_linkage')} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Extra 1"><Textarea rows={2} {...register('extra_one')} /></Field>
            <Field label="Extra 2"><Textarea rows={2} {...register('extra_two')} /></Field>
            <Field label="Extra 3"><Textarea rows={2} {...register('extra_three')} /></Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending}
          className="cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
        >
          {pending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4" /> {isEdit ? 'Save changes' : 'Create project'}</>
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Small field wrapper
// ---------------------------------------------------------------------------
const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

// ---------------------------------------------------------------------------
// Multi-select panel for administrative departments
// ---------------------------------------------------------------------------
function DepartmentMultiSelect({
  secretaries,
  selected,
  search,
  onSearchChange,
  onToggle,
  onClear,
}: {
  secretaries: { sec_id: number; secretary_name: string | null }[];
  selected: number[];
  search: string;
  onSearchChange: (s: string) => void;
  onToggle: (secId: number) => void;
  onClear: () => void;
}) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? secretaries.filter((s) =>
        (s.secretary_name ?? '').toLowerCase().includes(q),
      )
    : secretaries;

  const selectedSet = new Set(selected);
  const selectedLabels = secretaries
    .filter((s) => selectedSet.has(s.sec_id))
    .map((s) => ({ id: s.sec_id, name: s.secretary_name ?? `#${s.sec_id}` }));

  return (
    <div className="space-y-2">
      {/* Selected chips */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/30 p-2">
          {selectedLabels.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1 rounded-full bg-[#2E7D32] px-2 py-0.5 text-[11px] font-medium text-white"
            >
              {s.name}
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                aria-label={`Remove ${s.name}`}
                className="rounded-full p-0.5 transition-colors duration-150 hover:bg-white/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-[11px] font-medium text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Search + checkbox list */}
      <div className="overflow-hidden rounded-md border">
        <div className="relative border-b bg-muted/20">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`Search ${secretaries.length} departments…`}
            className="h-9 border-0 bg-transparent pl-8 text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No departments match &quot;{search}&quot;
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((s) => {
                const isOn = selectedSet.has(s.sec_id);
                return (
                  <li key={s.sec_id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors duration-150 hover:bg-muted/40',
                        isOn && 'bg-[#2E7D32]/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => onToggle(s.sec_id)}
                        className="h-4 w-4 cursor-pointer accent-[#2E7D32]"
                      />
                      <span className={cn(isOn && 'font-medium')}>
                        {s.secretary_name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="ml-0.5 text-error-red">*</span>}
      </Label>
      {children}
      {error && (
        <p role="alert" className={cn('text-xs font-medium text-error-red')}>
          {error}
        </p>
      )}
    </div>
  );
}
