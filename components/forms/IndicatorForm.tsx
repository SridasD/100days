'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  IndianRupee,
  Info,
  Loader2,
  MapPin,
  Search,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Master-data shape returned by GET /api/officer/master
// ---------------------------------------------------------------------------
interface District {
  district_id: number;
  district_name: string | null;
}
interface Beneficiary {
  beneficiary_id: number;
  beneficiary_name: string | null;
}
interface LocalBodyType {
  localbody_type_id: number;
  localbody_type_name: string | null;
}
interface LocalBody {
  localbody_id: number;
  localbody_name: string | null;
  localbody_type_id: number | null;
  district_id: number | null;
}
interface MasterData {
  districts: District[];
  beneficiaries: Beneficiary[];
  localBodyTypes: LocalBodyType[];
  localBodies: LocalBody[];
}

interface ProjectBudget {
  projectName: string;
  projectCost: number;
  indicatorsTotal: number;
  totalAllocated: number;
  balance: number;
}

const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// District id `0` and Local body type id `0` are reserved sentinels meaning "All".
const ALL = 0;

// Fixed unit options (kept in sync with the legacy form).
const UNIT_OPTIONS = [
  'Percentage',
  'Numbers',
  'Kg',
  'Hectares',
  'Litres',
  'Units',
  'Meters',
  'Square Meters',
];

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const formSchema = z
  .object({
    indicator_name: z.string().min(3, 'Required (min 3 chars)').max(255),
    unit: z.string().min(1, 'Select a unit').max(15),
    physical_target: z.coerce.number().min(0, 'Required'),
    financial_target: z.coerce.number().min(0, 'Required'),
    district_id: z.coerce.number().int().min(0), // 0 = All
    local_body_type_id: z.coerce.number().int().min(0).default(0),
    local_body_ids: z.array(z.coerce.number().int().positive()).default([]),
    beneficiary_ids: z
      .array(z.coerce.number().int().positive())
      .default([]),
    latitude: z.coerce.number().optional().nullable(),
    longitude: z.coerce.number().optional().nullable(),
  })
  .superRefine((d, ctx) => {
    // If a specific district and a specific local-body type are chosen, at
    // least one local body must be picked.
    if (
      d.district_id > 0 &&
      d.local_body_type_id > 0 &&
      d.local_body_ids.length === 0
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['local_body_ids'],
        message: 'Select one or more local bodies (or set Local Body Type to All)',
      });
    }
  });

export type IndicatorFormValues = z.infer<typeof formSchema>;

