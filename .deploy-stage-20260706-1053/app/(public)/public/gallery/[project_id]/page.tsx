import { redirect } from 'next/navigation';

const LEGACY_ALIAS_SUNSET = '2026-12-31';

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  // Legacy gallery deep-link route retained for compatibility.
  // Canonical path is /public/gallery/projects/[projectPublicId].
  console.info(
    `[legacy-alias-hit] /public/gallery/${project_id} -> /public/gallery/projects/${project_id} (sunset ${LEGACY_ALIAS_SUNSET})`,
  );
  redirect(`/public/gallery/projects/${project_id}`);
}
