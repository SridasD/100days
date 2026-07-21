import { ReportTabularPage } from '@/components/reports/ReportTabularPage';

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
