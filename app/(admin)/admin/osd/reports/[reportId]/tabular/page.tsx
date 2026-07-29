import { ReportTabularPage } from '@/components/reports/ReportTabularPage';

// Queries hdp.indicators directly with no dynamic-API usage, so Next.js would
// otherwise statically prerender this at build time and freeze the data.
export const dynamic = 'force-dynamic';

const REPORT_TITLES: Record<string, string> = {
    'lagging-analysis': 'Project Progress & Performance Review - Tabular View',
};

type PageProps = {
    params: Promise<{ reportId: string }>;
};

export default async function ReportTabularViewPage({ params }: PageProps) {
    const { reportId } = await params;
    const title = REPORT_TITLES[reportId] ?? 'Report Preview';

    return <ReportTabularPage reportId={reportId} title={title} isOsd={true} />;
}