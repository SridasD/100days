'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ArchiveDetail {
    archiveId: number;
    projectId: number;
    projectCode: string;
    projectName: string;
    department: string;
    sector: string;
    district: string;
    archivedBy: string;
    archivedAt: string;
    archiveReason: string | null;
    archivePayload: Record<string, unknown> | null;
    impactPayload: Record<string, unknown> | null;
    isRestored: boolean;
}

export default function ArchivedProjectDetailPage() {
    const params = useParams<{ projectId: string }>();
    const id = Number(params.projectId);

    const [data, setData] = useState<ArchiveDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!Number.isFinite(id)) return;
        fetch(`/api/admin/projects/archive/${id}`, { cache: 'no-store' })
            .then(async (r) => {
                if (!r.ok) {
                    const b = await r.json().catch(() => ({}));
                    throw new Error(b.error ?? `HTTP ${r.status}`);
                }
                return r.json() as Promise<{ archive: ArchiveDetail }>;
            })
            .then((j) => setData(j.archive))
            .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load archive detail'));
    }, [id]);

    return (
        <main className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Archived Project Details</h1>
                    <p className="text-sm text-muted-foreground">Immutable archive snapshot for governance and audit review.</p>
                </div>
                <Button asChild variant="outline" size="sm">
                    <Link href="/admin/projects/archive">
                        <ArrowLeft className="h-4 w-4" />
                        Back to Archive List
                    </Link>
                </Button>
            </div>

            {error && (
                <Card className="border-error-red/30 bg-error-red/5">
                    <CardContent className="py-3 text-sm text-error-red">{error}</CardContent>
                </Card>
            )}

            {!error && !data && (
                <Card>
                    <CardContent className="py-6 text-sm text-muted-foreground">Loading archive details...</CardContent>
                </Card>
            )}

            {data && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Project Snapshot</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-2">
                            <p><span className="font-medium">Code:</span> {data.projectCode}</p>
                            <p><span className="font-medium">Name:</span> {data.projectName}</p>
                            <p><span className="font-medium">Department:</span> {data.department}</p>
                            <p><span className="font-medium">Sector:</span> {data.sector}</p>
                            <p><span className="font-medium">District:</span> {data.district}</p>
                            <p><span className="font-medium">Archived By:</span> {data.archivedBy}</p>
                            <p><span className="font-medium">Archived At:</span> {new Date(data.archivedAt).toLocaleString('en-IN')}</p>
                            <p><span className="font-medium">Reason:</span> {data.archiveReason ?? '—'}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Impact Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                            <p>Total Indicators: {String(data.impactPayload?.totalIndicators ?? 0)}</p>
                            <p>Verified Indicators: {String(data.impactPayload?.verifiedIndicators ?? 0)}</p>
                            <p>Pending Verification: {String(data.impactPayload?.pendingVerification ?? 0)}</p>
                            <p>Images Uploaded: {String(data.impactPayload?.imagesUploaded ?? 0)}</p>
                            <p>Documents Uploaded: {String(data.impactPayload?.documentsUploaded ?? 0)}</p>
                            <p>Videos Uploaded: {String(data.impactPayload?.videosUploaded ?? 0)}</p>
                            <p>Total Progress Updates: {String(data.impactPayload?.totalProgressUpdates ?? 0)}</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Archive Export</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline">
                                <Link href={`/api/admin/projects/archive/${data.projectId}/export`}>Export Details (CSV)</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </>
            )}
        </main>
    );
}
