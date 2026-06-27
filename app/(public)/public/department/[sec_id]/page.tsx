import { redirect } from 'next/navigation';

const LEGACY_ALIAS_SUNSET = '2026-12-31';

export default async function DepartmentLegacyRedirect({
  params,
}: {
  params: Promise<{ sec_id: string }>;
}) {
  const { sec_id } = await params;
  console.info(
    `[legacy-alias-hit] /public/department/${sec_id} -> /public/departments/${sec_id} (sunset ${LEGACY_ALIAS_SUNSET})`,
  );
  redirect(`/public/departments/${sec_id}`);
}
