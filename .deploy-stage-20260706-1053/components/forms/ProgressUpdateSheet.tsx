'use client';

import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  IndianRupee,
  Info,
  Loader2,
  Percent,
  Users,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Public payload of an applied save — IndicatorTable patches its row with this
// ---------------------------------------------------------------------------
export interface ProgressSavePatch {
  physicalAchievement: number;
  financialAchievement: number;
  completedDate: string | null;
  lastUpdatedAt: string;
  isVerified: false;
}

interface SheetIndicator {
  indicatorId: number;
  name: string;
  unit: string;
  physicalTarget: number;
  financialTarget: number;
  physicalAchievement: number;
  financialAchievement: number;
  completedDate: string | null;
  description?: string | null;
  achievedDirectDays?: number | null;
  achievedDirectPersons?: number | null;
  achievedIndirectDays?: number | null;
  achievedIndirectPersons?: number | null;
}

interface ProjectTargets {
  projectName: string;
  directDays: number;
  directPersons: number;
  indirectDays: number;
  indirectPersons: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator: SheetIndicator | null;
  projectTargets: ProjectTargets;
  /** Called when the officer successfully submits — IndicatorTable uses this
   *  to patch the row optimistically. */
  onSaved: (patch: ProgressSavePatch) => void;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
const schema = z
  .object({
    physical_achievement: z.coerce.number().min(0).max(100),
    financial_achievement: z.coerce.number().min(0),
    completed_date: z.string().optional().nullable().default(''),
    description: z.string().max(2000).optional().default(''),
    achieved_direct_days: z.coerce.number().int().min(0).default(0),
    achieved_direct_persons: z.coerce.number().int().min(0).default(0),
    achieved_indirect_days: z.coerce.number().int().min(0).default(0),
    achieved_indirect_persons: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((d, ctx) => {
    if (d.physical_achievement >= 100 && !d.completed_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['completed_date'],
        message: 'Required when 100% complete.',
      });
    }
    const desc = d.description ?? '';
    if (desc.length > 0 && desc.length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['description'],
        message: 'Minimum 10 characters if filling description.',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const inrFormat = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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
export function ProgressUpdateSheet({
  open,
  onOpenChange,
  indicator,
  projectTargets,
  onSaved,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [highlightDate, setHighlightDate] = useState(false);

  const defaultValues: FormValues = {
    physical_achievement: indicator?.physicalAchievement ?? 0,
    financial_achievement: indicator?.financialAchievement ?? 0,
    completed_date: indicator?.completedDate ?? '',
    description: indicator?.description ?? '',
    achieved_direct_days: indicator?.achievedDirectDays ?? 0,
    achieved_direct_persons: indicator?.achievedDirectPersons ?? 0,
    achieved_indirect_days: indicator?.achievedIndirectDays ?? 0,
    achieved_indirect_persons: indicator?.achievedIndirectPersons ?? 0,
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  });

  // Reset form whenever a new indicator is loaded into the sheet
  useEffect(() => {
    if (indicator) {
      reset({
        physical_achievement: indicator.physicalAchievement,
        financial_achievement: indicator.financialAchievement,
        completed_date: indicator.completedDate ?? '',
        description: indicator.description ?? '',
        achieved_direct_days: indicator.achievedDirectDays ?? 0,
        achieved_direct_persons: indicator.achievedDirectPersons ?? 0,
        achieved_indirect_days: indicator.achievedIndirectDays ?? 0,
        achieved_indirect_persons: indicator.achievedIndirectPersons ?? 0,
      });
      setSaved(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicator?.indicatorId]);

  // Live derived
  const physical = Number(watch('physical_achievement')) || 0;
  const physicalTarget = indicator?.physicalTarget ?? 0;
  const percentage =
    physicalTarget > 0 ? Math.min(100, (physical / physicalTarget) * 100) : 0;
  const isCompleted = percentage >= 100;

  // Highlight date field briefly when it unlocks
  useEffect(() => {
    if (isCompleted) {
      setHighlightDate(true);
      const t = setTimeout(() => setHighlightDate(false), 1500);
      return () => clearTimeout(t);
    }
    setValue('completed_date', '');
  }, [isCompleted, setValue]);

  const desc = watch('description') ?? '';
  const counterTone =
    desc.length > 1900
      ? 'text-error-red'
      : desc.length > 20
        ? 'text-success-green'
        : 'text-muted-foreground';

  // ----------------------------- close handling ---------------------------
  const attemptClose = () => {
    if (pending) return; // can't close while saving
    if (isDirty && !saved) {
      setShowDiscard(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleSheetOpenChange = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    attemptClose();
  };

  const discardAndClose = () => {
    setShowDiscard(false);
    onOpenChange(false);
  };

  // ----------------------------- submit -----------------------------------
  const onValid = (values: FormValues) => {
    if (!indicator) return;
    startTransition(async () => {
      // TODO: replace with real PATCH /api/indicators/[id]/submit
      await new Promise((r) => setTimeout(r, 700));

      const stamp = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      setSaved(true);
      onSaved({
        physicalAchievement: Number(values.physical_achievement),
        financialAchievement: Number(values.financial_achievement),
        completedDate: values.completed_date || null,
        lastUpdatedAt: stamp,
        isVerified: false,
      });

      // Brief saved state, then close
      setTimeout(() => {
        onOpenChange(false);
        setSaved(false);
      }, 700);
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          side="right"
          className="p-0"
          onInteractOutside={(e) => {
            if (isDirty && !saved && !pending) {
              e.preventDefault();
              setShowDiscard(true);
            }
          }}
          onEscapeKeyDown={(e) => {
            if (isDirty && !saved && !pending) {
              e.preventDefault();
              setShowDiscard(true);
            }
          }}
        >
          {/* ------------------ HEADER ------------------ */}
          <header
            style={{ backgroundColor: '#2E7D32' }}
            className="flex items-start justify-between gap-3 px-6 py-4 text-white shadow-sm"
          >
            <div className="space-y-0.5">
              <SheetTitle className="flex items-center gap-2 text-base font-semibold">
                <BarChart3 className="h-4 w-4" aria-hidden />
                Update Progress
              </SheetTitle>
              <SheetDescription className="text-sm text-white/85">
                {indicator?.name ?? ''}
              </SheetDescription>
            </div>
            <SheetClose
              onClick={(e) => {
                if (isDirty && !saved && !pending) {
                  e.preventDefault();
                  setShowDiscard(true);
                }
              }}
              aria-label="Close"
              className="cursor-pointer rounded-md p-1 text-white/85 transition-colors duration-200 hover:bg-white/15 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" />
            </SheetClose>
          </header>

          {/* ------------------ CONTEXT STRIP ------------------ */}
          <div className="border-b bg-muted/40 px-6 py-2 text-[11px] text-muted-foreground">
            <p className="truncate">
              <span className="font-medium text-foreground">
                {projectTargets.projectName}
              </span>
              <span className="px-2 opacity-50">·</span>
              Target:{' '}
              <span className="font-mono font-medium text-foreground">
                {indicator?.physicalTarget ?? 0} {indicator?.unit ?? ''}
              </span>
              <span className="px-2 opacity-50">·</span>
              Financial Target:{' '}
              <span className="font-mono font-medium text-foreground">
                ₹ {inrFormat.format(indicator?.financialTarget ?? 0)} L
              </span>
            </p>
          </div>

          {/* ------------------ SCROLLABLE FORM ------------------ */}
          <form
            id="progress-form"
            onSubmit={handleSubmit(onValid)}
            className="flex-1 space-y-6 overflow-y-auto px-6 py-5"
            noValidate
          >
            {/* SECTION 1 — PHYSICAL ACHIEVEMENT */}
            <section className="space-y-4">
              <SectionTitle
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                title="Physical Achievement"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="physical_achievement" className="text-xs">
                    Physical Achievement{' '}
                    <span className="text-muted-foreground">
                      ({indicator?.unit})
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
                  <FieldError>{errors.physical_achievement?.message}</FieldError>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="percentage" className="text-xs">
                    % Complete
                  </Label>
                  <div className="relative">
                    <Input
                      id="percentage"
                      readOnly
                      tabIndex={-1}
                      value={percentage.toFixed(2)}
                      className="border-success-green/30 bg-success-green/5 pr-9 font-mono text-success-green"
                    />
                    <Percent
                      aria-hidden
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-success-green/70"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="financial_achievement" className="text-xs">
                    Financial Achievement{' '}
                    <span className="text-muted-foreground">(Lakhs)</span>
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
                  <FieldError>
                    {errors.financial_achievement?.message}
                  </FieldError>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="completed_date" className="text-xs">
                      Completed Date
                    </Label>
                    <span
                      title="Enabled when physical achievement reaches 100%"
                      className="cursor-help text-muted-foreground"
                    >
                      <Info className="h-3 w-3" aria-hidden />
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
                  <FieldError>
                    {errors.completed_date?.message as string}
                  </FieldError>
                </div>
              </div>
            </section>

            {/* SECTION 2 — EMPLOYMENT GENERATION */}
            <section className="space-y-3">
              <SectionTitle
                icon={<Briefcase className="h-3.5 w-3.5" />}
                title="Employment Generation"
              />

              <div className="overflow-hidden rounded-lg border">
                {/* Header row */}
                <div className="grid grid-cols-[1.5fr_1fr_1fr] items-center gap-2 border-b bg-muted/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span />
                  <span className="flex items-center gap-1 text-foreground/80">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                    Days
                  </span>
                  <span className="flex items-center gap-1 text-foreground/80">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    Persons
                  </span>
                </div>

                {/* Direct Target */}
                <EmploymentRow
                  label={
                    <>
                      <Badge variant="neutral" className="text-[10px]">
                        Target
                      </Badge>
                      <span className="text-xs font-medium">Direct</span>
                    </>
                  }
                  tone="grey"
                  days={projectTargets.directDays}
                  persons={projectTargets.directPersons}
                />

                {/* Indirect Target */}
                <EmploymentRow
                  label={
                    <>
                      <Badge variant="neutral" className="text-[10px]">
                        Target
                      </Badge>
                      <span className="text-xs font-medium">Indirect</span>
                    </>
                  }
                  tone="grey"
                  days={projectTargets.indirectDays}
                  persons={projectTargets.indirectPersons}
                />

                {/* Direct Achieved */}
                <EmploymentInputRow
                  label={
                    <>
                      <Badge variant="success" className="text-[10px]">
                        Achieved
                      </Badge>
                      <span className="text-xs font-medium">Direct</span>
                    </>
                  }
                  daysProps={{
                    ...register('achieved_direct_days'),
                    id: 'achieved_direct_days',
                  }}
                  personsProps={{
                    ...register('achieved_direct_persons'),
                    id: 'achieved_direct_persons',
                  }}
                  errors={[
                    errors.achieved_direct_days?.message,
                    errors.achieved_direct_persons?.message,
                  ]}
                />

                {/* Indirect Achieved */}
                <EmploymentInputRow
                  label={
                    <>
                      <Badge variant="success" className="text-[10px]">
                        Achieved
                      </Badge>
                      <span className="text-xs font-medium">Indirect</span>
                    </>
                  }
                  daysProps={{
                    ...register('achieved_indirect_days'),
                    id: 'achieved_indirect_days',
                  }}
                  personsProps={{
                    ...register('achieved_indirect_persons'),
                    id: 'achieved_indirect_persons',
                  }}
                  errors={[
                    errors.achieved_indirect_days?.message,
                    errors.achieved_indirect_persons?.message,
                  ]}
                />
              </div>
            </section>

            {/* SECTION 3 — DESCRIPTION */}
            <section className="space-y-2">
              <SectionTitle
                icon={<Info className="h-3.5 w-3.5" />}
                title="Description"
              />
              <Textarea
                id="description"
                rows={4}
                maxLength={2000}
                placeholder="Describe work completed, milestones reached…"
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
                  {desc.length} / 2000
                </p>
              </div>
            </section>
          </form>

          {/* ------------------ STICKY SUBMIT ------------------ */}
          <footer className="border-t bg-background px-6 py-3">
            <Button
              type="submit"
              form="progress-form"
              size="lg"
              disabled={pending || saved}
              className={cn(
                'h-11 w-full cursor-pointer text-sm font-semibold uppercase tracking-wide shadow-md transition-all duration-200 hover:shadow-lg',
                saved
                  ? 'bg-success-green hover:bg-success-green/90'
                  : 'bg-[#2E7D32] hover:bg-[#256328]',
              )}
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Saved
                </>
              ) : (
                <>
                  Submit
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </footer>
        </SheetContent>
      </Sheet>

      {/* ------------------ UNSAVED-CHANGES GUARD ------------------ */}
      <Dialog
        open={showDiscard}
        onOpenChange={(o) => !o && setShowDiscard(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. If you discard, your updates will be
              lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDiscard(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={discardAndClose}
              className="cursor-pointer"
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function SectionTitle({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#2E7D32]">
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-md bg-[#2E7D32]/10"
      >
        {icon}
      </span>
      {title}
    </h3>
  );
}

function EmploymentRow({
  label,
  tone,
  days,
  persons,
}: {
  label: React.ReactNode;
  tone: 'grey' | 'white';
  days: number;
  persons: number;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-[1.5fr_1fr_1fr] items-center gap-2 border-b px-3 py-2 last:border-b-0',
        tone === 'grey' ? 'bg-muted/40' : 'bg-background',
      )}
    >
      <span className="flex items-center gap-2">{label}</span>
      <span className="font-mono text-sm font-semibold text-foreground">
        {days}
      </span>
      <span className="font-mono text-sm font-semibold text-foreground">
        {persons}
      </span>
    </div>
  );
}

function EmploymentInputRow({
  label,
  daysProps,
  personsProps,
  errors,
}: {
  label: React.ReactNode;
  daysProps: React.InputHTMLAttributes<HTMLInputElement> & {
    name: string;
    ref: React.Ref<HTMLInputElement>;
  };
  personsProps: React.InputHTMLAttributes<HTMLInputElement> & {
    name: string;
    ref: React.Ref<HTMLInputElement>;
  };
  errors: [string?, string?];
}) {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1fr] items-center gap-2 border-b bg-background px-3 py-2 last:border-b-0">
      <span className="flex items-center gap-2">{label}</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="0"
        className={cn(
          'h-9 font-mono',
          errors[0] && 'border-error-red focus-visible:ring-error-red',
        )}
        aria-invalid={!!errors[0]}
        {...daysProps}
      />
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        placeholder="0"
        className={cn(
          'h-9 font-mono',
          errors[1] && 'border-error-red focus-visible:ring-error-red',
        )}
        aria-invalid={!!errors[1]}
        {...personsProps}
      />
    </div>
  );
}
