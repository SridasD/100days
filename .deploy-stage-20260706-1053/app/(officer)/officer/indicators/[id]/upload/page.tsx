import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function OfficerUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Upload Images/Documents (indicator_id=${id})`}
      route="/officer/indicators/[id]/upload"
      section="Appendix C.4 — Upload Gallery"
      description="Accepted: .jpg/.jpeg/.png/.pdf, max 5MB. Maps to hdp.gallery (gallery_type=1) or hdp.documents. Includes existing gallery + document list."
    />
  );
}
