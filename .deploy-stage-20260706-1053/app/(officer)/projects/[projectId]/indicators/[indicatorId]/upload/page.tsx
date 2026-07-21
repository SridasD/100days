import { redirect } from 'next/navigation';

// /projects/[projectId]/indicators/[indicatorId]/upload
//   → /officer/projects/[pid]/indicators/[indicatorId]/upload
// (canonical URL per Blueprint Appendix C.11).
export default async function UploadRedirect({
  params,
}: {
  params: Promise<{ projectId: string; indicatorId: string }>;
}) {
  const { projectId, indicatorId } = await params;
  redirect(
    `/officer/projects/${projectId}/indicators/${indicatorId}/upload`,
  );
}
