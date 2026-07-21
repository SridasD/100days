'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    ArrowUpRight,
    Bell,
    CheckCircle2,
    ChevronsUpDown,
    FileText,
    FolderOpen,
    Image,
    Layers3,
    PlayCircle,
    ShieldCheck,
    Siren,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type DashboardStats = {
    totalProjects: number;
    activeProjects: number;
    completedProjects: number;
    physicalAchievement: number;
    financialAchievement: number;
    employmentGenerated: number;
    pendingVerification: number;
    totalIndicators: number;
};

type DepartmentRow = {
    department_name: string;
    project_count: number;
    completed_projects: number;
    pending_verification: number;
    physical_achievement: number;
    financial_achievement: number;
    composite_score: number;
};

type SectorRow = {
    sector_name: string;
    project_count: number;
    completed_projects: number;
    achievement: number;
};

type DistrictRow = {
    district_id: number;
    district_public_id?: string | null;
    district_name: string;
    total_projects: number;
    physical_achievement: number;
    financial_achievement: number;
    pending_verification: number;
};

type VerificationQueueRow = {
    department_name: string;
    pending_count: number;
    average_age_days: number;
};

type RecentVerifiedRow = {
    project_name: string;
    department_name: string;
    district_name: string;
    progress: number;
    verified_date: string | null;
};

type EmploymentDistrictRow = {
    district_id: number;
    district_name: string;
    employment_persons: number;
};

type EmploymentTrendRow = {
    month_start: string;
    month_label: string;
    employment_persons: number;
};

type EvidenceHighlightRow = {
    galleryId: number;
    galleryType: 1 | 2 | 3;
    imagePath: string | null;
    description: string | null;
    uploadedOn: string | null;
    indicatorName: string;
    projectName: string;
    projectCode: string;
    departmentName: string;
    districtName: string;
    verifiedDate: string | null;
};

type EvidenceSnapshot = {
    verifiedImages: number;
    verifiedVideos: number;
    verifiedDocuments: number;
    totalImages: number;
    totalVideos: number;
    totalDocuments: number;
    projectsWithVerifiedEvidence: number;
    avgVerificationTurnaroundDays: number;
};

type DashboardData = {
    timestamp: string;
    stats: DashboardStats;
    riskSignals: {
        projectsAtRisk: number;
        delayedProjects: number;
        verifiedLast7: number;
        verifiedPrev7: number;
    };
    departmentRanking: DepartmentRow[];
    sectorPerformance: SectorRow[];
    districtRanking: DistrictRow[];
    verificationMonitoring: {
        pendingQueue: VerificationQueueRow[];
    };
    employment: {
        summary: {
            direct_persons: number;
            indirect_persons: number;
            direct_days: number;
            indirect_days: number;
        };
        recentVerified: RecentVerifiedRow[];
        byDistrict: EmploymentDistrictRow[];
        trend: EmploymentTrendRow[];
    };
    evidence: {
        snapshot: EvidenceSnapshot;
        highlights: EvidenceHighlightRow[];
    };
};

type InsightTone = 'critical' | 'warning' | 'normal' | 'info';

type Insight = {
    key: string;
    tone: InsightTone;
    title: string;
    body: string;
    href?: string;
};

const numberFormatter = new Intl.NumberFormat('en-IN');
const percentFormatter = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
});

function formatNumber(value: number) {
    return numberFormatter.format(value || 0);
}

