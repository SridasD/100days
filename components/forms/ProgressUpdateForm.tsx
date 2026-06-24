'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormRegisterReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BarChart3,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  Info,
  Loader2,
  MessageSquare,
  Percent,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Schema — Section 8 of the blueprint maps these to hdp.indicators columns
// ---------------------------------------------------------------------------
const schema = z
  .object({
    physical_achievement: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Cannot be negative')
      .max(100, 'Maximum is 100'),
    financial_achievement: z.coerce
      .number({ invalid_type_error: 'Enter a number' })
      .min(0, 'Cannot be negative'),
    completed_date: z.string().optional().nullable(),
    description: z.string().max(2000).optional().default(''),
    achieved_no_days_employed_direct: z.coerce.number().int().min(0).default(0),
    achieved_no_persons_employed_direct: z.coerce.number().int().min(0).default(0),
    achieved_no_days_employed_indirect: z.coerce.number().int().min(0).default(0),
    achieved_no_persons_employed_indirect: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    if (data.physical_achievement >= 100 && !data.completed_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['completed_date'],
        message: 'Completion date is required when physical achievement reaches 100%.',
      });
    }
    const d = data.description ?? '';
    if (d.length > 0 && d.length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Provide at least 10 characters if filling description.',
      });
    }
  });

export type ProgressFormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface Props {
  projectId: number;
  indicatorId: number;
  /** Pre-filled mock values for this stub. */
  defaults: Partial<ProgressFormValues>;
  /** Target values shown in the read-only context card + Employment Target sub-section. */
  targets: {
    physicalTarget: number;
    physicalUnit: string;
    financialTargetLakhs: number;
    directDays: number;
    directPersons: number;
    indirectDays: number;
    indirectPersons: number;
  };
}

