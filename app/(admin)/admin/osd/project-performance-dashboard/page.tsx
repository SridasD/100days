import { ReportTabularPage } from '@/components/reports/ReportTabularPage';

// Queries hdp.indicators directly with no dynamic-API usage, so Next.js would
// otherwise statically prerender this at build time and freeze the data.
export const dynamic = 'force-dynamic';

// Default landing dashboard for the OSD Admin role — renders the same
// lagging-analysis tabular report as /admin/osd/reports/lagging-analysis/tabular,
// under a friendlier, stable URL that doesn't depend on the reportId param.
export default function ProjectPerformanceDashboardPage() {
    return (
        <ReportTabularPage
            reportId="lagging-analysis"
            title="Dashboard"
            isOsd={true}
            showHierarchyToggle={false}
        />
    );
}
