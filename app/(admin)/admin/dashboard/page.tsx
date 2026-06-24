'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderOpen,
  BarChart3,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStats {
  activeUsers: number;
  totalProjects: number;
  totalIndicators: number;
  pendingVerification: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/dashboard', { cache: 'no-store' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const json = (await res.json()) as { stats: DashboardStats };
        setStats(json.stats);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statCards = stats
    ? [
      {
        icon: Users,
        title: 'Active Users',
        value: stats.activeUsers,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      },
      {
        icon: FolderOpen,
        title: 'Total Projects',
        value: stats.totalProjects,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
      },
      {
        icon: BarChart3,
        title: 'Total Indicators',
        value: stats.totalIndicators,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
      },
      {
        icon: Clock,
        title: 'Pending Verification',
        value: stats.pendingVerification,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
      },
    ]
    : [];

  return (
    <main className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          System Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor HDP platform status and activity
        </p>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-8 w-24 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-error-red/30 bg-error-red/5">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-error-red" />
            <p className="text-sm text-error-red">{error}</p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && stats && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {statCards.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {stat.title}
                        </p>
                        <p className="mt-2 text-2xl font-bold text-foreground">
                          {stat.value}
                        </p>
                      </div>
                      <div
                        className={`rounded-lg ${stat.bgColor} p-3 ${stat.color}`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full cursor-pointer">
                  <Link href="/admin/users">Manage Users</Link>
                </Button>
                <Button asChild className="w-full cursor-pointer">
                  <Link href="/admin/projects">Manage Projects</Link>
                </Button>
                <Button asChild className="w-full cursor-pointer">
                  <Link href="/admin/audit">View Audit Log</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Database
                  </span>
                  <Badge className="bg-success-green/90 text-white">
                    Connected
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Authentication
                  </span>
                  <Badge className="bg-success-green/90 text-white">
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    File Storage
                  </span>
                  <Badge className="bg-success-green/90 text-white">
                    Ready
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
