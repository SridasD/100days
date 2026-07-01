'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CircleUserRound,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Phone,
  Shield,
  UserRound,
  UserRoundCog,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeralaHeader } from '@/components/layout/KeralaHeader';
import { OfficerUserMenu } from '@/components/layout/OfficerUserMenu';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { logoutWithAuditClient } from '@/lib/auth/logout-client';
import { cn } from '@/lib/utils';

interface MeResponse {
  userId: number;
  userName: string;
  loginName: string;
  designation: string | null;
  mobile: string | null;
  email: string | null;
  roleId: number;
  secId: number;
  deptId: number;
  departmentLabel: string | null;
  status: number;
  lastLogin: string | null;
}

interface ProfilePageProps {
  homeHref?: string;
}

const ROLE_META: Record<number, { label: string; tone: string; icon: typeof Shield }> = {
  1: { label: 'Verification Officer', tone: 'bg-amber-500/10 text-amber-800 ring-amber-500/20', icon: Shield },
  2: { label: 'Nodal Officer', tone: 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/20', icon: UserRound },
  3: { label: 'Administrator', tone: 'bg-slate-500/10 text-slate-800 ring-slate-500/20', icon: UserRoundCog },
  4: { label: 'OSD Administrator', tone: 'bg-indigo-500/10 text-indigo-900 ring-indigo-500/20', icon: UserRoundCog },
  5: { label: 'Secretary', tone: 'bg-teal-500/10 text-teal-900 ring-teal-500/20', icon: Building2 },
  6: { label: 'Head of Department', tone: 'bg-cyan-500/10 text-cyan-900 ring-cyan-500/20', icon: Building2 },
};

function initialsFrom(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'H'
  );
}

function changePasswordHref(roleId: number): string {
  if (roleId === 1) return '/verify/settings/change-password';
  if (roleId === 4) return '/admin/osd/settings/change-password';
  if (roleId === 3) return '/admin/settings/change-password';
  if (roleId === 5) return '/secretary/settings/change-password';
  return '/officer/settings/change-password';
}

function roleFallbackLabel(roleId: number): string {
  return ROLE_META[roleId]?.label ?? 'User';
}

