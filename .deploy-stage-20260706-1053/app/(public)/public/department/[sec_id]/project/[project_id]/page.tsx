import { redirect } from 'next/navigation';

const LEGACY_ALIAS_SUNSET = '2026-12-31';

export default async function ProjectIndicatorDetailPage({
  params,
}: {
  params: Promise<{ sec_id: string; project_id: string }>;
}) {
  const { sec_id, project_id } = await params;
  // Legacy singular nested path now redirects to the canonical
  // departments/projects alias.
  console.info(
    `[legacy-alias-hit] /public/department/${sec_id}/project/${project_id} -> /public/departments/${sec_id}/projects/${project_id} (sunset ${LEGACY_ALIAS_SUNSET})`,
  );
  redirect(`/public/departments/${sec_id}/projects/${project_id}`);
}
