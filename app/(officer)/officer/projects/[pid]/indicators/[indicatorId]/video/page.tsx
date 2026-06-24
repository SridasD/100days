import { redirect } from 'next/navigation';

// Video embedding is now a tab inside the IndicatorActionSheet
// (see components/sheets/IndicatorActionSheet.tsx). This page exists only
// to redirect deep links back to the indicator list.
export default async function VideoDeprecated({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const { pid } = await params;
  redirect(`/officer/projects/${pid}/indicators`);
}
