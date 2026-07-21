'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, AlertTriangle, FolderOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AdminUser {
  userId: number;
  userPublicId: string | null;
  userName: string;
  loginName: string;
  mobileNo: string;
  roleId: number;
  status: number;
  secId: number | null;
  secretaryName: string | null;
  designation: string | null;
  lastLogin: string | null;
  registeredOn: string | null;
}

const ROLE_NAMES: Record<number, string> = {
  1: 'Verification Officer',
  2: 'Nodal Officer',
  3: 'Administrator',
  4: 'OSD Administrator',
  5: 'Secretary',
  6: 'Head of Department',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/users', { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { users: AdminUser[] };
        setUsers(json.users);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredUsers = (users ?? []).filter((user) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      q.length === 0 ||
      user.userName?.toLowerCase().includes(q) ||
      user.loginName?.toLowerCase().includes(q) ||
      (user.secretaryName ?? '').toLowerCase().includes(q);

    const matchesRole =
      roleFilter === 'all' || String(user.roleId) === String(roleFilter);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && user.status === 1) ||
      (statusFilter === 'inactive' && user.status === 0);

    return matchesQuery && matchesRole && matchesStatus;
  });

  const roleOptions = Array.from(
    new Set((users ?? []).map((u) => u.roleId).filter((v) => Number.isFinite(v))),
  ).sort((a, b) => a - b);

  return (
    <main className="space-y-8">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage system users, roles, and access
          </p>
        </div>
        <Button asChild className="cursor-pointer">
          <Link href="/admin/users/new">
            <Plus className="h-4 w-4" />
            New User
          </Link>
        </Button>
      </div>

      {loading && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-4 w-full animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-error-red/30 bg-error-red/5">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-error-red" />
            <p className="text-sm text-error-red">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (!users || users.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <FolderOpen className="h-7 w-7 text-muted-foreground" />
            <div>
              <p className="text-base font-semibold text-foreground">
                No users found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your first user to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && users && users.length > 0 && (
        <>
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3">
              <Input
                placeholder="Search by name, login, or secretary"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All roles</option>
                {roleOptions.map((roleId) => (
                  <option key={roleId} value={String(roleId)}>
                    {ROLE_NAMES[roleId] ?? `Role ${roleId}`}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </CardContent>
          </Card>

          {filteredUsers.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No users match your search/filter.
              </CardContent>
            </Card>
          )}

          {filteredUsers.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Secretary</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell className="font-medium">
                        {user.userName}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {user.loginName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ROLE_NAMES[user.roleId] ?? 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.secretaryName ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.status === 1
                              ? 'bg-success-green/90 text-white'
                              : 'bg-muted'
                          }
                        >
                          {user.status === 1 ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString()
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/admin/users/${user.userPublicId ?? user.userId}`}>Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </main>
  );
}
