import { redirect } from 'next/navigation';

export default async function PublicGalleryProjectAliasPage({
    params,
}: {
    params: Promise<{ projectPublicId: string }>;
}) {
    const { projectPublicId } = await params;
    // Canonical gallery route alias for public deep links.
    // Current public project detail already contains gallery content.
    redirect(`/public/projects/${projectPublicId}`);
}
