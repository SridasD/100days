import { redirect } from 'next/navigation';

const LEGACY_ALIAS_SUNSET = '2026-12-31';

// Canonical department URL is /public/departments/[departmentPublicId].
// This short URL remains as a compatibility alias.
export default async function DepartmentRedirect({
  params,
}: {
  params: Promise<{ secId: string }>;
}) {
  const { secId } = await params;
  console.info(
    `[legacy-alias-hit] /department/${secId} -> /public/departments/${secId} (sunset ${LEGACY_ALIAS_SUNSET})`,
  );
  redirect(`/public/departments/${secId}`);
}
