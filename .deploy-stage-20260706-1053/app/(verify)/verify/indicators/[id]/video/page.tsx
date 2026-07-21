import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function VerifyEmbedVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Verifier Embed Video (indicator_id=${id})`}
      route="/verify/indicators/[id]/video"
      section="Appendix C.7/C.12 — Verifier can embed videos"
      description="Same embed component as Nodal Officer (Appendix C.5). Saves to hdp.gallery with gallery_type=2."
    />
  );
}
