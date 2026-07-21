import { ReportViewerPage } from '@/components/reports/ReportViewerPage';

const REPORT_TITLES: Record<string, string> = {
    'lagging-analysis': 'Project Progress & Performance Review',
};

type PageProps = {
    params: Promise<{ reportId: string }>;
    searchParams: Promise<{ q?: string; risk?: string }>;
};

export default async function ReportViewPage({ params, searchParams }: PageProps) {
    const { reportId } = await params;
    const { q, risk } = await searchParams;
    const title = REPORT_TITLES[reportId] ?? 'Report Preview';

    return <ReportViewerPage reportId={reportId} title={title} isOsd={true} searchQuery={q ?? ''} riskFilter={risk ?? 'all'} />;
}