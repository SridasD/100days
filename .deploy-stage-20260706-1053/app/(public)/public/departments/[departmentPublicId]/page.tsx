'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import {
    DepartmentPage,
    type DepartmentProject,
} from '@/components/public/DepartmentPage';
import { PublicNav } from '@/components/public/PublicNav';

interface ApiResponse {
    department: {
        secId: number;
        departmentPublicId?: string;
        nameMal: string;
        stats: {
            projects: number;
            completed: number;
            indicators: number;
            media: number;
        };
        projects: DepartmentProject[];
    };
}

export default function PublicDepartmentsPage({
    params,
}: {
    params: Promise<{ departmentPublicId: string }>;
}) {
    const { departmentPublicId } = use(params);
    const router = useRouter();
    const departmentRef = departmentPublicId.trim();

    const [data, setData] = useState<ApiResponse['department'] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!departmentRef) {
            setError('Invalid department id');
            return;
        }
        let cancelled = false;
        const fetchJson = async (path: string) => {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error ?? `HTTP ${response.status}`);
            }
            return response.json() as Promise<ApiResponse>;
        };

        fetchJson(`/api/public/departments/${departmentRef}`)
            .catch(() => fetchJson(`/api/public/department/${departmentRef}`))
            .then((j) => {
                if (!cancelled) setData(j.department);
            })
            .catch((e) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Failed to load');
            });
        return () => {
            cancelled = true;
        };
    }, [departmentRef]);

    useEffect(() => {
        if (data?.departmentPublicId && data.departmentPublicId !== departmentRef) {
            router.replace(`/public/departments/${data.departmentPublicId}`);
        }
    }, [data?.departmentPublicId, departmentRef, router]);

    if (error) {
        return (
            <div className="flex min-h-screen flex-col bg-hdp-bg">
                <PublicNav />
                <div className="container mx-auto flex flex-1 items-center justify-center px-4 py-16">
                    <div className="rounded-2xl border border-error-red/30 bg-error-red/5 p-8 text-center">
                        <p className="font-malayalam text-sm font-semibold text-error-red">
                            വകുപ്പ് വിവരങ്ങൾ ലോഡുചെയ്യാൻ കഴിഞ്ഞില്ല
                        </p>
                        <p className="mt-1 text-xs text-error-red/80">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-screen flex-col bg-hdp-bg">
                <PublicNav />
                <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-malayalam">വകുപ്പ് ലോഡുചെയ്യുന്നു…</span>
                </div>
            </div>
        );
    }

    return (
        <DepartmentPage
            secId={data.secId}
            departmentPublicId={data.departmentPublicId}
            nameMal={data.nameMal}
            stats={data.stats}
            projects={data.projects}
        />
    );
}