// ---------------------------------------------------------------------------
// Small section-header bar (coloured strip on top of each Card)
// ---------------------------------------------------------------------------
function SectionHeader({
  icon,
  title,
  tone = 'green',
}: {
  icon: React.ReactNode;
  title: string;
  tone?: 'green' | 'olive';
}) {
  const bg = tone === 'olive' ? '#4A5320' : '#2E7D32';
  return (
    <div
      style={{ backgroundColor: bg }}
      className="flex items-center gap-2 px-6 py-3 text-white"
    >
      <span aria-hidden className="opacity-90">
        {icon}
      </span>
      <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-error-red">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ProgressUpdateForm({
  projectId,
  indicatorId,
  defaults,
  targets,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shakeKey, setShakeKey] = useState(0);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProgressFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      physical_achievement: defaults.physical_achievement ?? 0,
      financial_achievement: defaults.financial_achievement ?? 0,
      completed_date: defaults.completed_date ?? '',
      description: defaults.description ?? '',
      achieved_no_days_employed_direct:
        defaults.achieved_no_days_employed_direct ?? 0,
      achieved_no_persons_employed_direct:
        defaults.achieved_no_persons_employed_direct ?? 0,
      achieved_no_days_employed_indirect:
        defaults.achieved_no_days_employed_indirect ?? 0,
      achieved_no_persons_employed_indirect:
        defaults.achieved_no_persons_employed_indirect ?? 0,
    },
    mode: 'onTouched',
  });

  // Live derived values --------------------------------------------------
  const physical = Number(watch('physical_achievement')) || 0;
  const percentage =
    targets.physicalTarget > 0
      ? Math.min(100, (physical / targets.physicalTarget) * 100)
      : 0;
  const isCompleted = percentage >= 100;

  const description = watch('description') ?? '';
  const descLen = description.length;
  const counterTone =
    descLen > 1900
      ? 'text-error-red'
      : descLen > 20
        ? 'text-success-green'
        : 'text-muted-foreground';

  // Highlight Completed-Date when it just became enabled
  const [highlightDate, setHighlightDate] = useState(false);
  useEffect(() => {
    if (isCompleted) {
      setHighlightDate(true);
      const t = setTimeout(() => setHighlightDate(false), 1500);
      return () => clearTimeout(t);
    }
    // Drop any previously selected date when officer rolls back below 100%
    setValue('completed_date', '');
  }, [isCompleted, setValue]);

  // ---------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------
  const onValid = (values: ProgressFormValues) => {
    startTransition(async () => {
      // TODO: replace with real PATCH /api/indicators/[id]/submit
      await new Promise((r) => setTimeout(r, 800));
      void values;
      setSaved(true);
      // Brief checkmark, then return to the indicator list with a success toast
      setTimeout(() => {
        router.push(
          `/officer/projects/${projectId}/indicators?updated=1`,
        );
      }, 900);
    });
  };

  const onInvalid = () => {
    // Trigger a 400ms shake on the form
    setShakeKey((k) => k + 1);
  };

  return (
    <form
      key={shakeKey}
      onSubmit={handleSubmit(onValid, onInvalid)}
      className={cn(
        'space-y-6',
        shakeKey > 0 && 'animate-in fade-in slide-in-from-left-1',
      )}
      aria-label="Update indicator progress"
      noValidate
    >
      {/* ============================================================ */}
      {/* SECTION 1 — PHYSICAL ACHIEVEMENT                              */}
      {/* ============================================================ */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<BarChart3 className="h-4 w-4" />}
          title="Physical Achievement"
        />
        <CardContent className="grid gap-5 p-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Physical achievement */}
          <div className="space-y-1.5">
            <Label htmlFor="physical_achievement">
              Physical Achievement{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (in {targets.physicalUnit})
              </span>
            </Label>
            <Input
              id="physical_achievement"
              type="number"
              inputMode="decimal"
              step="any"
              min={0}
              max={100}
              placeholder="0"
              aria-invalid={!!errors.physical_achievement}
              className={cn(
                errors.physical_achievement &&
                  'border-error-red focus-visible:ring-error-red',
              )}
              {...register('physical_achievement')}
            />
            <p className="text-[11px] text-muted-foreground">
              Enter a value between 0 and 100.
            </p>
            <FieldError>{errors.physical_achievement?.message}</FieldError>
          </div>

          {/* Auto-calculated percentage */}
          <div className="space-y-1.5">
            <Label htmlFor="percentage">
              Percentage of Physical Achievement
            </Label>
            <div className="relative">
              <Input
                id="percentage"
                readOnly
                aria-readonly
                value={percentage.toFixed(2)}
                className="border-success-green/30 bg-success-green/5 pr-9 font-mono text-success-green"
                tabIndex={-1}
              />
              <Percent
                aria-hidden
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success-green/70"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-calculated from achievement / target × 100.
            </p>
          </div>

          {/* Financial achievement */}
          <div className="space-y-1.5">
            <Label htmlFor="financial_achievement">
              Financial Achievement{' '}
              <span className="text-xs font-normal text-muted-foreground">
                (in Lakhs)
              </span>
            </Label>
            <div className="relative">
              <IndianRupee
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="financial_achievement"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                placeholder="0.00"
                aria-invalid={!!errors.financial_achievement}
                className={cn(
                  'pl-9',
                  errors.financial_achievement &&
                    'border-error-red focus-visible:ring-error-red',
                )}
                {...register('financial_achievement')}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Target: ₹ {targets.financialTargetLakhs.toFixed(2)} Lakhs.
            </p>
            <FieldError>{errors.financial_achievement?.message}</FieldError>
          </div>

          {/* Completed date */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="completed_date">Completed Date</Label>
              <span
                title="Available only when physical achievement reaches 100%"
                className="cursor-help text-muted-foreground"
              >
                <Info className="h-3.5 w-3.5" aria-hidden />
              </span>
            </div>
            <Input
              id="completed_date"
              type="date"
              disabled={!isCompleted}
              aria-disabled={!isCompleted}
              aria-invalid={!!errors.completed_date}
              className={cn(
                !isCompleted && 'opacity-60',
                isCompleted &&
                  'border-success-green ring-1 ring-success-green/30',
                highlightDate && 'animate-pulse',
                errors.completed_date &&
                  'border-error-red focus-visible:ring-error-red',
              )}
              {...register('completed_date')}
            />
            <p className="font-malayalam text-[11px] text-muted-foreground">
              100% പൂർത്തീകരണം നടന്ന ദിവസം
            </p>
            <FieldError>{errors.completed_date?.message as string}</FieldError>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 2 — EMPLOYMENT GENERATION                             */}
      {/* ============================================================ */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<Briefcase className="h-4 w-4" />}
          title="Employment Generation"
          tone="olive"
        />
        <CardContent className="space-y-5 p-6">
          {/* Sub-section A — TARGET (read-only) */}
          <div className="rounded-lg bg-muted/50 p-5">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="neutral">Target</Badge>
              <p className="text-xs text-muted-foreground">
                Values from the master project record (read-only).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <ReadOnlyStat
                label="Direct (No. of days)"
                value={targets.directDays}
                icon={<CalendarCheck2 className="h-3.5 w-3.5" />}
              />
              <ReadOnlyStat
                label="Direct (No. of Persons)"
                value={targets.directPersons}
                icon={<Users className="h-3.5 w-3.5" />}
              />
              <ReadOnlyStat
                label="Indirect (No. of days)"
                value={targets.indirectDays}
                icon={<CalendarCheck2 className="h-3.5 w-3.5" />}
              />
              <ReadOnlyStat
                label="Indirect (No. of Persons)"
                value={targets.indirectPersons}
                icon={<Users className="h-3.5 w-3.5" />}
              />
            </div>
          </div>

          {/* Sub-section B — ACHIEVEMENT (editable) */}
          <div className="rounded-lg border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="success">Achievement</Badge>
              <p className="text-xs text-muted-foreground">
                Enter the employment generated against each target above.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <EmploymentField
                id="achieved_no_days_employed_direct"
                label="Direct (No. of days)"
                register={register('achieved_no_days_employed_direct')}
                error={errors.achieved_no_days_employed_direct?.message}
              />
              <EmploymentField
                id="achieved_no_persons_employed_direct"
                label="Direct (No. of Persons)"
                register={register('achieved_no_persons_employed_direct')}
                error={errors.achieved_no_persons_employed_direct?.message}
              />
              <EmploymentField
                id="achieved_no_days_employed_indirect"
                label="Indirect (No. of days)"
                register={register('achieved_no_days_employed_indirect')}
                error={errors.achieved_no_days_employed_indirect?.message}
              />
              <EmploymentField
                id="achieved_no_persons_employed_indirect"
                label="Indirect (No. of Persons)"
                register={register('achieved_no_persons_employed_indirect')}
                error={errors.achieved_no_persons_employed_indirect?.message}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SECTION 3 — DESCRIPTION                                       */}
      {/* ============================================================ */}
      <Card className="overflow-hidden shadow-sm">
        <SectionHeader
          icon={<MessageSquare className="h-4 w-4" />}
          title="Physical Achievement Description"
        />
        <CardContent className="space-y-2 p-6">
          <Label htmlFor="description">
            Describe what was achieved this cycle
          </Label>
          <Textarea
            id="description"
            rows={5}
            maxLength={2000}
            placeholder="Describe the physical achievement in detail — works completed, infrastructure created, services delivered…"
            aria-invalid={!!errors.description}
            className={cn(
              'resize-y',
              errors.description &&
                'border-error-red focus-visible:ring-error-red',
            )}
            {...register('description')}
          />
          <div className="flex items-center justify-between gap-3">
            <FieldError>{errors.description?.message as string}</FieldError>
            <p
              className={cn(
                'ml-auto font-mono text-[11px] tabular-nums',
                counterTone,
              )}
              aria-live="polite"
            >
              {descLen} / 2000
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* SUBMIT                                                         */}
      {/* ============================================================ */}
      <Button
        type="submit"
        size="lg"
        disabled={pending || saved}
        className={cn(
          'h-12 w-full cursor-pointer text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 hover:shadow-lg',
          saved ? 'bg-success-green hover:bg-success-green/90' : 'bg-[#2E7D32] hover:bg-[#256328]',
        )}
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Saving…
          </>
        ) : saved ? (
          <>
            <CheckCircle2 className="h-5 w-5" />
            Saved
          </>
        ) : (
          <>
            Submit
            <ChevronRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Helper sub-components
// ---------------------------------------------------------------------------
function ReadOnlyStat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <p className="font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmploymentField({
  id,
  label,
  register,
  error,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="0"
        aria-invalid={!!error}
        className={cn(error && 'border-error-red focus-visible:ring-error-red')}
        {...register}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}
