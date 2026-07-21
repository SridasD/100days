import { redirect } from 'next/navigation';

// /projects/[projectId]/indicators/[indicatorId]/video
//   → /officer/projects/[pid]/indicators/[indicatorId]/video
// (canonical URL per Blueprint Appendix C.11).
export default async function EmbedVideoRedirect({
  params,
}: {
  params: Promise<{ projectId: string; indicatorId: string }>;
}) {
  const { projectId, indicatorId } = await params;
  redirect(
    `/officer/projects/${projectId}/indicators/${indicatorId}/video`,
  );
}
