import { redirect } from 'next/navigation';

// Deprecated: progress entry is now a slide-over sheet. Redirect deep links
// to the canonical indicator list URL.
export default async function ProgressDeprecated({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/officer/projects/${projectId}/indicators`);
}
