import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function OfficerEmbedVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Embed Video (indicator_id=${id})`}
      route="/officer/indicators/[id]/video"
      section="Appendix C.5 — Embed Video"
      description="Videos are NOT file uploads — they are YouTube/Facebook embed codes/URLs. Saved to hdp.gallery with gallery_type=2, embed URL stored in image_path."
    />
  );
}
