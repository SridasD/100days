import { PagePlaceholder } from '@/components/layout/page-placeholder';

export default function PublicCompletedProjectsPage() {
  return (
    <PagePlaceholder
      title="Completed Projects"
      route="/public/completed"
      section="Appendix A.4 — Completed Projects Report"
      description="Filter on is_completed = 2. Columns: Department, Project Code (HDP-4-{id}), Name, Cost (Lakhs), Nature, Priority, Completion Date."
    />
  );
}
