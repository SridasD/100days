'use client';

/**
 * Shared "change password" form. Mounted by /settings/change-password under
 * each role's route group (officer / verify / admin). Posts to
 * /api/auth/change-password and forces a re-login on success.
 *
 * Validation is enforced both client-side (this file) and server-side
 * (the API route) — the API never trusts a successful client validation.
 */
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signOut } from 'next-auth/react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Schema — kept verbatim with the server route so the messages match.
// ---------------------------------------------------------------------------
const schema = z
  .object({
    currentPassword: z.string().min(1, 'നിലവിലെ പാസ്‌വേഡ് നൽകുക'),
    newPassword: z
      .string()
      .min(8, 'കുറഞ്ഞത് 8 അക്ഷരങ്ങൾ വേണം')
      .regex(/[A-Z]/, 'ഒരു വലിയ അക്ഷരം ഉൾപ്പെടണം')
      .regex(/[0-9]/, 'ഒരു അക്കം ഉൾപ്പെടണം')
      .regex(/[^A-Za-z0-9]/, 'ഒരു പ്രത്യേക ചിഹ്നം ഉൾപ്പെടണം'),
    confirmPassword: z.string().min(1, 'പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'പാസ്‌വേഡുകൾ പൊരുത്തപ്പെടുന്നില്ല',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'പുതിയ പാസ്‌വേഡ് പഴയതിൽ നിന്ന് വ്യത്യസ്തമായിരിക്കണം',
    path: ['newPassword'],
  });

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Strength meter
// ---------------------------------------------------------------------------
function strengthFor(pw: string) {
  const criteria = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const score = criteria.filter(Boolean).length;
  if (score === 0) return { score: 0, label: '', pct: 0, tone: 'muted' as const };
  if (score === 1)
    return { score: 1, label: 'ദുർബലം', pct: 25, tone: 'danger' as const };
  if (score === 2)
    return { score: 2, label: 'സാധാരണ', pct: 50, tone: 'warning' as const };
  if (score === 3)
    return { score: 3, label: 'നല്ലത്', pct: 75, tone: 'info' as const };
  return { score: 4, label: 'ശക്തമായത്', pct: 100, tone: 'success' as const };
}

const STRENGTH_BAR: Record<
  ReturnType<typeof strengthFor>['tone'],
  string
> = {
  muted: 'bg-muted',
  danger: 'bg-error-red',
  warning: 'bg-warning-amber',
  info: 'bg-kerala-blue',
  success: 'bg-[#2D6A4F]',
};

const STRENGTH_TEXT: Record<
  ReturnType<typeof strengthFor>['tone'],
  string
> = {
  muted: 'text-muted-foreground',
  danger: 'text-error-red',
  warning: 'text-warning-amber',
  info: 'text-kerala-blue',
  success: 'text-[#2D6A4F]',
};

// ===========================================================================
// MAIN COMPONENT
// ===========================================================================
export function ChangePasswordForm() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(2);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const newPw = watch('newPassword');
  const confirmPw = watch('confirmPassword');
  const strength = useMemo(() => strengthFor(newPw ?? ''), [newPw]);

  // Confirm-field live match icon (only meaningful once user has typed).
  const confirmState = useMemo(() => {
    if (!confirmPw) return 'idle' as const;
    return confirmPw === newPw ? ('match' as const) : ('mismatch' as const);
  }, [confirmPw, newPw]);

  // ---- success → countdown → signOut ----
  useEffect(() => {
    if (!success) return;
    if (secondsLeft <= 0) {
      void signOut({ callbackUrl: '/login' });
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [success, secondsLeft]);

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.error ?? 'പാസ്‌വേഡ് മാറ്റാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.',
          );
        }
        // Clear the form and switch to the success state. The useEffect
        // above handles the 2-second hold + signOut redirect.
        reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setSuccess(true);
      } catch (e) {
        setServerError(
          e instanceof Error ? e.message : 'പാസ്‌വേഡ് മാറ്റാൻ കഴിഞ്ഞില്ല.',
        );
      }
    });
  };

  const formDisabled = pending || success;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-5"
      noValidate
      aria-label="Change password"
    >
      {/* Success */}
      {success && (
        <Alert className="border-[#2D6A4F]/30 bg-[#D8F3DC]/40">
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F]" />
          <AlertTitle className="text-[#1B4332]">
            <span className="font-malayalam">പാസ്‌വേഡ് വിജയകരമായി മാറ്റി</span>
          </AlertTitle>
          <AlertDescription className="text-[#1B4332]/85">
            <span className="font-malayalam">
              ദയവായി വീണ്ടും ലോഗിൻ ചെയ്യുക.
            </span>
            {secondsLeft > 0 && (
              <span className="font-mono ml-1 text-[#2D6A4F]">
                ({secondsLeft})
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Error */}
      {serverError && !success && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            <span className="font-malayalam">ദുരത്തൽ</span>
          </AlertTitle>
          <AlertDescription>
            <span className="font-malayalam">{serverError}</span>
          </AlertDescription>
        </Alert>
      )}

      {/* Current password */}
      <PasswordField
        id="currentPassword"
        labelMal="നിലവിലെ പാസ്‌വേഡ്"
        autoComplete="current-password"
        show={showCurrent}
        onToggleShow={() => setShowCurrent((v) => !v)}
        disabled={formDisabled}
        register={register('currentPassword')}
        error={errors.currentPassword?.message}
      />

      {/* New password */}
      <div className="space-y-2">
        <PasswordField
          id="newPassword"
          labelMal="പുതിയ പാസ്‌വേഡ്"
          autoComplete="new-password"
          show={showNew}
          onToggleShow={() => setShowNew((v) => !v)}
          disabled={formDisabled}
          register={register('newPassword')}
          error={errors.newPassword?.message}
        />

        {/* Strength meter */}
        <div className="space-y-1.5">
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={strength.pct}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                STRENGTH_BAR[strength.tone],
              )}
              style={{ width: `${strength.pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <p className="font-malayalam text-muted-foreground">
              പാസ്‌വേഡിന്റെ ശക്തി
            </p>
            {strength.label && (
              <p
                className={cn(
                  'font-malayalam font-semibold',
                  STRENGTH_TEXT[strength.tone],
                )}
              >
                {strength.label}
              </p>
            )}
          </div>

          {/* Criteria checklist — quiet hint, not a fail-stop */}
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <CriterionRow ok={(newPw ?? '').length >= 8} labelMal="8+ അക്ഷരങ്ങൾ" />
            <CriterionRow ok={/[A-Z]/.test(newPw ?? '')} labelMal="വലിയ അക്ഷരം" />
            <CriterionRow ok={/[0-9]/.test(newPw ?? '')} labelMal="അക്കം" />
            <CriterionRow
              ok={/[^A-Za-z0-9]/.test(newPw ?? '')}
              labelMal="പ്രത്യേക ചിഹ്നം"
            />
          </ul>
        </div>
      </div>

      {/* Confirm password */}
      <div className="space-y-1.5">
        <PasswordField
          id="confirmPassword"
          labelMal="പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക"
          autoComplete="new-password"
          show={showConfirm}
          onToggleShow={() => setShowConfirm((v) => !v)}
          disabled={formDisabled}
          register={register('confirmPassword')}
          error={errors.confirmPassword?.message}
          rightIcon={
            confirmState === 'match' ? (
              <CheckCircle2 className="h-4 w-4 text-[#2D6A4F]" />
            ) : confirmState === 'mismatch' ? (
              <XCircle className="h-4 w-4 text-error-red" />
            ) : null
          }
        />
      </div>

      <Button
        type="submit"
        disabled={formDisabled}
        className="w-full cursor-pointer bg-[#2D6A4F] text-white hover:bg-[#1B4332]"
        size="lg"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-malayalam">മാറ്റുന്നു...</span>
          </>
        ) : (
          <span className="font-malayalam">പാസ്‌വേഡ് മാറ്റുക</span>
        )}
      </Button>
    </form>
  );
}

// ===========================================================================
// SUB-COMPONENTS
// ===========================================================================
function PasswordField({
  id,
  labelMal,
  autoComplete,
  show,
  onToggleShow,
  disabled,
  register,
  error,
  rightIcon,
}: {
  id: string;
  labelMal: string;
  autoComplete: string;
  show: boolean;
  onToggleShow: () => void;
  disabled: boolean;
  register: ReturnType<ReturnType<typeof useForm<FormValues>>['register']>;
  error?: string;
  rightIcon?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="font-malayalam text-xs">
        {labelMal}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          disabled={disabled}
          aria-invalid={!!error}
          className={cn(
            'pr-20 font-mono',
            error && 'border-error-red focus-visible:ring-error-red',
          )}
          {...register}
        />
        {/* Live status icon (e.g., match/mismatch on confirm) */}
        {rightIcon && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2"
          >
            {rightIcon}
          </span>
        )}
        {/* Show / hide */}
        <button
          type="button"
          onClick={onToggleShow}
          disabled={disabled}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="font-malayalam text-xs font-medium text-error-red"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function CriterionRow({ ok, labelMal }: { ok: boolean; labelMal: string }) {
  return (
    <li
      className={cn(
        'inline-flex items-center gap-1 transition-colors',
        ok ? 'text-[#2D6A4F]' : 'text-muted-foreground',
      )}
    >
      {ok ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <span aria-hidden className="h-3 w-3 rounded-full border border-current" />
      )}
      <span className="font-malayalam">{labelMal}</span>
    </li>
  );
}
