import { redirect } from 'next/navigation';

export default async function DepartmentProjectAliasPage({
    params,
}: {
    params: Promise<{
        departmentPublicId: string;
        projectPublicId: string;
    }>;
}) {
    const { projectPublicId } = await params;
    // Canonical project detail page remains /public/projects/[id].
    // This nested route provides a stable alias under the canonical
    // departments path and keeps deep links readable.
    redirect(`/public/projects/${projectPublicId}`);
}
