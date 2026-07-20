import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, CircleDashed, Clock3, Image, Video } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { isSession, requireSession, ROLE } from '@/lib/auth/session';
import { resolveProjectId } from '@/lib/db/public-id';
import { getOsdProjectIntelligence } from '@/lib/db/queries/osd-project-intelligence';

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ indicatorId?: string; returnTo?: string }>;
}

const numberFmt = new Intl.NumberFormat('en-IN');

function formatNumber(value: number) {
    return numberFmt.format(value || 0);
}

function statusTone(isCompleted: number) {
    if (isCompleted === 2) return 'success';
    if (isCompleted === 1) return 'warning';
    return 'neutral';
}

function statusLabel(isCompleted: number) {
    if (isCompleted === 2) return 'Completed';
    if (isCompleted === 1) return 'In Progress';
    return 'Not Started';
}

export default async function OsdProjectIntelligencePage({
    params,
    searchParams,
}: PageProps) {
    const sessionOrResponse = await requireSession();
    if (!isSession(sessionOrResponse)) redirect('/login');
    if (sessionOrResponse.roleId !== ROLE.OSD_ADMIN) redirect('/login');

    const { id } = await params;
    const { indicatorId, returnTo } = await searchParams;
    const focusIndicatorId = Number(indicatorId ?? 0);
    const backHref = returnTo ? decodeURIComponent(returnTo) : '/admin/osd/analytics/exceptions';

    const projectId = await resolveProjectId(id);
    if (!projectId) notFound();

    const data = await getOsdProjectIntelligence(projectId);
    if (!data) notFound();

    const p = data.project;
    const m = data.metrics;

    return (
        <main className="space-y-6">
            <section className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                        {p.projectName}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Read-only project intelligence view for OSD exception follow-up.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {p.projectCode && <Badge variant="info">Code: {p.projectCode}</Badge>}
                        <Badge variant={statusTone(p.isCompleted)}>{statusLabel(p.isCompleted)}</Badge>
                        <Badge variant="neutral">Indicators: {formatNumber(m.totalIndicators)}</Badge>
                        <Badge variant="neutral">Pending verification: {formatNumber(m.pendingVerification)}</Badge>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm" className="cursor-pointer">
                        <Link href={backHref}>
                            <ArrowLeft className="h-4 w-4" />
                            Back to Exception Monitor
                        </Link>
                    </Button>
                    <Button asChild size="sm" className="cursor-pointer">
                        <Link href={`/admin/osd/projects/${p.projectId}/edit`}>
                            Edit Project
                        </Link>
                    </Button>
                </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card className="border-warning-amber/25 bg-warning-amber/10">
                    <CardHeader className="pb-2">
                        <CardDescription>Verification Load</CardDescription>
                        <CardTitle className="text-3xl">{formatNumber(m.pendingVerification)}</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Indicators with latest submission pending verification.
                    </CardContent>
                </Card>
                <Card className="border-destructive/25 bg-destructive/5">
                    <CardHeader className="pb-2">
                        <CardDescription>Evidence Gaps</CardDescription>
                        <CardTitle className="text-3xl">{formatNumber(m.missingImage + m.missingVideo)}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs text-muted-foreground">
                        <p>Missing image/video evidence across indicators.</p>
                        <details className="rounded-md border border-destructive/20 bg-background/85 p-2">
                            <summary className="cursor-pointer select-none font-medium text-foreground">
                                How it is calculated
                            </summary>
                            <p className="mt-2">
                                Evidence Gap = Missing Image + Missing Video. An indicator contributes 1 gap if it has no image record,
                                1 gap if it has no video record, and up to 2 when both are missing.
                            </p>
                        </details>
                    </CardContent>
                </Card>
                <Card className="border-kerala-blue/20 bg-kerala-blue/5">
                    <CardHeader className="pb-2">
                        <CardDescription>Completion Health</CardDescription>
                        <CardTitle className="text-3xl">
                            {m.totalIndicators > 0
                                ? `${Math.round((m.completedIndicators / m.totalIndicators) * 100)}%`
                                : '0%'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-muted-foreground">
                        Completion ratio based on verified percentage.
                    </CardContent>
                </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Project Profile</CardTitle>
                        <CardDescription>Master project parameters and governance metadata.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div><span className="font-medium">Secretaries:</span> {p.secretaryNames.join(', ') || 'Unmapped'}</div>
                        <div><span className="font-medium">Departments:</span> {p.departmentNames.join(', ') || 'Unmapped'}</div>
                        <div><span className="font-medium">Sector:</span> {p.sectorName ?? '—'}</div>
                        <div><span className="font-medium">Funding:</span> {p.sourceOfFundingName ?? '—'}</div>
                        <div><span className="font-medium">Cost:</span> ₹ {formatNumber(p.projectCost)} Lakhs</div>
                        <div><span className="font-medium">Priority:</span> {p.priority ?? '—'}</div>
                        <div><span className="font-medium">Nature:</span> {p.natureOfProject ?? '—'}</div>
                        <div><span className="font-medium">Execution Type:</span> {p.projectExecutionType ?? '—'}</div>
                        <div><span className="font-medium">Outcome:</span> {p.projectOutcome ?? '—'}</div>
                        <div><span className="font-medium">Description:</span> {p.description ?? '—'}</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Employment & Linkages</CardTitle>
                        <CardDescription>Employment contribution and strategic alignment fields.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                        <div><span className="font-medium">Direct:</span> {formatNumber(p.noDaysEmployedDirect)} days / {formatNumber(p.noPersonsEmployedDirect)} persons</div>
                        <div><span className="font-medium">Indirect:</span> {formatNumber(p.noDaysEmployedIndirect)} days / {formatNumber(p.noPersonsEmployedIndirect)} persons</div>
                        <div><span className="font-medium">Govt Policy Linkage:</span> {p.govtPolicyLinkage ?? '—'}</div>
                        <div><span className="font-medium">Manifesto Linkage:</span> {p.manifestoLinkage ?? '—'}</div>
                        <div><span className="font-medium">Other Benefits:</span> {p.otherBenefits ?? '—'}</div>
                        <div><span className="font-medium">Extra 1:</span> {p.extraOne ?? '—'}</div>
                        <div><span className="font-medium">Extra 2:</span> {p.extraTwo ?? '—'}</div>
                        <div><span className="font-medium">Extra 3:</span> {p.extraThree ?? '—'}</div>
                    </CardContent>
                </Card>
            </section>

            <section>
                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle>Indicator Intelligence</CardTitle>
                        <CardDescription>
                            All indicators under this project with verification and evidence status. {focusIndicatorId > 0 ? `Focused indicator: ${focusIndicatorId}` : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Indicator</TableHead>
                                    <TableHead>District</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Verification</TableHead>
                                    <TableHead>Evidence</TableHead>
                                    <TableHead>Status Signals</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.indicators.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                                            No indicators found for this project.
                                        </TableCell>
                                    </TableRow>
                                ) : data.indicators.map((ind) => (
                                    <TableRow
                                        key={ind.indicatorId}
                                        className={focusIndicatorId === ind.indicatorId ? 'bg-kerala-blue/10' : ''}
                                    >
                                        <TableCell>
                                            <div className="space-y-1">
                                                <p className="font-medium text-foreground">{ind.indicatorName}</p>
                                                <p className="text-xs text-muted-foreground">ID {ind.indicatorId}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{ind.districtName ?? '—'}</TableCell>
                                        <TableCell>
                                            <div className="space-y-1">
                                                <p className="text-xs text-muted-foreground">Target {ind.physicalTarget} {ind.unit ?? ''}</p>
                                                <p className="text-xs text-muted-foreground">Achieved {ind.verifiedPhysicalAchievement || ind.physicalAchievement}</p>
                                                <Badge variant="info">{Math.round(ind.verifiedPercentage)}%</Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 text-xs text-muted-foreground">
                                                <p>Submitted: {ind.submittedDate ? new Date(ind.submittedDate).toLocaleDateString('en-IN') : '—'}</p>
                                                <p>Verified: {ind.verifiedDate ? new Date(ind.verifiedDate).toLocaleDateString('en-IN') : '—'}</p>
                                                <p>Completed: {ind.completedDate ? new Date(ind.completedDate).toLocaleDateString('en-IN') : '—'}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant={ind.hasImage ? 'success' : 'warning'}>
                                                    <Image className="h-3.5 w-3.5" />
                                                    {ind.imageCount}
                                                </Badge>
                                                <Badge variant={ind.hasVideo ? 'success' : 'warning'}>
                                                    <Video className="h-3.5 w-3.5" />
                                                    {ind.videoCount}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {ind.isPendingVerification && (
                                                    <Badge variant="warning">
                                                        <Clock3 className="h-3.5 w-3.5" />
                                                        Pending{ind.pendingAgeDays != null ? ` ${ind.pendingAgeDays.toFixed(1)}d` : ''}
                                                    </Badge>
                                                )}
                                                {ind.noProgressSubmitted && (
                                                    <Badge variant="warning">
                                                        <CircleDashed className="h-3.5 w-3.5" />
                                                        No progress
                                                    </Badge>
                                                )}
                                                {ind.completedMissingDate && (
                                                    <Badge variant="warning">Completed date missing</Badge>
                                                )}
                                                {!ind.isPendingVerification && !ind.noProgressSubmitted && !ind.completedMissingDate && (
                                                    <Badge variant="success">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Healthy
                                                    </Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-end gap-2">
                                                <Button asChild size="sm" variant="ghost" className="cursor-pointer">
                                                    <Link href={`/admin/osd/indicators/${ind.indicatorId}?returnTo=${encodeURIComponent(backHref)}`}>View</Link>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </section>
        </main>
    );
}
