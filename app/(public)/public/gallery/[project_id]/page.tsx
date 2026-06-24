import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function PublicGalleryPage({
  params,
}: {
  params: Promise<{ project_id: string }>;
}) {
  const { project_id } = await params;
  return (
    <PagePlaceholder
      title={`Media Gallery (project_id=${project_id})`}
      route="/public/gallery/[project_id]"
      section="Appendix B.4 — Media Gallery"
      description="Tabbed images/videos (ചിത്രങ്ങൾ / വീഡിയോകൾ), accordion per indicator, lightbox viewer. Videos rendered as embed URLs from hdp.gallery."
    />
  );
}
