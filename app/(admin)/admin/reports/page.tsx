'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, AlertTriangle, ArrowLeft, FileBarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const reports = [
  {
    id: 'department',
    title: 'Department-wise Report',
    description: 'Project and indicator breakdown by department',
    sections: ['By Secretary', 'District Breakdown', 'Indicator Completion Status'],
  },
  {
    id: 'state-average',
    title: 'State Average Report',
    description:
      "Compare every department's verified physical progress against the overall State Average and identify top and bottom performing departments.",
    sections: ['Verified Progress Only', 'Department Comparison', 'Top/Bottom Performers'],
  },
];

export default function AdminReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const pathname = usePathname();
  const isOsd = pathname.startsWith('/admin/osd');
  const dashboardPath = isOsd ? '/admin/osd/project-performance-dashboard' : '/admin/dashboard';

  const getAttachmentFilename = (response: Response, fallback: string) => {
    const contentDisposition = response.headers.get('content-disposition') ?? '';
    const match = contentDisposition.match(/filename="([^"]+)"/i);
    return match?.[1] ?? fallback;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const readErrorMessage = async (response: Response) => {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = await response.json().catch(() => null);
      if (payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
      }
    }

    const text = await response.text().catch(() => '');
    return text.trim() || `HTTP ${response.status}`;
  };

  const handleExport = async (reportId: string) => {
    setExporting(reportId);
    try {
      const xlsxResponse = await fetch(
        `/api/admin/reports/${reportId}?format=xlsx`,
      );

      if (xlsxResponse.ok) {
        const blob = await xlsxResponse.blob();
        const filename = getAttachmentFilename(
          xlsxResponse,
          `${reportId}-report.xlsx`,
        );
        downloadBlob(blob, filename);
        return;
      }

      const xlsxError = await readErrorMessage(xlsxResponse);

      // Graceful fallback so users can still export data even when XLSX generation fails.
      const csvResponse = await fetch(
        `/api/admin/reports/${reportId}?format=csv`,
      );
      if (csvResponse.ok) {
        const blob = await csvResponse.blob();
        const filename = getAttachmentFilename(
          csvResponse,
          `${reportId}-report.csv`,
        );
        downloadBlob(blob, filename);
        alert(`Excel export failed (${xlsxError}). CSV exported instead.`);
        return;
      }

      const csvError = await readErrorMessage(csvResponse);
      throw new Error(`${xlsxError}; CSV fallback failed: ${csvError}`);
    } catch (e) {
      alert(`Failed to export: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <main className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border bg-[linear-gradient(135deg,rgba(255,255,255,1)_0%,rgba(247,249,252,1)_58%,rgba(241,246,240,1)_100%)] shadow-sm">
        <div className="flex flex-col gap-4 p-6 lg:flex-row lg:items-end lg:justify-between lg:p-8">
          <div className="space-y-3">
            {isOsd ? (
              <Button asChild variant="outline" size="sm" className="mb-2">
                <Link href={dashboardPath}>
                  <ArrowLeft className="h-4 w-4" />
                  Return to Dashboard
                </Link>
              </Button>
            ) : null}
            <div className="inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-sm">
              <FileBarChart2 className="h-3.5 w-3.5 text-kerala-blue" />
              {isOsd ? 'Executive Reports' : 'Reports & Analytics'}
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Reports & Analytics
              </h1>
              <p className="text-sm text-muted-foreground">
                Generate and export programme reports in Excel format.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{reports.length} report templates</Badge>
            <Badge variant="outline">Excel export</Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {report.title}
                <Badge variant="outline" className="ml-2">
                  {report.id}
                </Badge>
              </CardTitle>
              <CardDescription>
                {report.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Includes
                </p>
                <ul className="mt-2 space-y-1 text-sm">
                  {report.sections.map((section, i) => (
                    <li
                      key={i}
                      className="text-muted-foreground before:mr-2 before:content-['•']"
                    >
                      {section}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting === report.id}
                  onClick={() => handleExport(report.id)}
                  className="cursor-pointer flex-1"
                >
                  <Download className="h-3 w-3" />
                  Excel
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed bg-blue-50/50">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
          <div>
            <p className="font-semibold text-blue-900">Report Information</p>
            <p className="mt-1 text-sm text-blue-800">
              All reports are generated dynamically from the current database.
              Excel exports include structured sheets with professional headers,
              generation timestamp, and tabular formatting.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
