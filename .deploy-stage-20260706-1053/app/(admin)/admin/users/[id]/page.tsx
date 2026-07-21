'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserForm } from '@/components/forms/UserForm';

interface ApiUser {
  userId: number;
  userPublicId: string;
  userName: string;
  loginName: string;
  mobileNo: string;
  roleId: number;
  status: number;
  secId: number | null;
  designation: string;
  lastLogin: string | null;
  registeredOn: string | null;
}

export default function AdminUserEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userRef = String(params.id ?? '').trim();

  const [data, setData] = useState<ApiUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userRef) return;
    fetch(`/api/admin/users/${userRef}`, { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${r.status}`);
        }
        return r.json() as Promise<{ user: ApiUser }>;
      })
      .then((j) => setData(j.user))
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [userRef]);

  useEffect(() => {
    if (data?.userPublicId && data.userPublicId !== userRef) {
      router.replace(`/admin/users/${data.userPublicId}`);
    }
  }, [data?.userPublicId, router, userRef]);

  const defaults = data
    ? {
      user_name: data.userName,
      login_name: data.loginName,
      mobile_no: data.mobileNo,
      role_id: data.roleId,
      sec_id: data.secId ?? 0,
      designation: data.designation,
      status: data.status,
    }
    : undefined;

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit User{data?.loginName ? ` · ${data.loginName}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Update profile, toggle status, or reset password.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="cursor-pointer">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            Back to users
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
          Loading user…
        </div>
      )}

      {data && <UserForm userId={userRef} defaults={defaults} />}
    </main>
  );
}
