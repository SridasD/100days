'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { Eye, EyeOff, Loader2, ShieldAlert } from 'lucide-react';
import { loginSchema, type LoginInput } from '@/lib/validations/login';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get('callbackUrl');
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { loginName: '', password: '' },
  });

  const isValidCallbackPath = (path: string) => {
    if (!path.startsWith('/')) return false;
    if (path === '/' || path.startsWith('/login')) return false;
    if (path.startsWith('/images') || path.startsWith('/_next')) return false;
    if (path.startsWith('/api')) return false;
    return true;
  };

  const resolveRedirectPath = async () => {
    const safeCallback =
      callbackUrl && callbackUrl.startsWith('/') ? callbackUrl : null;
    if (safeCallback && isValidCallbackPath(safeCallback)) {
      return safeCallback;
    }

    try {
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store' });
      if (sessionRes.ok) {
        const session = (await sessionRes.json()) as {
          user?: { roleId?: number };
        };
        const roleId = session.user?.roleId;
        if (roleId === 4) return '/admin/osd/dashboard';
        if (roleId === 3) return '/admin/dashboard';
        if (roleId === 2 || roleId === 6) return '/officer/projects';
        if (roleId === 1) return '/verify/projects';
      }
    } catch {
      // Ignore and use fallback route.
    }

    return '/';
  };

  const onSubmit = (values: LoginInput) => {
    setServerError(null);
    startTransition(async () => {
      const res = await signIn('credentials', {
        ...values,
        redirect: false,
      });

      if (!res || res.error) {
        // Generic message — never reveal which field was wrong (Section 7.1)
        setServerError('Invalid credentials. If you have tried 5 times, your account is locked for 30 minutes.');
        return;
      }

      const target = await resolveRedirectPath();
      router.push(target);
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="space-y-5"
      aria-label="Login form"
    >
      {serverError && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="loginName">Login Name</Label>
        <Input
          id="loginName"
          type="text"
          autoComplete="username"
          autoFocus
          disabled={pending}
          aria-invalid={!!errors.loginName}
          aria-describedby={errors.loginName ? 'loginName-error' : undefined}
          className={cn(errors.loginName && 'border-error-red focus-visible:ring-error-red')}
          {...register('loginName')}
        />
        {errors.loginName && (
          <p id="loginName-error" className="text-xs text-error-red">
            {errors.loginName.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            disabled={pending}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className={cn(
              'pr-10',
              errors.password && 'border-error-red focus-visible:ring-error-red',
            )}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className="text-xs text-error-red">
            {errors.password.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
