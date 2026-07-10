'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { BarChart3, ClipboardList, FolderOpen, Layers3, ShieldCheck, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type TechDashboardData = {
    timestamp: string;
    stats: {
        activeUsers: number;
        totalProjects: number;
        totalIndicators: number;
        pendingVerification: number;
    };
    systemStatus: {
        database: string;
        authentication: string;
        fileStorage: string;
    };
};

const numberFormatter = new Intl.NumberFormat('en-IN');

function formatNumber(value: number) {
    return numberFormatter.format(value || 0);
}

function MetricCard({
    title,
    value,
    description,
    icon: Icon,
}: {
    title: string;
    value: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
}) {
    return (
        <Card className="shadow-sm">
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
                        <p className="text-3xl font-semibold tracking-tight text-foreground">{value}</p>
                        <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                    <div className="rounded-2xl border border-kerala-blue/20 bg-kerala-blue/5 p-3 text-kerala-blue">
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function AdminDashboardPage() {
    const [data, setData] = useState<TechDashboardData | null>(null);
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

                const json = (await res.json()) as TechDashboardData;
                setData(json);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    return (
        <main className="space-y-6">
            <section className="overflow-hidden rounded-3xl border bg-gradient-to-br from-background via-background to-slate-50/80 shadow-sm">
                <div className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-kerala-blue" />
                            Tech Administrator Dashboard
                        </div>
                        <div className="max-w-3xl space-y-2">
                            <h1 className="text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
                                Operational console for user, project, and system administration.
                            </h1>
                            <p className="text-sm leading-6 text-muted-foreground lg:text-base">
                                This dashboard is separate from the OSD executive view and keeps the technical
                                administration workflows in one place.
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                        <div className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Live status</p>
                            <p className="mt-2 text-sm font-medium text-foreground">Connected to admin API</p>
                        </div>
                        <div className="rounded-2xl border bg-background/90 p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Data timestamp</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                                {data ? new Date(data.timestamp).toLocaleString('en-IN') : 'Loading...'}
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {loading && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((i) => (
                        <Card key={i} className="animate-pulse">
                            <CardContent className="p-6">
                                <div className="h-6 w-24 rounded bg-muted" />
                                <div className="mt-4 h-10 w-32 rounded bg-muted" />
                                <div className="mt-3 h-4 w-40 rounded bg-muted" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                        <Layers3 className="h-6 w-6 text-destructive" />
                        <p className="text-sm text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {!loading && !error && data && (
                <>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <MetricCard title="Active Users" value={formatNumber(data.stats.activeUsers)} description="Enabled logins" icon={Users} />
                        <MetricCard title="Total Projects" value={formatNumber(data.stats.totalProjects)} description="Managed portfolio" icon={FolderOpen} />
                        <MetricCard title="Total Indicators" value={formatNumber(data.stats.totalIndicators)} description="Indicator records" icon={BarChart3} />
                        <MetricCard title="Pending Verification" value={formatNumber(data.stats.pendingVerification)} description="Items awaiting review" icon={ClipboardList} />
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">Quick Actions</CardTitle>
                                <CardDescription>Common admin tasks and maintenance entry points.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid gap-3 sm:grid-cols-2">
                                <Button asChild className="h-12 justify-between rounded-2xl px-4">
                                    <Link href="/admin/users">
                                        <span className="flex items-center gap-2"><Users className="h-4 w-4" />Manage Users</span>
                                        <Layers3 className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="h-12 justify-between rounded-2xl px-4">
                                    <Link href="/admin/projects">
                                        <span className="flex items-center gap-2"><FolderOpen className="h-4 w-4" />Projects</span>
                                        <Layers3 className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="h-12 justify-between rounded-2xl px-4">
                                    <Link href="/admin/audit">
                                        <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" />Audit Log</span>
                                        <Layers3 className="h-4 w-4" />
                                    </Link>
                                </Button>
                                <Button asChild variant="outline" className="h-12 justify-between rounded-2xl px-4">
                                    <Link href="/admin/reports">
                                        <span className="flex items-center gap-2"><BarChart3 className="h-4 w-4" />Reports</span>
                                        <Layers3 className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="text-lg">System Status</CardTitle>
                                <CardDescription>Basic health indicators for the technical console.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Database</span>
                                    <Badge className="bg-success-green/90 text-white">{data.systemStatus.database}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">Authentication</span>
                                    <Badge className="bg-success-green/90 text-white">{data.systemStatus.authentication}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">File Storage</span>
                                    <Badge className="bg-success-green/90 text-white">{data.systemStatus.fileStorage}</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </main>
    );
}