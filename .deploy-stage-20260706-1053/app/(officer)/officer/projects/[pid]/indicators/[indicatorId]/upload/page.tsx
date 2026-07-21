import { redirect } from 'next/navigation';

// Upload is now a tab inside the IndicatorActionSheet (see
// components/sheets/IndicatorActionSheet.tsx). This page exists only to
// redirect deep links back to the indicator list.
export default async function UploadDeprecated({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const { pid } = await params;
  redirect(`/officer/projects/${pid}/indicators`);
}
