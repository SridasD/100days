import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function VerifyUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Verifier Upload (indicator_id=${id})`}
      route="/verify/indicators/[id]/upload"
      section="Appendix C.7/C.12 — Verifier can also upload media"
      description="Same upload component as Nodal Officer (Appendix C.4) — Verification Officers can add evidence too."
    />
  );
}
