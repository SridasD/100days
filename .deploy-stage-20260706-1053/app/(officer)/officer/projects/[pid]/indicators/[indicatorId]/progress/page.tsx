import { redirect } from 'next/navigation';

// Progress entry is now a slide-over sheet that opens over the indicator
// table — see components/forms/ProgressUpdateSheet.tsx. This page is kept
// only to redirect deep links back to the indicator list, where the sheet
// can be triggered from the "Update Progress" button.
export default async function ProgressDeprecated({
  params,
}: {
  params: Promise<{ pid: string }>;
}) {
  const { pid } = await params;
  redirect(`/officer/projects/${pid}/indicators`);
}