function formatPercent(value: number) {
    return `${percentFormatter.format(value || 0)}%`;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function getRiskBand(score: number): { label: string; tone: 'success' | 'warning' } {
    if (score >= 70) return { label: 'Low Risk', tone: 'success' };
    if (score >= 45) return { label: 'Watch', tone: 'warning' };
    return { label: 'Intervention Needed', tone: 'warning' };
}

function SparkBars({ values }: { values: number[] }) {
    const max = Math.max(...values, 1);
    return (
        <div className="flex h-10 items-end gap-1" aria-hidden="true">
            {values.map((v, idx) => (
                <div
                    key={idx}
                    className="w-2.5 rounded-sm bg-kerala-blue/80"
                    style={{ height: `${Math.max(14, (v / max) * 100)}%` }}
                />
            ))}
        </div>
    );
}

function InsightCard({ insight }: { insight: Insight }) {
    const toneStyle: Record<InsightTone, string> = {
        critical: 'border-destructive/30 bg-destructive/5',
        warning: 'border-warning-amber/30 bg-warning-amber/8',
        normal: 'border-success-green/25 bg-success-green/5',
        info: 'border-kerala-blue/25 bg-kerala-blue/5',
    };

    const badgeTone: Record<InsightTone, 'warning' | 'success' | 'info'> = {
        critical: 'warning',
        warning: 'warning',
        normal: 'success',
        info: 'info',
    };

    const icon =
        insight.tone === 'critical' ? (
            <Siren className="h-4 w-4" aria-hidden="true" />
        ) : insight.tone === 'warning' ? (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        ) : insight.tone === 'normal' ? (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : (
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
        );

    const content = (
        <div className={cn('rounded-xl border p-3 shadow-sm transition-colors', toneStyle[insight.tone])}>
            <div className="flex items-center justify-between gap-2">
                <Badge variant={badgeTone[insight.tone]} className="gap-1">
                    {icon}
                    {insight.tone.toUpperCase()}
                </Badge>
                {insight.href ? <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> : null}
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{insight.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{insight.body}</p>
        </div>
    );

    if (!insight.href) return content;
    return (
        <Link href={insight.href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {content}
        </Link>
    );
}

type SheetType = 'completed' | 'verified' | 'evidence' | null;

export default function OsdDashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeSheet, setActiveSheet] = useState<SheetType>(null);
    const [isActionPanelOpen, setIsActionPanelOpen] = useState(false);
    const [isActionPanelExpanded, setIsActionPanelExpanded] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch('/api/admin/osd/dashboard', {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const contentType = res.headers.get('content-type') ?? '';
                if (!res.ok) {
                    const body = contentType.includes('application/json')
                        ? await res.json().catch(() => ({}))
                        : {};
                    throw new Error(body.error ?? `HTTP ${res.status}`);
                }
                if (!contentType.includes('application/json')) {
                    throw new Error('Session expired. Please sign in again.');
                }
                const json = (await res.json()) as DashboardData;
                setError(null);
                setData(json);
            } catch (e) {
                if (controller.signal.aborted) return;
                setError(e instanceof Error ? e.message : 'Unknown error');
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };
        void load();

        return () => {
            controller.abort();
        };
    }, []);

    const health = useMemo(() => {
        if (!data) {
            return {
                programmeHealthScore: 0,
                verificationCompletion: 0,
                employmentAchievement: 0,
                trendPercent: 0,
                riskScore: 0,
                riskBand: getRiskBand(0),
                districtsRequiringAttention: 0,
            };
        }

        const verificationCompletion = data.stats.totalIndicators > 0
            ? ((data.stats.totalIndicators - data.stats.pendingVerification) / data.stats.totalIndicators) * 100
            : 0;

        const employmentTargetProxy = Math.max(data.stats.totalProjects * 120, 1);
        const employmentAchievement = clamp((data.stats.employmentGenerated / employmentTargetProxy) * 100, 0, 100);

        const programmeHealthScore = Math.round(
            data.stats.physicalAchievement * 0.35 +
            data.stats.financialAchievement * 0.25 +
            verificationCompletion * 0.25 +
            employmentAchievement * 0.15,
        );

        const trendPercent = data.riskSignals.verifiedPrev7 > 0
            ? ((data.riskSignals.verifiedLast7 - data.riskSignals.verifiedPrev7) / data.riskSignals.verifiedPrev7) * 100
            : data.riskSignals.verifiedLast7 > 0
                ? 100
                : 0;

        const riskScore = clamp(
            100 - programmeHealthScore + (data.stats.pendingVerification > 0 ? 8 : 0) + (data.riskSignals.delayedProjects * 2),
            0,
            100,
        );

        const districtsRequiringAttention = data.districtRanking.filter((d) => d.pending_verification > 0 || d.physical_achievement < 45).length;

        return {
            programmeHealthScore,
            verificationCompletion,
            employmentAchievement,
            trendPercent,
            riskScore,
            riskBand: getRiskBand(programmeHealthScore),
            districtsRequiringAttention,
        };
    }, [data]);

    const departmentWithRisk = useMemo(() => {
        if (!data) return [] as Array<DepartmentRow & { verificationPercent: number; riskScore: number }>;

        return data.departmentRanking.map((row) => {
            const verificationPercent = row.project_count > 0
                ? clamp(((row.project_count - row.pending_verification) / row.project_count) * 100, 0, 100)
                : 0;
            const riskScore = clamp(
                100 - (row.composite_score * 0.6 + row.financial_achievement * 0.2 + verificationPercent * 0.2),
                0,
                100,
            );
            return { ...row, verificationPercent, riskScore };
        });
    }, [data]);

    const topPerformers = departmentWithRisk.slice().sort((a, b) => b.composite_score - a.composite_score).slice(0, 5);
    const bottomPerformers = departmentWithRisk.slice().sort((a, b) => a.composite_score - b.composite_score).slice(0, 5);

    const attention = useMemo(() => {
        if (!data) return { critical: [] as Insight[], warning: [] as Insight[], normal: [] as Insight[] };

        const critical: Insight[] = [];
        const warning: Insight[] = [];
        const normal: Insight[] = [];

        if (data.stats.pendingVerification > 0) {
            critical.push({
                key: 'critical-pending',
                tone: 'critical',
                title: `${formatNumber(data.stats.pendingVerification)} verifications pending`,
                body: 'Operational delay in verification cycle. Immediate intervention recommended.',
                href: '#verification-command',
            });
        }

        if (data.riskSignals.delayedProjects > 0) {
            critical.push({
                key: 'critical-delay',
                tone: 'critical',
                title: `${formatNumber(data.riskSignals.delayedProjects)} delayed projects`,
                body: 'Projects have unresolved pending items older than 7 days.',
                href: '#attention-center',
            });
        }

        if (data.stats.financialAchievement < 35) {
            warning.push({
                key: 'warning-financial',
                tone: 'warning',
                title: `Financial utilization ${formatPercent(data.stats.financialAchievement)}`,
                body: 'Utilization is below expected trajectory. Review release and execution constraints.',
                href: '#sector-analytics',
            });
        }

        const lowDept = departmentWithRisk.find((d) => d.composite_score < 45);
        if (lowDept) {
            warning.push({
                key: 'warning-dept',
                tone: 'warning',
                title: `${lowDept.department_name} under target`,
                body: `Composite ${formatPercent(lowDept.composite_score)} with risk score ${formatPercent(lowDept.riskScore)}.`,
                href: '#department-leaderboard',
            });
        }

        const topDistrict = data.districtRanking[0];
        if (topDistrict) {
            normal.push({
                key: 'normal-district',
                tone: 'normal',
                title: `${topDistrict.district_name} leading progress`,
                body: `${formatPercent(topDistrict.physical_achievement)} physical and ${formatPercent(topDistrict.financial_achievement)} financial achievement.`,
                href: '#district-intelligence',
            });
        }

        if (health.trendPercent > 0) {
            normal.push({
                key: 'normal-trend',
                tone: 'normal',
                title: `Verification trend improving (${formatPercent(health.trendPercent)})`,
                body: 'Current 7-day verification velocity is above previous 7 days.',
                href: '#verification-command',
            });
        }

        return { critical, warning, normal };
    }, [data, departmentWithRisk, health.trendPercent]);

    const executiveInsights = useMemo<Insight[]>(() => {
        if (!data) return [] as Insight[];

        const topDistrict = data.districtRanking[0];
        const topDept = departmentWithRisk[0];

        return [
            {
                key: 'i1',
                tone: data.stats.pendingVerification > 0 ? 'critical' : 'normal',
                title: `${formatNumber(data.stats.pendingVerification)} verifications pending > 0 days`,
                body: 'Queue pressure is the primary executive bottleneck today.',
                href: '#verification-command',
            },
            {
                key: 'i2',
                tone: data.stats.financialAchievement < 30 ? 'warning' : 'info',
                title: `Financial utilization at ${formatPercent(data.stats.financialAchievement)}`,
                body: 'Budget movement is below physical progress and needs focused review.',
                href: '#sector-analytics',
            },
            {
                key: 'i3',
                tone: topDistrict ? 'info' : 'normal',
                title: topDistrict ? `${topDistrict.district_name} contributes highest progress` : 'District contribution unavailable',
                body: topDistrict ? `${formatPercent(topDistrict.physical_achievement)} physical achievement with ${formatNumber(topDistrict.total_projects)} projects.` : 'Refresh district analytics source.',
                href: '#district-intelligence',
            },
            {
                key: 'i4',
                tone: topDept && topDept.riskScore > 60 ? 'warning' : 'normal',
                title: topDept ? `${topDept.department_name} risk score ${formatPercent(topDept.riskScore)}` : 'Department risk watch',
                body: 'Composite and verification posture translated into intervention risk signal.',
                href: '#department-leaderboard',
            },
            {
                key: 'i5',
                tone: health.trendPercent >= 0 ? 'normal' : 'warning',
                title: health.trendPercent >= 0 ? 'Verification throughput improving' : 'Verification throughput falling',
                body: `${formatPercent(Math.abs(health.trendPercent))} change compared with previous 7 days.`,
                href: '#verification-command',
            },
            {
                key: 'i6',
                tone: 'info',
                title: `${89} days remaining in current cycle`,
                body: 'Use remaining cycle window for targeted interventions and closure actions.',
                href: '#attention-center',
            },
        ];
    }, [data, departmentWithRisk, health.trendPercent]);

    const floatingActionItems = useMemo(() => {
        if (!data) {
            return [] as Array<{
                title: string;
                detail: string;
                href: string;
                tone: 'warning' | 'normal' | 'info';
            }>;
        }

        return [
            {
                title: 'Recognize top performers',
                detail: `Share wins from ${topPerformers[0]?.department_name ?? 'leading departments'} and ${data.districtRanking[0]?.district_name ?? 'top district'} in leadership review.`,
                href: '#department-leaderboard',
                tone: 'normal' as const,
            },
            {
                title: 'Open Attention Center',
                detail: `${formatNumber(attention.critical.length)} critical and ${formatNumber(attention.warning.length)} warning signals need follow-up.`,
                href: '#attention-center',
                tone: attention.critical.length > 0 ? ('warning' as const) : ('info' as const),
            },
            {
                title: 'Run verification command',
                detail: `${formatNumber(data.stats.pendingVerification)} pending verification items are in queue.`,
                href: '#verification-command',
                tone: data.stats.pendingVerification > 0 ? ('warning' as const) : ('normal' as const),
            },
            {
                title: 'Open District Intelligence',
                detail: `${formatNumber(health.districtsRequiringAttention)} districts currently need attention.`,
                href: '#district-intelligence',
                tone: 'info' as const,
            },
            {
                title: 'Review Employment Impact',
                detail: `Employment generated: ${formatNumber(data.stats.employmentGenerated)} persons.`,
                href: '#employment-impact',
                tone: 'normal' as const,
            },
            {
                title: 'View Evidence of Delivery',
                detail: `${formatNumber(data.evidence.snapshot.verifiedImages + data.evidence.snapshot.verifiedVideos + data.evidence.snapshot.verifiedDocuments)} verified items across images, videos, and documents.`,
                href: '#evidence-of-delivery',
                tone: 'normal' as const,
            },
        ];
    }, [data, topPerformers, attention.critical.length, attention.warning.length, health.districtsRequiringAttention]);

    return (
        <main className="space-y-6 overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_top_left,_rgba(46,125,50,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(200,169,81,0.12),_transparent_24%)]">
            <section className="overflow-hidden rounded-[2rem] border border-kerala-blue/15 bg-gradient-to-br from-kerala-blue/10 via-background to-success-green/5 shadow-[0_18px_50px_rgba(14,23,38,0.09)]">
                <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[1.65fr_0.95fr]">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-kerala-blue/20 bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-kerala-blue shadow-sm">
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            Executive Command Center
                        </div>

                        <div>
                            <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl xl:text-[2.7rem] xl:leading-tight">
                                Real-time command view for cross-cutting KPIs, risk intelligence, and intervention decisions.
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
                                Built for executive action: detect bottlenecks, prioritize departments and districts, and trigger focused intervention.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant="info">Executive Live Feed</Badge>
                            <Badge variant={health.riskBand.tone === 'success' ? 'success' : 'warning'}>
                                {health.riskBand.label}
                            </Badge>
                            <Badge variant="neutral">Updated {data ? new Date(data.timestamp).toLocaleString('en-IN') : '—'}</Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button asChild size="sm" className="cursor-pointer">
                                <Link href="/admin/projects">
                                    <FolderOpen className="h-4 w-4" />
                                    Manage Projects
                                </Link>
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Full list with add, edit, and guarded delete controls.
                            </p>
                        </div>
                    </div>

                    <Card className="border-warning-amber/20 bg-warning-amber/10 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardDescription className="text-[11px] uppercase tracking-[0.26em] text-warning-amber">Programme Health Score</CardDescription>
                            <CardTitle className="text-5xl leading-none text-foreground">{loading ? '—' : formatNumber(health.programmeHealthScore)}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={health.riskBand.tone === 'success' ? 'success' : 'warning'}>
                                    {health.riskBand.label}
                                </Badge>
                                <Badge variant={health.trendPercent >= 0 ? 'success' : 'warning'} className="gap-1">
                                    {health.trendPercent >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                    {formatPercent(Math.abs(health.trendPercent))} trend
                                </Badge>
                            </div>
                            <p className="text-xs leading-5 text-muted-foreground">
                                Weighted composite of physical, financial, verification completion, and employment achievement.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {loading && (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Loading executive metrics">
                    {[0, 1, 2, 3, 4].map((i) => (
                        <Card key={i} className="animate-pulse border">
                            <CardContent className="p-5">
                                <div className="h-4 w-24 rounded bg-muted" />
                                <div className="mt-3 h-9 w-28 rounded bg-muted" />
                                <div className="mt-2 h-3 w-full rounded bg-muted" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {error && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                        <Layers3 className="h-6 w-6 text-destructive" aria-hidden="true" />
                        <p className="text-sm text-destructive">{error}</p>
                    </CardContent>
                </Card>
            )}

            {!loading && !error && data && (
                <>
                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5" aria-label="Executive top metrics">
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-destructive" />
                            <CardContent className="p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Projects At Risk</p>
                                <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(data.riskSignals.projectsAtRisk)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Low progress or open pending queue</p>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-warning-amber" />
                            <CardContent className="p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Pending Verifications</p>
                                <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(data.stats.pendingVerification)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Current unresolved verification queue</p>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-warning-amber" />
                            <CardContent className="p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Delayed Projects</p>
                                <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(data.riskSignals.delayedProjects)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Pending items older than 7 days</p>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-kerala-blue" />
                            <CardContent className="p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Districts Requiring Attention</p>
                                <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(health.districtsRequiringAttention)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Low performance or pending verification</p>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-success-green" />
                            <CardContent className="p-4">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Employment Generated</p>
                                <p className="mt-2 text-3xl font-semibold text-foreground">{formatNumber(data.stats.employmentGenerated)}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Direct + indirect persons</p>
                            </CardContent>
                        </Card>
                    </section>

                    <section id="positive-momentum" className="scroll-mt-24 grid gap-6">
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-success-green via-kerala-blue to-warning-amber" />
                            <CardHeader>
                                <CardTitle className="text-xl">Positive Momentum</CardTitle>
                                <CardDescription>
                                    Success-first view for completed work, verified outcomes, and reusable execution patterns.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <button
                                        type="button"
                                        onClick={() => setActiveSheet('completed')}
                                        className="rounded-xl border border-success-green/25 bg-success-green/5 p-3 text-left transition-colors hover:bg-success-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <p className="text-xs uppercase tracking-[0.2em] text-success-green">Completed Projects</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.stats.completedProjects)}</p>
                                        <p className="text-xs text-muted-foreground">Work fully closed and ready to showcase</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveSheet('verified')}
                                        className="rounded-xl border border-kerala-blue/25 bg-kerala-blue/5 p-3 text-left transition-colors hover:bg-kerala-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        <p className="text-xs uppercase tracking-[0.2em] text-kerala-blue">Verified Outcomes</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.riskSignals.verifiedLast7)}</p>
                                        <p className="text-xs text-muted-foreground">Successfully verified in the last 7 days</p>
                                    </button>
                                    <div className="rounded-xl border border-warning-amber/25 bg-warning-amber/8 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-warning-amber">Top District</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">
                                            {data.districtRanking[0]?.district_name ?? '—'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {data.districtRanking[0]
                                                ? `${formatPercent(data.districtRanking[0].physical_achievement)} physical · ${formatPercent(data.districtRanking[0].financial_achievement)} financial`
                                                : 'No district data available'}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-warning-amber/25 bg-warning-amber/8 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-warning-amber">Top Department</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">
                                            {topPerformers[0]?.department_name ?? '—'}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {topPerformers[0]
                                                ? `Composite ${formatPercent(topPerformers[0].composite_score)} with ${formatPercent(topPerformers[0].verificationPercent)} verification`
                                                : 'No department ranking available'}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                                    <div className="rounded-xl border bg-background p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Achievement Timeline</p>
                                                <p className="mt-1 text-sm font-semibold text-foreground">Last 6 months employment growth</p>
                                            </div>
                                            <Badge variant={health.trendPercent >= 0 ? 'success' : 'warning'}>
                                                {health.trendPercent >= 0 ? '+' : '-'}{formatPercent(Math.abs(health.trendPercent))}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex items-end justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-xs text-muted-foreground">
                                                    {data.employment.trend.map((t) => `${t.month_label}: ${formatNumber(t.employment_persons)}`).join(' · ')}
                                                </p>
                                            </div>
                                            <SparkBars values={data.employment.trend.map((t) => t.employment_persons)} />
                                        </div>
                                        <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                            <div className="rounded-lg border bg-muted/20 p-3">
                                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direct Employment</p>
                                                <p className="mt-1 text-lg font-semibold text-foreground">{formatNumber(data.employment.summary.direct_persons)}</p>
                                            </div>
                                            <div className="rounded-lg border bg-muted/20 p-3">
                                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Indirect Employment</p>
                                                <p className="mt-1 text-lg font-semibold text-foreground">{formatNumber(data.employment.summary.indirect_persons)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border bg-background p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Success Stories</p>
                                                <p className="mt-1 text-sm font-semibold text-foreground">Recently verified projects</p>
                                            </div>
                                            <Badge variant="info">{formatNumber(data.employment.recentVerified.length)}</Badge>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {data.employment.recentVerified.slice(0, 4).map((row) => (
                                                <div key={`${row.project_name}-${row.verified_date ?? 'na'}`} className="rounded-lg border bg-muted/20 p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm font-medium text-foreground">{row.project_name}</p>
                                                        <Badge variant="success">{formatPercent(row.progress)}</Badge>
                                                    </div>
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        {row.department_name} · {row.district_name}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {topPerformers.slice(0, 3).map((row, index) => (
                                        <div key={`positive-top-${row.department_name}`} className="rounded-xl border bg-background p-3 shadow-sm">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Rank {index + 1}</p>
                                                <Badge variant={index === 0 ? 'success' : 'info'}>{formatPercent(row.composite_score)}</Badge>
                                            </div>
                                            <p className="mt-2 text-sm font-semibold text-foreground">{row.department_name}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {formatPercent(row.physical_achievement)} physical · {formatPercent(row.financial_achievement)} financial · {formatPercent(row.verificationPercent)} verification
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card id="evidence-of-delivery" className="scroll-mt-24 overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-kerala-blue via-success-green to-warning-amber" />
                            <CardHeader>
                                <CardTitle className="text-xl">Evidence of Delivery</CardTitle>
                                <CardDescription>
                                    Verified images, videos, and documents that prove real-world programme outcomes.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                {/* Snapshot KPI row */}
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                    <div className="rounded-xl border border-kerala-blue/25 bg-kerala-blue/5 p-3">
                                        <div className="flex items-center gap-2">
                                            <Image className="h-4 w-4 text-kerala-blue" aria-hidden="true" />
                                            <p className="text-xs uppercase tracking-[0.2em] text-kerala-blue">Verified Images</p>
                                        </div>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.evidence.snapshot.verifiedImages)}</p>
                                        <p className="text-xs text-muted-foreground">of {formatNumber(data.evidence.snapshot.totalImages)} uploaded</p>
                                    </div>
                                    <div className="rounded-xl border border-success-green/25 bg-success-green/5 p-3">
                                        <div className="flex items-center gap-2">
                                            <PlayCircle className="h-4 w-4 text-success-green" aria-hidden="true" />
                                            <p className="text-xs uppercase tracking-[0.2em] text-success-green">Verified Videos</p>
                                        </div>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.evidence.snapshot.verifiedVideos)}</p>
                                        <p className="text-xs text-muted-foreground">of {formatNumber(data.evidence.snapshot.totalVideos)} uploaded</p>
                                    </div>
                                    <div className="rounded-xl border border-warning-amber/25 bg-warning-amber/8 p-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-warning-amber" aria-hidden="true" />
                                            <p className="text-xs uppercase tracking-[0.2em] text-warning-amber">Verified Documents</p>
                                        </div>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.evidence.snapshot.verifiedDocuments)}</p>
                                        <p className="text-xs text-muted-foreground">of {formatNumber(data.evidence.snapshot.totalDocuments)} uploaded</p>
                                    </div>
                                    <div className="rounded-xl border bg-muted/20 p-3">
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Projects with Evidence</p>
                                        </div>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.evidence.snapshot.projectsWithVerifiedEvidence)}</p>
                                        <p className="text-xs text-muted-foreground">Avg turnaround {Number(data.evidence.snapshot.avgVerificationTurnaroundDays).toFixed(1)} days</p>
                                    </div>
                                </div>

                                {/* Verified highlight cards */}
                                {data.evidence.highlights.length > 0 ? (
                                    <div>
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent Verified Highlights</p>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setActiveSheet('evidence')}
                                                className="text-xs font-semibold text-kerala-blue hover:text-kerala-blue"
                                            >
                                                View All →
                                            </Button>
                                        </div>
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            {data.evidence.highlights.map((item) => {
                                                const typeLabel = item.galleryType === 1 ? 'Image' : item.galleryType === 2 ? 'Video' : 'Document';
                                                const typeColor = item.galleryType === 1
                                                    ? 'border-kerala-blue/30 bg-kerala-blue/5'
                                                    : item.galleryType === 2
                                                        ? 'border-success-green/30 bg-success-green/5'
                                                        : 'border-warning-amber/30 bg-warning-amber/8';
                                                const TypeIcon = item.galleryType === 2 ? PlayCircle : item.galleryType === 3 ? FileText : Image;
                                                const typeIconColor = item.galleryType === 1 ? 'text-kerala-blue' : item.galleryType === 2 ? 'text-success-green' : 'text-warning-amber';

                                                return (
                                                    <div key={item.galleryId} className={cn('rounded-xl border p-3 shadow-sm', typeColor)}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <TypeIcon className={cn('mt-0.5 h-4 w-4 shrink-0', typeIconColor)} aria-hidden="true" />
                                                            <Badge variant="success" className="shrink-0 text-[10px]">Verified</Badge>
                                                        </div>
                                                        <p className="mt-2 line-clamp-2 text-sm font-semibold text-foreground">{item.projectName}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">{item.departmentName}</p>
                                                        <p className="text-xs text-muted-foreground">{item.districtName}</p>
                                                        {item.description && (
                                                            <p className="mt-2 line-clamp-2 text-xs italic text-muted-foreground">{item.description}</p>
                                                        )}
                                                        <div className="mt-3 flex items-center justify-between gap-1">
                                                            <Badge variant="neutral" className="text-[10px]">{typeLabel}</Badge>
                                                            <span className="text-[10px] text-muted-foreground">
                                                                {item.verifiedDate ? new Date(item.verifiedDate).toLocaleDateString('en-IN') : '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-muted bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                                        No verified evidence items yet. Evidence appears here once gallery uploads are verified.
                                    </div>
                                )}

                                {/* Quality signals strip */}
                                {(() => {
                                    const totalUploaded = data.evidence.snapshot.totalImages + data.evidence.snapshot.totalVideos + data.evidence.snapshot.totalDocuments;
                                    const totalVerified = data.evidence.snapshot.verifiedImages + data.evidence.snapshot.verifiedVideos + data.evidence.snapshot.verifiedDocuments;
                                    const coveragePct = totalUploaded > 0 ? (totalVerified / totalUploaded) * 100 : 0;
                                    return (
                                        <div className="grid gap-3 rounded-xl border bg-muted/20 p-3 sm:grid-cols-3">
                                            <div className="text-center">
                                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Verification Coverage</p>
                                                <p className="mt-1 text-xl font-semibold text-foreground">{formatPercent(coveragePct)}</p>
                                                <p className="text-xs text-muted-foreground">{formatNumber(totalVerified)} of {formatNumber(totalUploaded)} items verified</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Avg Turnaround</p>
                                                <p className="mt-1 text-xl font-semibold text-foreground">{Number(data.evidence.snapshot.avgVerificationTurnaroundDays).toFixed(1)} days</p>
                                                <p className="text-xs text-muted-foreground">Submission to verification</p>
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Projects Covered</p>
                                                <p className="mt-1 text-xl font-semibold text-foreground">{formatNumber(data.evidence.snapshot.projectsWithVerifiedEvidence)}</p>
                                                <p className="text-xs text-muted-foreground">Have at least 1 verified item</p>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-[1.45fr_0.9fr]">
                        <Card id="attention-center" className="scroll-mt-24 overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-destructive via-warning-amber to-success-green" />
                            <CardHeader>
                                <CardTitle className="text-xl">Attention Center</CardTitle>
                                <CardDescription>
                                    Intervention queue grouped by criticality with direct navigation.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-destructive">Critical</p>
                                            <Badge variant="warning">{attention.critical.length}</Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {attention.critical.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No critical alerts.</p>
                                            ) : attention.critical.map((item) => <InsightCard key={item.key} insight={item} />)}
                                        </div>
                                    </div>
                                    <div className="space-y-2 rounded-xl border border-warning-amber/30 bg-warning-amber/8 p-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning-amber">Warning</p>
                                            <Badge variant="warning">{attention.warning.length}</Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {attention.warning.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No warning alerts.</p>
                                            ) : attention.warning.map((item) => <InsightCard key={item.key} insight={item} />)}
                                        </div>
                                    </div>
                                    <div className="space-y-2 rounded-xl border border-success-green/30 bg-success-green/5 p-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-success-green">Normal</p>
                                            <Badge variant="success">{attention.normal.length}</Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {attention.normal.length === 0 ? (
                                                <p className="text-xs text-muted-foreground">No normal signals.</p>
                                            ) : attention.normal.map((item) => <InsightCard key={item.key} insight={item} />)}
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-kerala-blue to-success-green" />
                            <CardHeader>
                                <CardTitle className="text-xl">Executive Insight Rail</CardTitle>
                                <CardDescription>
                                    Auto-generated executive signals with action hooks.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {executiveInsights.map((item) => (
                                    <InsightCard key={item.key} insight={item} />
                                ))}
                            </CardContent>
                        </Card>
                    </section>

                    <section id="district-intelligence" className="scroll-mt-24 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-success-green via-warning-amber to-destructive" />
                            <CardHeader>
                                <CardTitle className="text-xl">District Intelligence Map</CardTitle>
                                <CardDescription>
                                    Heat-grid proxy for Kerala district performance with drill-down links.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {data.districtRanking.map((row) => {
                                        const status = row.physical_achievement >= 65 && row.pending_verification === 0
                                            ? 'on-track'
                                            : row.physical_achievement >= 45
                                                ? 'watch'
                                                : 'intervention';

                                        const toneClass = status === 'on-track'
                                            ? 'border-success-green/35 bg-success-green/8'
                                            : status === 'watch'
                                                ? 'border-warning-amber/35 bg-warning-amber/10'
                                                : 'border-destructive/35 bg-destructive/7';

                                        return (
                                            <Link
                                                key={row.district_id}
                                                href={`/public/districts/${row.district_public_id ?? row.district_id}`}
                                                className={cn('rounded-xl border p-3 shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', toneClass)}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="text-sm font-semibold text-foreground">{row.district_name}</p>
                                                    <Badge variant={status === 'on-track' ? 'success' : 'warning'}>
                                                        {status === 'on-track' ? 'On Track' : status === 'watch' ? 'Watch' : 'Intervene'}
                                                    </Badge>
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    Physical {formatPercent(row.physical_achievement)} · Financial {formatPercent(row.financial_achievement)}
                                                </p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Pending verification: {formatNumber(row.pending_verification)}
                                                </p>
                                            </Link>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>

                        <Card id="verification-command" className="scroll-mt-24 overflow-hidden border shadow-sm">
                            <div className="h-1 bg-gradient-to-r from-warning-amber to-kerala-blue" />
                            <CardHeader>
                                <CardTitle className="text-xl">Verification Command Center</CardTitle>
                                <CardDescription>
                                    Operational bottleneck control for pending queue and age signals.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border border-warning-amber/25 bg-warning-amber/10 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-warning-amber">Pending Queue</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.stats.pendingVerification)}</p>
                                    </div>
                                    <div className="rounded-xl border bg-muted/30 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Average Verification Age</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">
                                            {formatPercent(
                                                data.verificationMonitoring.pendingQueue.length > 0
                                                    ? data.verificationMonitoring.pendingQueue.reduce((acc, cur) => acc + Number(cur.average_age_days), 0) /
                                                    data.verificationMonitoring.pendingQueue.length
                                                    : 0,
                                            ).replace('%', '')} days
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-background p-3">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Verification Trend</p>
                                        <Badge variant={health.trendPercent >= 0 ? 'success' : 'warning'}>
                                            {health.trendPercent >= 0 ? '+' : '-'}{formatPercent(Math.abs(health.trendPercent))}
                                        </Badge>
                                    </div>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Last 7 days: {formatNumber(data.riskSignals.verifiedLast7)}</p>
                                            <p className="text-xs text-muted-foreground">Previous 7 days: {formatNumber(data.riskSignals.verifiedPrev7)}</p>
                                        </div>
                                        <SparkBars values={[data.riskSignals.verifiedPrev7, data.riskSignals.verifiedLast7]} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {data.verificationMonitoring.pendingQueue.slice(0, 4).map((row) => (
                                        <div key={row.department_name} className="rounded-xl border bg-background p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-foreground">{row.department_name}</p>
                                                <Badge variant={row.pending_count > 10 ? 'warning' : 'info'}>{formatNumber(row.pending_count)} pending</Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">Average age {Number(row.average_age_days).toFixed(1)} days</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <section id="department-leaderboard" className="scroll-mt-24 grid gap-6 xl:grid-cols-2">
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-success-green" />
                            <CardHeader>
                                <CardTitle className="text-xl">Department Leaderboard - Top Performers</CardTitle>
                                <CardDescription>High performing departments with stronger closure posture.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Physical %</TableHead>
                                            <TableHead>Financial %</TableHead>
                                            <TableHead>Verification %</TableHead>
                                            <TableHead>Risk</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topPerformers.map((row, idx) => (
                                            <TableRow key={`top-${row.department_name}`}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell className="font-medium text-foreground">{row.department_name}</TableCell>
                                                <TableCell>{formatPercent(row.physical_achievement)}</TableCell>
                                                <TableCell>{formatPercent(row.financial_achievement)}</TableCell>
                                                <TableCell>{formatPercent(row.verificationPercent)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={row.riskScore < 35 ? 'success' : 'warning'}>
                                                        {formatPercent(row.riskScore)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>

                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-destructive" />
                            <CardHeader>
                                <CardTitle className="text-xl">Department Leaderboard - Bottom Performers</CardTitle>
                                <CardDescription>Departments requiring targeted intervention and follow-up.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Rank</TableHead>
                                            <TableHead>Department</TableHead>
                                            <TableHead>Physical %</TableHead>
                                            <TableHead>Financial %</TableHead>
                                            <TableHead>Verification %</TableHead>
                                            <TableHead>Risk</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {bottomPerformers.map((row, idx) => (
                                            <TableRow key={`bottom-${row.department_name}`}>
                                                <TableCell>{idx + 1}</TableCell>
                                                <TableCell className="font-medium text-foreground">{row.department_name}</TableCell>
                                                <TableCell>{formatPercent(row.physical_achievement)}</TableCell>
                                                <TableCell>{formatPercent(row.financial_achievement)}</TableCell>
                                                <TableCell>{formatPercent(row.verificationPercent)}</TableCell>
                                                <TableCell>
                                                    <Badge variant={row.riskScore < 35 ? 'success' : 'warning'}>
                                                        {formatPercent(row.riskScore)}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </section>

                    <section id="sector-analytics" className="scroll-mt-24 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
                        <Card className="overflow-hidden border shadow-sm">
                            <div className="h-1 bg-kerala-blue" />
                            <CardHeader>
                                <CardTitle className="text-xl">Sector Analytics</CardTitle>
                                <CardDescription>Contribution, distribution, completion ratio, and budget utilization proxies.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {data.sectorPerformance.map((sector) => {
                                    const completionRatio = sector.project_count > 0 ? (sector.completed_projects / sector.project_count) * 100 : 0;
                                    const utilizationProxy = (sector.achievement * 0.6) + (completionRatio * 0.4);
                                    return (
                                        <div key={sector.sector_name} className="rounded-xl border bg-background p-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium text-foreground">{sector.sector_name}</p>
                                                <Badge variant={sector.achievement >= 65 ? 'success' : 'warning'}>
                                                    {formatPercent(sector.achievement)}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {formatNumber(sector.project_count)} projects · {formatNumber(sector.completed_projects)} completed · completion {formatPercent(completionRatio)}
                                            </p>
                                            <div className="mt-2 h-2 rounded-full bg-muted" aria-hidden="true">
                                                <div className="h-2 rounded-full bg-kerala-blue" style={{ width: `${clamp(utilizationProxy, 0, 100)}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        <Card id="employment-impact" className="scroll-mt-24 overflow-hidden border shadow-sm">
                            <div className="h-1 bg-success-green" />
                            <CardHeader>
                                <CardTitle className="text-xl">Employment Impact</CardTitle>
                                <CardDescription>Direct, indirect, district concentration, and trend trajectory.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-xl border bg-muted/20 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Direct Employment</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.employment.summary.direct_persons)}</p>
                                    </div>
                                    <div className="rounded-xl border bg-muted/20 p-3">
                                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Indirect Employment</p>
                                        <p className="mt-1 text-2xl font-semibold text-foreground">{formatNumber(data.employment.summary.indirect_persons)}</p>
                                    </div>
                                </div>

                                <div className="rounded-xl border bg-background p-3">
                                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Employment Trend</p>
                                    <div className="mt-2 flex items-end justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-foreground">Last 6 months</p>
                                            <p className="text-xs text-muted-foreground">
                                                {data.employment.trend.map((t) => `${t.month_label}: ${formatNumber(t.employment_persons)}`).join(' · ')}
                                            </p>
                                        </div>
                                        <SparkBars values={data.employment.trend.map((t) => t.employment_persons)} />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Employment by District</p>
                                    {data.employment.byDistrict.slice(0, 5).map((row) => (
                                        <div key={row.district_id} className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
                                            <span className="text-sm text-foreground">{row.district_name}</span>
                                            <Badge variant="info">{formatNumber(row.employment_persons)}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                </>
            )}

            {/* Drill-down sheets */}
            {data && (
                <>
                    {/* Completed Projects sheet */}
                    <Sheet open={activeSheet === 'completed'} onOpenChange={(open) => !open && setActiveSheet(null)}>
                        <SheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
                            <div className="mb-6 space-y-1 border-b border-slate-100 pb-6">
                                <SheetTitle className="text-xl font-bold text-slate-900">Completed Projects</SheetTitle>
                                <SheetDescription className="text-sm text-slate-600">
                                    <span className="font-semibold text-slate-900">{formatNumber(data.stats.completedProjects)}</span> projects marked as completed and ready to showcase
                                </SheetDescription>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-3">
                                {data.departmentRanking.length > 0 ? (
                                    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-50 hover:bg-slate-50">
                                                    <TableHead className="h-11 px-4 py-2 font-semibold text-slate-700">Department</TableHead>
                                                    <TableHead className="h-11 px-4 py-2 text-center font-semibold text-slate-700">Count</TableHead>
                                                    <TableHead className="h-11 px-4 py-2 text-center font-semibold text-slate-700">Physical</TableHead>
                                                    <TableHead className="h-11 px-4 py-2 text-center font-semibold text-slate-700">Financial</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.departmentRanking.map((dept, idx) => (
                                                    <TableRow
                                                        key={dept.department_name}
                                                        className={cn(
                                                            'border-b border-slate-100 transition-colors hover:bg-slate-50/50',
                                                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30',
                                                        )}
                                                    >
                                                        <TableCell className="px-4 py-3 font-medium text-slate-900">{dept.department_name}</TableCell>
                                                        <TableCell className="px-4 py-3 text-center">
                                                            <Badge variant="secondary" className="font-semibold">{formatNumber(dept.completed_projects)}</Badge>
                                                        </TableCell>
                                                        <TableCell className="px-4 py-3 text-center">
                                                            <span className="text-sm font-semibold text-success-green">{formatPercent(dept.physical_achievement)}</span>
                                                        </TableCell>
                                                        <TableCell className="px-4 py-3 text-center">
                                                            <span className="text-sm font-semibold text-kerala-blue">{formatPercent(dept.financial_achievement)}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12">
                                        <FolderOpen className="mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
                                        <p className="text-center text-sm font-medium text-slate-600">No completed projects</p>
                                        <p className="mt-1 text-center text-xs text-slate-500">Projects will appear here once marked as completed</p>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Verified Outcomes sheet */}
                    <Sheet open={activeSheet === 'verified'} onOpenChange={(open) => !open && setActiveSheet(null)}>
                        <SheetContent side="right" className="flex w-full flex-col sm:max-w-3xl">
                            <div className="mb-6 space-y-1 border-b border-slate-100 pb-6">
                                <SheetTitle className="text-xl font-bold text-slate-900">Recently Verified Projects</SheetTitle>
                                <SheetDescription className="text-sm text-slate-600">
                                    <span className="font-semibold text-slate-900">{formatNumber(data.riskSignals.verifiedLast7)}</span> outcomes verified in the last 7 days
                                </SheetDescription>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-3">
                                {data.employment.recentVerified.length > 0 ? (
                                    <div className="space-y-3">
                                        {data.employment.recentVerified.map((row, idx) => (
                                            <div
                                                key={`${row.project_name}-${row.verified_date}`}
                                                className="group rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-kerala-blue/30 hover:bg-kerala-blue/2 hover:shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-semibold text-slate-900 group-hover:text-kerala-blue">{row.project_name}</p>
                                                        <p className="mt-1 text-xs text-slate-600">
                                                            <span className="font-medium text-slate-700">{row.department_name}</span>
                                                            <span className="mx-1.5 text-slate-400">·</span>
                                                            <span className="text-slate-600">{row.district_name}</span>
                                                        </p>
                                                    </div>
                                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                                        <Badge variant="success" className="whitespace-nowrap font-semibold">
                                                            {formatPercent(row.progress)}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-success-green" aria-hidden="true" />
                                                    <span>Verified {row.verified_date ? new Date(row.verified_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12">
                                        <CheckCircle2 className="mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
                                        <p className="text-center text-sm font-medium text-slate-600">No verified outcomes</p>
                                        <p className="mt-1 text-center text-xs text-slate-500">Recent verifications will appear here</p>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>

                    {/* Evidence drill-down sheet */}
                    <Sheet open={activeSheet === 'evidence'} onOpenChange={(open) => !open && setActiveSheet(null)}>
                        <SheetContent side="right" className="flex w-full flex-col sm:max-w-4xl">
                            <div className="mb-6 space-y-1 border-b border-slate-100 pb-6">
                                <SheetTitle className="text-xl font-bold text-slate-900">Verified Evidence Gallery</SheetTitle>
                                <SheetDescription className="text-sm text-slate-600">
                                    Coverage: <span className="font-semibold text-slate-900">{(() => {
                                        const totalUploaded = data.evidence.snapshot.totalImages + data.evidence.snapshot.totalVideos + data.evidence.snapshot.totalDocuments;
                                        const totalVerified = data.evidence.snapshot.verifiedImages + data.evidence.snapshot.verifiedVideos + data.evidence.snapshot.verifiedDocuments;
                                        const coveragePct = totalUploaded > 0 ? (totalVerified / totalUploaded) * 100 : 0;
                                        return formatPercent(coveragePct);
                                    })()}</span> verified
                                </SheetDescription>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-3">
                                {data.evidence.highlights.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {data.evidence.highlights.map((item) => {
                                            const typeLabel = item.galleryType === 1 ? 'Image' : item.galleryType === 2 ? 'Video' : 'Document';
                                            const typeColor = item.galleryType === 1
                                                ? 'border-kerala-blue/25 bg-gradient-to-br from-kerala-blue/8 to-kerala-blue/4 hover:border-kerala-blue/40 hover:from-kerala-blue/12'
                                                : item.galleryType === 2
                                                    ? 'border-success-green/25 bg-gradient-to-br from-success-green/8 to-success-green/4 hover:border-success-green/40 hover:from-success-green/12'
                                                    : 'border-warning-amber/25 bg-gradient-to-br from-warning-amber/8 to-warning-amber/4 hover:border-warning-amber/40 hover:from-warning-amber/12';
                                            const TypeIcon = item.galleryType === 2 ? PlayCircle : item.galleryType === 3 ? FileText : Image;
                                            const typeIconColor = item.galleryType === 1 ? 'text-kerala-blue' : item.galleryType === 2 ? 'text-success-green' : 'text-warning-amber';

                                            return (
                                                <div
                                                    key={item.galleryId}
                                                    className={cn(
                                                        'group rounded-lg border p-3 shadow-xs transition-all hover:shadow-sm',
                                                        typeColor,
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <TypeIcon className={cn('mt-0.5 h-4 w-4 shrink-0', typeIconColor)} aria-hidden="true" />
                                                        <Badge variant="success" className="shrink-0 text-[10px] font-semibold">
                                                            <CheckCircle2 className="mr-1 h-3 w-3" />
                                                            Verified
                                                        </Badge>
                                                    </div>
                                                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-slate-700">{item.projectName}</p>
                                                    <p className="mt-1 line-clamp-1 text-xs font-medium text-slate-700">{item.departmentName}</p>
                                                    <p className="text-xs text-slate-600">{item.districtName}</p>
                                                    {item.description && (
                                                        <p className="mt-2 line-clamp-2 text-xs italic text-slate-600">{item.description}</p>
                                                    )}
                                                    <div className="mt-3 flex items-center justify-between gap-1 border-t border-slate-200/50 pt-2">
                                                        <Badge variant="outline" className="text-[10px] font-medium">{typeLabel}</Badge>
                                                        <span className="text-[10px] font-medium text-slate-500">
                                                            {item.verifiedDate ? new Date(item.verifiedDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : '—'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-12">
                                        <Image className="mb-3 h-10 w-10 text-slate-400" aria-hidden="true" />
                                        <p className="text-center text-sm font-medium text-slate-600">No verified evidence</p>
                                        <p className="mt-1 text-center text-xs text-slate-500">Verified images, videos, and documents will appear here</p>
                                    </div>
                                )}
                            </div>
                        </SheetContent>
                    </Sheet>
                </>
            )}

            {!loading && !error && data && (
                <>
                    <div className="fixed bottom-4 right-4 z-40">
                        <Button
                            type="button"
                            onClick={() => setIsActionPanelOpen((prev) => !prev)}
                            className="h-12 rounded-full px-4 shadow-xl"
                            aria-expanded={isActionPanelOpen}
                            aria-controls="executive-recognition-command-panel"
                        >
                            <Bell className="mr-2 h-4 w-4" />
                            Recognition & Command Actions
                            <Badge variant="outline" className="ml-2 bg-white/95 text-foreground">
                                {formatNumber(floatingActionItems.length)}
                            </Badge>
                        </Button>
                    </div>

                    {isActionPanelOpen && (
                        <section
                            id="executive-recognition-command-panel"
                            className={cn(
                                'fixed bottom-20 right-4 z-40 rounded-2xl border border-kerala-blue/20 bg-background shadow-2xl',
                                isActionPanelExpanded ? 'h-[34rem] w-[min(92vw,36rem)]' : 'h-[24rem] w-[min(92vw,30rem)]',
                            )}
                            aria-label="Recognition and Command Actions panel"
                        >
                            <div className="flex items-center justify-between gap-2 border-b border-kerala-blue/10 bg-kerala-blue/5 px-4 py-3">
                                <div>
                                    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-kerala-blue">Recognition & Command Actions</h2>
                                    <p className="text-xs text-muted-foreground">Floating command window for quick executive follow-up.</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setIsActionPanelExpanded((prev) => !prev)}
                                        aria-label={isActionPanelExpanded ? 'Collapse panel' : 'Expand panel'}
                                    >
                                        <ChevronsUpDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setIsActionPanelOpen(false)}
                                        aria-label="Close panel"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            <div className="h-[calc(100%-4rem)] space-y-2 overflow-y-auto p-3">
                                {floatingActionItems.map((item) => (
                                    <Link
                                        key={item.title}
                                        href={item.href}
                                        className={cn(
                                            'block rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            item.tone === 'warning'
                                                ? 'border-warning-amber/35 bg-warning-amber/10'
                                                : item.tone === 'normal'
                                                    ? 'border-success-green/30 bg-success-green/5'
                                                    : 'border-kerala-blue/25 bg-kerala-blue/5',
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}
                </>
            )}
        </main>
    );
}