export function ProfilePage({ homeHref: homeHrefOverride }: ProfilePageProps) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ userName: '', email: '', mobile: '' });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load profile');
        return (await response.json()) as MeResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setMe(data);
        setForm({
          userName: data.userName ?? '',
          email: data.email ?? '',
          mobile: data.mobile ?? '',
        });
      })
      .catch(() => {
        if (!cancelled) setServerError('Unable to load your profile right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const role = me?.roleId ? ROLE_META[me.roleId] : null;
  const roleLabel = me ? roleFallbackLabel(me.roleId) : 'User';
  const avatarLabel = me ? initialsFrom(me.userName || me.loginName || roleLabel) : 'H';
  const AvatarIcon = role?.icon ?? CircleUserRound;
  const homeHref =
    homeHrefOverride ??
    (me?.roleId === 5
      ? '/secretary/dashboard'
      : me?.roleId === 4
        ? '/admin/osd/dashboard'
        : me?.roleId === 3
          ? '/admin/dashboard'
          : me?.roleId === 1
            ? '/verify/projects'
            : me?.roleId === 2 || me?.roleId === 6
              ? '/officer/projects'
              : '/');

  const editableChanged = useMemo(() => {
    if (!me) return false;
    const normalizedEmail = form.email.trim().toLowerCase();
    const normalizedMobile = form.mobile.trim();
    const initialEmail = (me.email ?? '').trim().toLowerCase();
    const initialMobile = (me.mobile ?? '').trim();
    const initialName = (me.userName ?? '').trim();
    return (
      form.userName.trim() !== initialName ||
      normalizedEmail !== initialEmail ||
      normalizedMobile !== initialMobile
    );
  }, [form.email, form.mobile, form.userName, me]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setServerError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      const response = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: form.userName,
          email: form.email,
          mobile: form.mobile,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: Array<{ message?: string; path?: Array<string | number> }>;
      };

      if (!response.ok) {
        const message =
          payload.issues?.[0]?.message || payload.error || 'Failed to update profile.';
        throw new Error(message);
      }

      setSuccessMessage('Profile updated successfully.');
      setMe((current) =>
        current
          ? {
            ...current,
            userName: form.userName.trim(),
            email: form.email.trim() ? form.email.trim().toLowerCase() : null,
            mobile: form.mobile.trim() ? form.mobile.trim() : null,
          }
          : current,
      );
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <KeralaHeader
        homeHref={homeHref}
        right={<OfficerUserMenu roleLabel={roleLabel} departmentLabel={me?.departmentLabel ?? undefined} />}
      />

      <main className="relative flex-1 overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(46,125,50,0.18),_transparent_36%),radial-gradient(circle_at_top_right,_rgba(200,169,81,0.18),_transparent_32%),linear-gradient(180deg,_#f7faf7_0%,_#eef5ef_55%,_#ffffff_100%)] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
            <Card className="relative overflow-hidden border-emerald-900/10 bg-white/90 shadow-[0_18px_60px_-28px_rgba(46,125,50,0.45)] backdrop-blur">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#2E7D32] via-[#C8A951] to-[#4A5320]" />
              <CardHeader className="space-y-4 pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="gap-1.5 border-emerald-900/10 bg-emerald-50 text-emerald-800">
                    <CircleUserRound className="h-3.5 w-3.5" />
                    Common profile
                  </Badge>
                  {me?.status === 1 ? (
                    <Badge variant="success">Active account</Badge>
                  ) : me ? (
                    <Badge variant="warning">Inactive account</Badge>
                  ) : null}
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[#2E7D32] via-[#3E8E43] to-[#C8A951] text-2xl font-bold text-white shadow-lg shadow-emerald-900/20 ring-4 ring-white">
                    {me ? avatarLabel : 'H'}
                    <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#2E7D32] shadow-md ring-1 ring-emerald-900/10">
                      <AvatarIcon className="h-4 w-4" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <CardTitle className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                        {me?.userName || 'Loading profile'}
                      </CardTitle>
                      <CardDescription className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
                        {me
                          ? 'Keep your identity and contact details current. Username and role-scoped details stay read-only here.'
                          : 'Loading your live profile from the server.'}
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn('border ring-1', role?.tone ?? 'bg-slate-100 text-slate-700 ring-slate-200')} variant="outline">
                        {roleLabel}
                      </Badge>
                      {me?.departmentLabel ? (
                        <Badge variant="secondary" className="gap-1.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {me.departmentLabel}
                        </Badge>
                      ) : null}
                      {me?.designation ? (
                        <Badge variant="neutral" className="gap-1.5">
                          <UserRoundCog className="h-3.5 w-3.5" />
                          {me.designation}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {serverError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Profile update failed</AlertTitle>
                    <AlertDescription>{serverError}</AlertDescription>
                  </Alert>
                ) : null}

                {successMessage ? (
                  <Alert variant="info">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertTitle>Saved</AlertTitle>
                    <AlertDescription>{successMessage}</AlertDescription>
                  </Alert>
                ) : null}

                <form onSubmit={onSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="userName">Full Name</Label>
                      <Input
                        id="userName"
                        value={form.userName}
                        onChange={(event) => setForm((current) => ({ ...current, userName: event.target.value }))}
                        disabled={saving || loading}
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="loginName">Username</Label>
                      <Input id="loginName" value={me?.loginName ?? ''} disabled readOnly />
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          value={form.email}
                          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                          disabled={saving || loading}
                          placeholder="name@example.gov.in"
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="mobile">Mobile Number</Label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="mobile"
                          inputMode="numeric"
                          maxLength={10}
                          value={form.mobile}
                          onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value.replace(/\D/g, '').slice(0, 10) }))}
                          disabled={saving || loading}
                          placeholder="10-digit mobile number"
                          className="pl-9"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button type="submit" disabled={saving || loading || !editableChanged}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Save changes
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href={changePasswordHref(me?.roleId ?? 2)}>
                        <LockKeyhole className="h-4 w-4" />
                        Change password
                      </Link>
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => void logoutWithAuditClient('/login')}>
                      <LogOut className="h-4 w-4" />
                      Logout
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="border-emerald-900/10 bg-white/90 shadow-sm backdrop-blur">
                <CardHeader>
                  <CardTitle className="text-lg">Role details</CardTitle>
                  <CardDescription>What the portal knows about your account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <dl className="space-y-4">
                    <DetailRow label="Role" value={roleLabel} />
                    <DetailRow label="Administrative department" value={me?.secId ? me.departmentLabel ?? 'Not assigned' : 'Not applicable'} />
                    <DetailRow label="Department / HOD" value={me?.deptId ? me.departmentLabel ?? 'Not assigned' : 'Not applicable'} />
                    <DetailRow label="Designation" value={me?.designation ?? 'Not provided'} />
                    <DetailRow label="Username" value={me?.loginName ?? 'Loading'} />
                    <DetailRow label="Mobile" value={me?.mobile ?? 'Not provided'} />
                    <DetailRow label="Email" value={me?.email ?? 'Not provided'} />
                  </dl>
                </CardContent>
              </Card>

              <Card className="border-emerald-900/10 bg-gradient-to-br from-[#2E7D32] to-[#1F5C25] text-white shadow-lg shadow-emerald-900/20">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Quick access</CardTitle>
                  <CardDescription className="text-white/75">
                    Password and logout actions stay one click away.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Button variant="secondary" asChild>
                    <Link href={changePasswordHref(me?.roleId ?? 2)}>
                      <LockKeyhole className="h-4 w-4" />
                      Change password
                    </Link>
                  </Button>
                  <Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white" onClick={() => void logoutWithAuditClient('/login')}>
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-emerald-900/10 bg-slate-50/80 px-4 py-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="max-w-[65%] text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}