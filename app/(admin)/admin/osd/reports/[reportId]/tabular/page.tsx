import { ReportTabularPage } from '@/components/reports/ReportTabularPage';

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