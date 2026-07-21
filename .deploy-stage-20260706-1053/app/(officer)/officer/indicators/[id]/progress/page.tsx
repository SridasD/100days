import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default async function OfficerUpdateProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title={`Update Progress (indicator_id=${id})`}
      route="/officer/indicators/[id]/progress"
      section="Appendix C.3 — Update Indicator Progress Form"
      description="Read-only header (project name, indicator, targets). Editable 4-col grid: physical/financial achievement, % auto-calc, completed date, achieved direct/indirect (days, persons), description. SUBMIT → sets submitted_by + submitted_date."
    />
  );
}
