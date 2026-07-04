'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Master-data dropdowns
// ---------------------------------------------------------------------------
interface MasterData {
  secretaries: { sec_id: number; secretary_name: string | null }[];
  roles: { role_id: number; role_description: string | null }[];
}

// ---------------------------------------------------------------------------
// Schemas — slightly different for create vs edit
// ---------------------------------------------------------------------------
const passwordRule = z
  .string()
  .min(8, 'Minimum 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character');

const baseFields = {
  user_name: z.string().min(2).max(250),
  mobile_no: z
    .string()
    .optional()
    .refine(
      (v) => !v || /^\d{10}$/.test(v),
      'Enter a 10-digit mobile if provided',
    ),
  role_id: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(6),
  sec_id: z.coerce.number().int().optional(),
  designation: z.string().max(250).optional(),
  status: z.coerce.number().int().min(0).max(1),
};

const createSchema = z.object({
  ...baseFields,
  login_name: z.string().min(3).max(150),
  password: passwordRule,
});

const editSchema = z.object({
  ...baseFields,
  login_name: z.string().min(3).max(150).optional(), // read-only in edit
  password: z
    .string()
    .optional()
    .refine((v) => !v || passwordRule.safeParse(v).success, {
      message:
        'Min 8 chars with uppercase + digit + special character (leave blank to keep current)',
    }),
});

export type UserCreateValues = z.infer<typeof createSchema>;
export type UserEditValues = z.infer<typeof editSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface Props {
  /** When set, the form is in edit mode. */
  userId?: string | number;
  defaults?: Partial<UserCreateValues>;
  redirectTo?: string;
}

export function UserForm({ userId, defaults, redirectTo = '/admin/users' }: Props) {
  const router = useRouter();
  const userRef = userId == null ? '' : String(userId).trim();
  const isEdit = userRef.length > 0;
  const schema = isEdit ? editSchema : createSchema;

  const [master, setMaster] = useState<MasterData | null>(null);
  const [masterError, setMasterError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showPwd, setShowPwd] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UserCreateValues | UserEditValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      user_name: defaults?.user_name ?? '',
      login_name: defaults?.login_name ?? '',
      password: '',
      mobile_no: defaults?.mobile_no ?? '',
      role_id: defaults?.role_id ?? 2,
      sec_id: defaults?.sec_id ?? 0,
      designation: defaults?.designation ?? '',
      status: defaults?.status ?? 1,
    },
    mode: 'onTouched',
  });

  const roleId = Number(watch('role_id'));
  const needsSec = roleId === 1 || roleId === 2;
  const visibleRoles =
    master?.roles.filter(
      (r) =>
        !/tech\.?\s*administrator/i.test(r.role_description ?? ''),
    ) ?? [];

  useEffect(() => {
    fetch('/api/admin/master', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => setMaster(j))
      .catch((e) => setMasterError(e.message));
  }, []);

  const onValid = (values: UserCreateValues | UserEditValues) => {
    setServerError(null);
    startTransition(async () => {
      try {
        let url: string;
        let method: string;
        const payload: Record<string, unknown> = { ...values };

        if (isEdit) {
          url = `/api/admin/users/${userRef}`;
          method = 'PATCH';
          // login_name is immutable on edit
          delete payload.login_name;
          // empty password = "don't change"
          if (!payload.password) delete payload.password;
        } else {
          url = '/api/admin/users';
          method = 'POST';
        }
        // sec_id is optional for Admins (role 3)
        if (!needsSec) payload.sec_id = null;

        const res = await fetch(url, {
          method,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const debug = body.debug
            ? `\nDB: ${body.debug.message ?? ''}${body.debug.detail ? ' · ' + body.debug.detail : ''
            }${body.debug.column ? ' · column: ' + body.debug.column : ''}${body.debug.constraint
              ? ' · constraint: ' + body.debug.constraint
              : ''
            }`
            : '';
          throw new Error((body.error ?? `HTTP ${res.status}`) + debug);
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
        <Loader2 className="h-4 w-4 animate-spin" /> Loading form…
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
      aria-label={isEdit ? 'Edit user' : 'New user'}
    >
      {serverError && (
        <div className="flex items-center gap-2 rounded-lg border border-error-red/30 bg-error-red/5 p-3 text-sm text-error-red">
          <AlertTriangle className="h-4 w-4" />
          {serverError}
        </div>
      )}

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            User details
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={errors.user_name?.message}>
              <Input {...register('user_name')} />
            </Field>
            <Field
              label="Login name"
              required={!isEdit}
              error={(errors as Record<string, { message?: string }>).login_name?.message}
            >
              <Input
                {...register('login_name')}
                disabled={isEdit}
                className={cn(isEdit && 'opacity-70')}
              />
              {isEdit && (
                <p className="text-[11px] text-muted-foreground">
                  Login name cannot be changed after creation.
                </p>
              )}
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Mobile number"
              error={errors.mobile_no?.message}
            >
              <Input
                {...register('mobile_no')}
                inputMode="numeric"
                placeholder="10 digits (optional)"
              />
            </Field>
            <Field label="Designation">
              <Input {...register('designation')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Role" required error={errors.role_id?.message}>
              <select {...register('role_id')} className={selectClass}>
                {visibleRoles.map((r) => (
                  <option key={r.role_id} value={r.role_id}>
                    {r.role_description}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Department"
              required={needsSec}
              error={errors.sec_id?.message}
            >
              <select
                {...register('sec_id')}
                className={cn(selectClass, !needsSec && 'opacity-50')}
                disabled={!needsSec}
              >
                <option value={0}>— Select —</option>
                {master?.secretaries.map((s) => (
                  <option key={s.sec_id} value={s.sec_id}>
                    {s.secretary_name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select {...register('status')} className={selectClass}>
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* PASSWORD */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <KeyRound className="h-4 w-4" />
            {isEdit ? 'Reset password (optional)' : 'Password'}
          </h2>
          <Field
            label={isEdit ? 'New password' : 'Password'}
            required={!isEdit}
            error={(errors as Record<string, { message?: string }>).password?.message}
          >
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                {...register('password')}
                placeholder={
                  isEdit
                    ? 'Leave blank to keep current password'
                    : 'Min 8 chars, uppercase, digit, special'
                }
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                tabIndex={-1}
                aria-label={showPwd ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {showPwd ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>
          {isEdit && (
            <p className="text-[11px] text-muted-foreground">
              Resetting clears lockout state and failed-attempt counter.
            </p>
          )}
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
            <><CheckCircle2 className="h-4 w-4" /> {isEdit ? 'Save changes' : 'Create user'}</>
          )}
        </Button>
      </div>
    </form>
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
