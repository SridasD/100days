import { redirect } from 'next/navigation';

// /projects/[projectId]/indicators → /officer/projects/[pid]/indicators
// (canonical URL per Blueprint Appendix C.11).
export default async function ProjectIndicatorsRedirect({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/officer/projects/${projectId}/indicators`);
}
