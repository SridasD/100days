import { redirect } from 'next/navigation';

const LEGACY_ALIAS_SUNSET = '2026-12-31';

export default async function PublicDistrictLegacyAliasPage({
  params,
}: {
  params: Promise<{ district_id: string }>;
}) {
  const { district_id } = await params;
  console.info(
    `[legacy-alias-hit] /public/district/${district_id} -> /public/districts/${district_id} (sunset ${LEGACY_ALIAS_SUNSET})`,
  );
  redirect(`/public/districts/${district_id}`);
}
