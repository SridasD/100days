import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
    ArrowLeft,
    CheckCircle2,
    CircleDashed,
    Clock3,
    Image,
    TriangleAlert,
    Video,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isSession, requireSession, ROLE } from '@/lib/auth/session';
import { getOsdIndicatorIntelligence } from '@/lib/db/queries/osd-indicator-intelligence';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ returnTo?: string }>;
}

const numberFmt = new Intl.NumberFormat('en-IN');

function formatNumber(value: number) {
    return numberFmt.format(value || 0);
}

export default async function OsdIndicatorIntelligencePage({ params, searchParams }: PageProps) {
    const sessionOrResponse = await requireSession();
    if (!isSession(sessionOrResponse)) redirect('/login');
    if (sessionOrResponse.roleId !== ROLE.OSD_ADMIN) redirect('/login');

    const { id } = await params;
    const { returnTo } = await searchParams;
    const indicatorId = Number(id);
    if (!Number.isFinite(indicatorId) || indicatorId <= 0) notFound();
    const backHref = returnTo ? decodeURIComponent(returnTo) : '/admin/osd/analytics/exceptions';

    const data = await getOsdIndicatorIntelligence(indicatorId);
    if (!data) notFound();

    const statusBadges: Array<{ key: string; label: string }> = [];
    if (data.isPendingVerification) statusBadges.push({ key: 'pending', label: 'Pending Verification' });
    if (data.noProgressSubmitted) statusBadges.push({ key: 'noprogress', label: 'No Progress Submitted' });
    if (data.completedMissingDate) statusBadges.push({ key: 'missingdate', label: 'Completed Date Missing' });

    return (
        <main className="space-y-6">
            <section className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {data.indicatorName}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Read-only indicator intelligence view for OSD exception review.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="info">Indicator ID: {data.indicatorId}</Badge>
                        {data.projectCode && <Badge variant="neutral">Project: {data.projectCode}</Badge>}
                        <Badge variant="neutral">District: {data.districtName ?? '—'}</Badge>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="cursor-pointer">
                        <Link href={backHref}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to Exception Monitor
                        </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="cursor-pointer">
                        <Link href={`/admin/osd/projects/${data.projectId}?indicatorId=${data.indicatorId}&returnTo=${encodeURIComponent(backHref)}`}>
                            View Project Context
                        </Link>
                    </Button>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="border-warning-amber/25 bg-warning-amber/10">
                    <CardHeader className="pb-2">
                        <CardDescription>Verification Progress</CardDescription>
                        <CardTitle className="text-3xl">{Math.round(data.verifiedPercentage)}%</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Verified percentage for this indicator.
                    </CardContent>
                </Card>
                <Card className="border-destructive/25 bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardDescription>Evidence Coverage</CardDescription>
                        <CardTitle className="text-3xl">{formatNumber(data.imageCount + data.videoCount)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Total image/video evidence records.
                    </CardContent>
                </Card>
                <Card className="border-kerala-blue/20 bg-kerala-blue/5">
                    <CardHeader className="pb-2">
                        <CardDescription>Pending Age</CardDescription>
                        <CardTitle className="text-3xl">
                            {data.pendingAgeDays != null ? `${data.pendingAgeDays.toFixed(1)}d` : '—'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Age since submission if pending verification.
                    </CardContent>
                </Card>
                <Card className="border-success-green/25 bg-success-green/10">
                    <CardHeader className="pb-2">
                        <CardDescription>Completion Date</CardDescription>
                        <CardTitle className="text-xl">
                            {data.completedDate ? new Date(data.completedDate).toLocaleDateString('en-IN') : 'Not Marked'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Completion-date status for closure governance.
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Indicator Profile</CardTitle>
                        <CardDescription>Core indicator parameters and current values.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div><span className="font-medium">Project:</span> {data.projectName}</div>
                        <div><span className="font-medium">Secretaries:</span> {data.secretaryNames.join(', ') || 'Unmapped'}</div>
                        <div><span className="font-medium">Departments:</span> {data.departmentNames.join(', ') || 'Unmapped'}</div>
                        <div><span className="font-medium">Unit:</span> {data.unit ?? '—'}</div>
                        <div><span className="font-medium">Financial Target:</span> ₹ {formatNumber(data.financialTarget)} Lakhs</div>
                        <div><span className="font-medium">Physical Target:</span> {formatNumber(data.physicalTarget)}</div>
                        <div><span className="font-medium">Physical Achievement:</span> {formatNumber(data.physicalAchievement)}</div>
                        <div><span className="font-medium">Verified Physical Achievement:</span> {formatNumber(data.verifiedPhysicalAchievement)}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Status Signals</CardTitle>
                        <CardDescription>Risk and workflow signals for this indicator.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            {statusBadges.length > 0 ? statusBadges.map((item) => (
                                <Badge key={item.key} variant="warning">{item.label}</Badge>
                            )) : (
                                <Badge variant="success">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Healthy
                                </Badge>
                            )}
                        </div>

                        <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                            <div className="rounded-lg border border-muted p-3">
                                <p className="font-medium text-foreground">Verification Timeline</p>
                                <p className="mt-1">Submitted: {data.submittedDate ? new Date(data.submittedDate).toLocaleDateString('en-IN') : '—'}</p>
                                <p>Verified: {data.verifiedDate ? new Date(data.verifiedDate).toLocaleDateString('en-IN') : '—'}</p>
                                <p>Completed: {data.completedDate ? new Date(data.completedDate).toLocaleDateString('en-IN') : '—'}</p>
                            </div>
                            <div className="rounded-lg border border-muted p-3">
                                <p className="font-medium text-foreground">Evidence Summary</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Badge variant={data.hasImage ? 'success' : 'warning'}>
                                        <Image className="h-3.5 w-3.5" />
                                        Images {formatNumber(data.imageCount)}
                                    </Badge>
                                    <Badge variant={data.hasVideo ? 'success' : 'warning'}>
                                        <Video className="h-3.5 w-3.5" />
                                        Videos {formatNumber(data.videoCount)}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-warning-amber/25 bg-warning-amber/10 p-3 text-xs text-muted-foreground">
                            <p className="flex items-center gap-2 font-semibold text-foreground">
                                <TriangleAlert className="h-4 w-4 text-warning-amber" />
                                OSD Follow-up Guidance
                            </p>
                            <p className="mt-1">Use this view to review full indicator context before taking verify/edit actions.</p>
                            <p>Keep edit workflows separate to avoid accidental state changes during governance review.</p>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section className="rounded-xl border border-muted bg-background/80 p-4 text-xs text-muted-foreground">
                <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                    <Clock3 className="h-3.5 w-3.5" />
                    Quick Facts
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                    <span>Pending verification: {data.isPendingVerification ? 'Yes' : 'No'}</span>
                    <span>No progress submitted: {data.noProgressSubmitted ? 'Yes' : 'No'}</span>
                    <span>Completed date missing: {data.completedMissingDate ? 'Yes' : 'No'}</span>
                    <span>Verification %: {Math.round(data.verifiedPercentage)}%</span>
                </div>
            </section>
        </main>
    );
}