interface Props {
  projectId: number;
  /**
   * When supplied the form runs in EDIT mode:
   *   - GETs the existing indicator and pre-fills every field
   *   - submits via PATCH /api/officer/indicators/{id}
   *   - locks every field if the row has been verified
   *
   * When omitted the form runs in CREATE mode (the original behaviour).
   */
  indicatorId?: number;
}

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function IndicatorForm({ projectId, indicatorId }: Props) {
  const router = useRouter();
  const isEdit = Number.isFinite(indicatorId) && (indicatorId ?? 0) > 0;

  const [master, setMaster] = useState<MasterData | null>(null);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [budget, setBudget] = useState<ProjectBudget | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** Edit-mode lock state — true once the row has a verified_date. */
  const [locked, setLocked] = useState(false);
  /** Tracks whether the edit GET has hydrated the form, so we don't run
   *  the "downstream resets on district change" effect during prefill. */
  const [prefilled, setPrefilled] = useState(!isEdit);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<IndicatorFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      indicator_name: '',
      unit: '',
      physical_target: 0,
      financial_target: 0,
      district_id: ALL,
      local_body_type_id: ALL,
      local_body_ids: [],
      beneficiary_ids: [],
      latitude: undefined,
      longitude: undefined,
    },
    mode: 'onTouched',
  });

  // ----------------------- edit: prefill from API ------------------------
  useEffect(() => {
    if (!isEdit) return;
    fetch(`/api/officer/indicators/${indicatorId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(
        (j: {
          indicator: {
            indicatorName: string;
            unit: string;
            districtId: number;
            physicalTarget: number;
            financialTarget: number;
            physicalDescription: string;
            localBodyTypeId: number;
            localBodyIds: number[];
            beneficiaryIds: number[];
            latitude: number | null;
            longitude: number | null;
            isVerified: boolean;
          };
        }) => {
          const i = j.indicator;
          // Reset the entire form atomically so cascade reset effects don't
          // wipe local_body_ids and beneficiary_ids during prefill.
          reset({
            indicator_name: i.indicatorName ?? '',
            unit: i.unit ?? '',
            physical_target: i.physicalTarget ?? 0,
            financial_target: i.financialTarget ?? 0,
            district_id: i.districtId || ALL,
            local_body_type_id: i.localBodyTypeId || ALL,
            local_body_ids: i.localBodyIds ?? [],
            beneficiary_ids: i.beneficiaryIds ?? [],
            latitude: i.latitude ?? undefined,
            longitude: i.longitude ?? undefined,
          });
          setLocked(i.isVerified);
          setPrefilled(true);
        },
      )
      .catch((e) =>
        setServerError(e instanceof Error ? e.message : 'Failed to load'),
      );
  }, [isEdit, indicatorId, reset]);

  // -------------------------- master & budget --------------------------
  useEffect(() => {
    fetch('/api/officer/master', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((j) => setMaster(j))
      .catch((e) => setMasterError(e.message));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/officer/projects/${projectId}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{
          project: {
            projectName: string;
            projectCost: number;
            indicatorsTotal: number;
            totalAllocated: number;
            balance: number;
          };
        }>;
      })
      .then((j) =>
        setBudget({
          projectName: j.project.projectName ?? '',
          projectCost: j.project.projectCost ?? 0,
          indicatorsTotal: j.project.indicatorsTotal ?? 0,
          totalAllocated: j.project.totalAllocated ?? 0,
          balance: j.project.balance ?? 0,
        }),
      )
      .catch((e) => setBudgetError(e.message));
  }, [projectId]);

  // ------------------------- cascade dependents ------------------------
  const districtId = Number(watch('district_id')) || ALL;
  const localBodyTypeId = Number(watch('local_body_type_id')) || ALL;
  const localBodyIds = (watch('local_body_ids') ?? []) as number[];
  const beneficiaryIds = (watch('beneficiary_ids') ?? []) as number[];

  // Reset downstream when the user CHANGES an upstream field.
  // Skipped until the form is prefilled in edit mode so we don't wipe the
  // existing selections during the initial hydration pass.
  useEffect(() => {
    if (!prefilled) return;
    setValue('local_body_type_id', ALL, { shouldDirty: false });
    setValue('local_body_ids', [], { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtId]);

  useEffect(() => {
    if (!prefilled) return;
    setValue('local_body_ids', [], { shouldDirty: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBodyTypeId]);

  // Filtered local bodies for the chosen district + type
  const filteredLocalBodies = useMemo(() => {
    if (!master) return [];
    if (districtId === ALL || localBodyTypeId === ALL) return [];
    return master.localBodies.filter(
      (lb) =>
        lb.district_id === districtId &&
        lb.localbody_type_id === localBodyTypeId,
    );
  }, [master, districtId, localBodyTypeId]);

  // ----------------------------- budget hint ---------------------------
  const enteredFinancial = Number(watch('financial_target')) || 0;
  const budgetState = useMemo(() => {
    if (!budget) return null;
    const remainingAfter = budget.balance - enteredFinancial;
    const exceeds = enteredFinancial > budget.balance + 0.001;
    const pctUsedBefore =
      budget.projectCost > 0
        ? Math.min(100, (budget.totalAllocated / budget.projectCost) * 100)
        : 0;
    const pctUsedAfter =
      budget.projectCost > 0
        ? Math.min(
            100,
            ((budget.totalAllocated + enteredFinancial) / budget.projectCost) *
              100,
          )
        : 0;
    return { remainingAfter, exceeds, pctUsedBefore, pctUsedAfter };
  }, [budget, enteredFinancial]);

  // ------------------------------- submit ------------------------------
  const onValid = (values: IndicatorFormValues) => {
    setServerError(null);

    // Enforce cascade semantics one more time at the boundary —
    // even if state lagged, "All" upstream means empty downstream.
    const districtIsAll = !values.district_id || values.district_id === ALL;
    const lbtIsAll =
      districtIsAll ||
      !values.local_body_type_id ||
      values.local_body_type_id === ALL;

    const payload = {
      ...values,
      // Server uses NULL for the "All" sentinels.
      district_id: districtIsAll ? null : values.district_id,
      local_body_type_id: lbtIsAll ? null : values.local_body_type_id,
      // When LBT = All (or upstream District = All), we never store any
      // specific local bodies — the indicator applies to everything.
      local_body_ids: lbtIsAll ? [] : values.local_body_ids,
    };

    startTransition(async () => {
      try {
        const url = isEdit
          ? `/api/officer/indicators/${indicatorId}`
          : `/api/officer/projects/${projectId}/indicators`;
        const res = await fetch(url, {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const debug = body.debug
            ? `\nDB: ${body.debug.message ?? ''}${
                body.debug.detail ? ' · ' + body.debug.detail : ''
              }${body.debug.column ? ' · column: ' + body.debug.column : ''}`
            : '';
          throw new Error((body.error ?? `HTTP ${res.status}`) + debug);
        }
        router.push(
          `/officer/projects/${projectId}/indicators?${
            isEdit ? 'edited' : 'created'
          }=1`,
        );
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
      aria-label={isEdit ? 'Edit indicator' : 'Add new indicator'}
    >
      {/* Single fieldset wraps the live form so `locked` disables every
          control — including the multi-select panels — without touching
          each input individually. */}
      <fieldset disabled={locked} className="contents">
      {serverError && (
        <div className="flex items-start gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-3 text-sm text-error-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <pre className="whitespace-pre-wrap font-sans">{serverError}</pre>
        </div>
      )}

      {/* PROJECT BUDGET CONTEXT */}
      {budgetError ? (
        <div className="flex items-center gap-2 rounded-lg border border-warning-amber/30 bg-warning-amber/10 p-3 text-xs text-warning-amber">
          <Info className="h-4 w-4" />
          Could not load project budget: {budgetError}
        </div>
      ) : !budget ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading project budget…
        </div>
      ) : (
        <Card className="border-l-4 border-l-[#2E7D32] shadow-sm">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Wallet className="h-4 w-4 text-[#2E7D32]" aria-hidden />
                {budget.projectName || 'Project budget'}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {budget.indicatorsTotal} existing{' '}
                {budget.indicatorsTotal === 1 ? 'indicator' : 'indicators'}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <BudgetStat
                label="Total project cost"
                value={budget.projectCost}
                tone="muted"
              />
              <BudgetStat
                label="Already allocated"
                value={budget.totalAllocated}
                tone="info"
              />
              <BudgetStat
                label="Available balance"
                value={budget.balance}
                tone={budget.balance > 0 ? 'success' : 'error'}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Allocation against project cost</span>
                <span className="font-mono">
                  {budgetState
                    ? `${budgetState.pctUsedBefore.toFixed(1)}% used`
                    : '—'}
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 bg-kerala-blue/60 transition-all duration-300"
                  style={{ width: `${budgetState?.pctUsedBefore ?? 0}%` }}
                />
                {budgetState && enteredFinancial > 0 && (
                  <div
                    className={cn(
                      'absolute inset-y-0 transition-all duration-300',
                      budgetState.exceeds
                        ? 'bg-error-red/80'
                        : 'bg-success-green/80',
                    )}
                    style={{
                      left: `${budgetState.pctUsedBefore}%`,
                      width: `${
                        budgetState.pctUsedAfter - budgetState.pctUsedBefore
                      }%`,
                    }}
                  />
                )}
              </div>
            </div>
            {budgetState && enteredFinancial > 0 && (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-md p-2.5 text-xs',
                  budgetState.exceeds
                    ? 'border border-error-red/30 bg-error-red/5 text-error-red'
                    : 'border border-success-green/30 bg-success-green/5 text-success-green',
                )}
              >
                {budgetState.exceeds ? (
                  <>
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      <span className="font-semibold">
                        Exceeds available balance by ₹{' '}
                        {inrFormat.format(Math.abs(budgetState.remainingAfter))}{' '}
                        Lakhs.
                      </span>{' '}
                      Reduce the financial target or ask the administrator to
                      revise the project cost.
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>
                      After saving, the project will have ₹{' '}
                      <span className="font-semibold">
                        {inrFormat.format(budgetState.remainingAfter)} Lakhs
                      </span>{' '}
                      remaining for future indicators.
                    </span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============== INDICATOR DETAILS ============== */}
      <Card className="overflow-hidden">
        <div
          style={{ backgroundColor: '#2E7D32' }}
          className="px-6 py-3 text-center text-sm font-semibold uppercase tracking-wide text-white"
        >
          {isEdit ? 'Edit Indicator Details' : 'Add New Indicator Details'}
        </div>

        {locked && (
          <div className="flex items-start gap-2 border-b bg-[#E8F5E9] px-6 py-3 text-xs text-[#1B5E20]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              This indicator has been verified. All fields are read-only — any
              correction is now the verification officer&apos;s responsibility.
            </p>
          </div>
        )}

        <CardContent className="space-y-5 p-6">
          {/* Indicator name */}
          <Field
            label="Indicator Name"
            required
            error={errors.indicator_name?.message}
          >
            <Textarea
              rows={3}
              maxLength={255}
              {...register('indicator_name')}
              placeholder="Describe what this indicator measures"
            />
          </Field>

          {/* Unit + Physical Target + Financial Target */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Field
              label="Unit of Measurement"
              required
              error={errors.unit?.message}
            >
              <select {...register('unit')} className={selectClass}>
                <option value="">Choose option</option>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Physical Target"
              required
              error={errors.physical_target?.message}
            >
              <div className="relative">
                <Target
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="number"
                  step="any"
                  min={0}
                  placeholder="0"
                  className="pl-9"
                  {...register('physical_target')}
                />
              </div>
            </Field>

            <Field
              label="Financial Target (in Lakh)"
              required
              error={errors.financial_target?.message}
            >
              <div className="relative">
                <IndianRupee
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="0.00"
                  className="pl-9"
                  {...register('financial_target')}
                />
              </div>
            </Field>
          </div>

          {/* District → Local Body Type → Local Body cascade */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Field
              label="Implementation District"
              required
              error={errors.district_id?.message}
            >
              <div className="relative">
                <MapPin
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                />
                <select
                  {...register('district_id')}
                  className={cn(selectClass, 'pl-9')}
                >
                  <option value={ALL}>All Districts</option>
                  {master?.districts.map((d) => (
                    <option key={d.district_id} value={d.district_id}>
                      {d.district_name}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            {/* Local body type — only when a specific district is selected.
                Sentinel rows (ids 1 & 2) are filtered out at the API. */}
            {districtId > 0 ? (
              <Field label="Implementation Local Body Type" required>
                <select
                  {...register('local_body_type_id')}
                  className={selectClass}
                >
                  <option value={ALL}>All Types</option>
                  {(master?.localBodyTypes ?? []).map((t) => (
                    <option
                      key={t.localbody_type_id}
                      value={t.localbody_type_id}
                    >
                      {t.localbody_type_name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <CascadeHint message="Applies to all districts — Local Body Type & Implementation Local Body are not required." />
            )}

            {/* Local body multi-select — only when both district + type are specific */}
            {districtId > 0 && localBodyTypeId > 0 ? (
              <Field
                label={`Implementation Local Body — ${localBodyIds.length} selected`}
                required
                error={errors.local_body_ids?.message as string}
              >
                <MultiSelectPanel
                  options={filteredLocalBodies.map((lb) => ({
                    id: lb.localbody_id,
                    name: lb.localbody_name ?? `#${lb.localbody_id}`,
                  }))}
                  selected={localBodyIds}
                  onToggle={(id) =>
                    setValue(
                      'local_body_ids',
                      localBodyIds.includes(id)
                        ? localBodyIds.filter((x) => x !== id)
                        : [...localBodyIds, id],
                      { shouldValidate: true, shouldDirty: true },
                    )
                  }
                  onSelectMany={(ids) =>
                    setValue('local_body_ids', ids, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  onClear={() =>
                    setValue('local_body_ids', [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                  emptyHint="No local bodies match this district and type."
                />
              </Field>
            ) : districtId > 0 ? (
              <CascadeHint message="Applies to all local bodies in this district." />
            ) : (
              <div />
            )}
          </div>

          {/* Beneficiary multi-select */}
          <Field
            label={`Beneficiary Type — ${beneficiaryIds.length} selected`}
            error={errors.beneficiary_ids?.message as string}
          >
            <MultiSelectPanel
              options={(master?.beneficiaries ?? []).map((b) => ({
                id: b.beneficiary_id,
                name: b.beneficiary_name ?? `#${b.beneficiary_id}`,
              }))}
              selected={beneficiaryIds}
              onToggle={(id) =>
                setValue(
                  'beneficiary_ids',
                  beneficiaryIds.includes(id)
                    ? beneficiaryIds.filter((x) => x !== id)
                    : [...beneficiaryIds, id],
                  { shouldValidate: true, shouldDirty: true },
                )
              }
              onSelectMany={(ids) =>
                setValue('beneficiary_ids', ids, {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              onClear={() =>
                setValue('beneficiary_ids', [], {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              emptyHint="No beneficiaries available."
            />
          </Field>

          {/* Lat/Lng — optional */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-warning-amber">
              <Info className="h-3 w-3" aria-hidden />
              Please enter the Location of the Project Implementation (if
              applicable)
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" error={errors.latitude?.message as string}>
                <Input
                  type="number"
                  step="any"
                  placeholder="eg: 8.614822"
                  {...register('latitude')}
                />
              </Field>
              <Field
                label="Longitude"
                error={errors.longitude?.message as string}
              >
                <Input
                  type="number"
                  step="any"
                  placeholder="eg: 76.852976"
                  {...register('longitude')}
                />
              </Field>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
          className="cursor-pointer"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={pending || locked}
          className="cursor-pointer bg-[#2E7D32] hover:bg-[#256328]"
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {isEdit ? 'Save changes' : 'Create Indicator'}
            </>
          )}
        </Button>
      </div>
      </fieldset>
    </form>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================
function MultiSelectPanel({
  options,
  selected,
  onToggle,
  onClear,
  emptyHint,
  onSelectMany,
}: {
  options: { id: number; name: string }[];
  selected: number[];
  onToggle: (id: number) => void;
  onClear: () => void;
  emptyHint: string;
  /** Optional bulk setter used by the Select-all toggle. */
  onSelectMany?: (ids: number[]) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.name.toLowerCase().includes(q))
    : options;
  const selectedSet = new Set(selected);
  const selectedLabels = options.filter((o) => selectedSet.has(o.id));

  // "Select all" applies to whatever the user has filtered down to. If every
  // visible row is already selected, the same control deselects them.
  const filteredIds = filtered.map((o) => o.id);
  const allVisibleSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedSet.has(id));

  const toggleSelectAll = () => {
    if (!onSelectMany) {
      // Fallback when no bulk setter was supplied — toggle one-at-a-time.
      filteredIds.forEach((id) => {
        if (allVisibleSelected) {
          if (selectedSet.has(id)) onToggle(id);
        } else if (!selectedSet.has(id)) onToggle(id);
      });
      return;
    }
    if (allVisibleSelected) {
      // Deselect just the visible subset (keep selections outside the filter).
      const next = selected.filter((id) => !filteredIds.includes(id));
      onSelectMany(next);
    } else {
      // Union of current selection + every visible id.
      const merged = new Set<number>([...selected, ...filteredIds]);
      onSelectMany(Array.from(merged));
    }
  };

  return (
    <div className="space-y-2">
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
                className="rounded-full p-0.5 hover:bg-white/15"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="ml-auto text-[11px] font-medium text-muted-foreground hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-md border">
        <div className="flex items-center gap-2 border-b bg-muted/20 px-2.5">
          <Search
            className="pointer-events-none h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${options.length}…`}
            className="h-9 flex-1 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
          />
          {options.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className={cn(
                'flex-shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150',
                allVisibleSelected
                  ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                  : 'bg-[#2E7D32] text-white hover:bg-[#256328]',
              )}
              aria-pressed={allVisibleSelected}
            >
              {allVisibleSelected
                ? q
                  ? 'Deselect visible'
                  : 'Deselect all'
                : q
                  ? 'Select visible'
                  : 'Select all'}
            </button>
          )}
        </div>
        <div className="max-h-44 overflow-y-auto">
          {options.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              {emptyHint}
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              No match
            </p>
          ) : (
            <ul className="divide-y">
              {filtered.map((o) => {
                const isOn = selectedSet.has(o.id);
                return (
                  <li key={o.id}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-muted/40',
                        isOn && 'bg-[#2E7D32]/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => onToggle(o.id)}
                        className="h-4 w-4 cursor-pointer accent-[#2E7D32]"
                      />
                      <span className={cn(isOn && 'font-medium')}>
                        {o.name}
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

/**
 * Shown in place of a hidden cascade field, so the user can see at a glance
 * what "All" actually means — instead of an empty column on the right.
 */
function CascadeHint({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 self-end rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function BudgetStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'muted' | 'info' | 'success' | 'error';
}) {
  const cls = {
    muted: 'bg-muted/40 text-foreground',
    info: 'bg-kerala-blue/5 text-kerala-blue',
    success: 'bg-success-green/5 text-success-green',
    error: 'bg-error-red/5 text-error-red',
  }[tone];
  return (
    <div className={cn('rounded-lg border p-3', cls)}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm font-semibold">
        ₹ {inrFormat.format(value)} <span className="text-[11px]">Lakhs</span>
      </p>
    </div>
  );
}

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

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
        <p role="alert" className="text-xs font-medium text-error-red">
          {error}
        </p>
      )}
    </div>
  );
}
