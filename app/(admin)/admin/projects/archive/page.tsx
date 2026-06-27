'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, Download, FolderArchive, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ArchivedProject {
    archiveId: number;
    projectId: number;
    projectPublicId: string | null;
    projectCode: string;
    projectName: string;
    department: string;
    sector: string;
    district: string;
    originalStatus: number;
    archivedBy: string;
    archivedById: number | null;
    archivedAt: string;
}

function statusLabel(v: number) {
    if (v === 2) return 'Completed';
    if (v === 1) return 'In Progress';
    return 'Not Started';
}

function ArchivedProjectsPageContent() {
    const [rows, setRows] = useState<ArchivedProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<number | null>(null);

    const [search, setSearch] = useState('');
    const [department, setDepartment] = useState('');
    const [sector, setSector] = useState('');
    const [district, setDistrict] = useState('');
    const [archivedBy, setArchivedBy] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const restoredCode = searchParams.get('restored');

    const query = useMemo(() => {
        const q = new URLSearchParams();
        if (search.trim()) q.set('search', search.trim());
        if (department.trim()) q.set('department', department.trim());
        if (sector.trim()) q.set('sector', sector.trim());
        if (district.trim()) q.set('district', district.trim());
        if (archivedBy.trim()) q.set('archivedBy', archivedBy.trim());
        if (fromDate) q.set('fromDate', fromDate);
        if (toDate) q.set('toDate', toDate);
        return q.toString();
    }, [search, department, sector, district, archivedBy, fromDate, toDate]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/admin/projects/archive${query ? `?${query}` : ''}`, {
                    cache: 'no-store',
                });
                if (!res.ok) {
                    const b = await res.json().catch(() => ({}));
                    throw new Error(b.error ?? `HTTP ${res.status}`);
                }
                const json = (await res.json()) as { archivedProjects: ArchivedProject[] };
                setRows(json.archivedProjects ?? []);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to load archived projects');
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [query]);

    const restoreProject = async (project: ArchivedProject) => {
        const ok = window.confirm(
            `Restore ${project.projectCode} to active projects?\n\nThis action requires Admin authorization and will make it visible in active dashboards and listings again.`,
        );
        if (!ok) return;

        setRestoringId(project.projectId);
        setError(null);
        try {
            const res = await fetch(`/api/admin/projects/archive/${project.projectPublicId ?? project.projectId}/restore`, {
                method: 'POST',
            });
            const b = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(b.error ?? `HTTP ${res.status}`);

            setRows((prev) => prev.filter((r) => r.projectId !== project.projectId));
            router.replace(`${pathname}?restored=${encodeURIComponent(project.projectCode)}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to restore project');
        } finally {
            setRestoringId(null);
        }
    };

    return (
        <main className="space-y-6">
            {restoredCode && (
                <Card className="border-success-green/30 bg-success-green/5">
                    <CardContent className="py-3 text-sm text-success-green">
                        Project restored successfully: <span className="font-mono font-semibold">{restoredCode}</span>
                    </CardContent>
                </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Project Archive</h1>
                    <p className="text-sm text-muted-foreground">
                        Archived projects are preserved for audit, reporting, and controlled restoration.
                    </p>
                </div>
                <Button asChild variant="outline" size="sm" className="cursor-pointer">
                    <Link href="/admin/projects">
                        <ArrowLeft className="h-4 w-4" />
                        Return to Project List
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-8" placeholder="Code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <Input placeholder="Department" value={department} onChange={(e) => setDepartment(e.target.value)} />
                        <Input placeholder="Sector" value={sector} onChange={(e) => setSector(e.target.value)} />
                        <Input placeholder="District" value={district} onChange={(e) => setDistrict(e.target.value)} />
                        <Input placeholder="Archived By (name or user ID)" value={archivedBy} onChange={(e) => setArchivedBy(e.target.value)} />
                        <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                </CardContent>
            </Card>

            {error && (
                <Card className="border-error-red/30 bg-error-red/5">
                    <CardContent className="py-3 text-sm text-error-red">{error}</CardContent>
                </Card>
            )}

            <Card>
                <CardContent className="pt-6">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading archived projects...</p>
                    ) : rows.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FolderArchive className="h-4 w-4" />
                            No archived projects match your filters.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Project Code</TableHead>
                                        <TableHead>Project Name</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Archived By</TableHead>
                                        <TableHead>Archived Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows.map((r) => (
                                        <TableRow key={r.archiveId}>
                                            <TableCell className="font-mono text-xs">{r.projectCode}</TableCell>
                                            <TableCell className="font-medium">{r.projectName}</TableCell>
                                            <TableCell>{r.department}</TableCell>
                                            <TableCell>{r.archivedBy}</TableCell>
                                            <TableCell>{new Date(r.archivedAt).toLocaleString('en-IN')}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{statusLabel(r.originalStatus)}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/admin/projects/archive/${r.projectPublicId ?? r.projectId}`}>View Details</Link>
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => void restoreProject(r)}
                                                        disabled={restoringId === r.projectId}
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                        {restoringId === r.projectId ? 'Restoring...' : 'Restore'}
                                                    </Button>
                                                    <Button asChild variant="outline" size="sm">
                                                        <Link href={`/api/admin/projects/archive/${r.projectPublicId ?? r.projectId}/export`}>
                                                            <Download className="h-3.5 w-3.5" />
                                                            Export
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </main>
    );
}

export default function ArchivedProjectsPage() {
    return (
        <Suspense
            fallback={
                <main className="space-y-6">
                    <Card>
                        <CardContent className="py-6 text-sm text-muted-foreground">Loading archived projects...</CardContent>
                    </Card>
                </main>
            }
        >
            <ArchivedProjectsPageContent />
        </Suspense>
    );
}
