import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function ProjectIndicatorDetailPage({
  params,
}: {
  params: Promise<{ sec_id: string; project_id: string }>;
}) {
  const { sec_id, project_id } = await params;
  return (
    <PagePlaceholder
      title={`Project Indicator Detail (project_id=${project_id})`}
      route="/public/department/[sec_id]/project/[project_id]"
      section="Appendix B.3 — Indicator Detail"
      description="Indicator cards with progress bars (physical + financial), district card, location/lat-lng card, beneficiary tag pills, media count badges."
    >
      <p className="mt-2 text-xs text-muted-foreground">sec_id={sec_id}</p>
    </PagePlaceholder>
  );
}
