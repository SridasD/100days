'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, AlertTriangle, ArrowLeft, Eye, FileBarChart2, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const reports = [
  {
    id: 'summary',
    title: 'Summary Report',
    description: 'Overview of all projects and indicators',
    sections: ['Total Projects', 'Completed', 'In Progress', 'Indicators Count'],
  },
  {
    id: 'department',
    title: 'Department-wise Report',
    description: 'Project and indicator breakdown by department',
    sections: ['By Secretary', 'Project Count', 'Indicator Status'],
  },
  {
    id: 'completed',
    title: 'Completed Projects',
    description: 'List of all completed projects with achievements',
    sections: ['Project Details', 'Achievements', 'Employment Data'],
  },
  {
    id: 'district',
    title: 'District-based Report',
    description: 'Indicators and projects by district',
    sections: ['By District', 'Indicator Details', 'Progress Status'],
  },
  {
    id: 'lagging-analysis',
    title: 'Project Progress & Performance Review',
    description: 'Hierarchical progress and performance view by administrative department, agency, project, and indicator',
    sections: ['Administrative Department Summary', 'Drill-down View', 'Indicator-level Performance'],
  },
];

export default function AdminReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);
  const pathname = usePathname();
  const isOsd = pathname.startsWith('/admin/osd');
  const dashboardPath = isOsd ? '/admin/osd/dashboard' : '/admin/dashboard';
  const reportViewPath = (reportId: string) =>
    isOsd ? `/admin/osd/reports/${reportId}/view` : `/admin/reports/${reportId}/view`;
  const reportTabularPath = (reportId: string) =>
    isOsd ? `/admin/osd/reports/${reportId}/tabular` : `/admin/reports/${reportId}/tabular`;

  const handleExport = async (reportId: string) => {
    setExporting(reportId);
    try {
      const response = await fetch(
        `/api/admin/reports/${reportId}?format=xlsx`,
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportId}-report.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Failed to export: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  };

  const handleView = (reportId: string) => {
    window.open(reportViewPath(reportId), '_blank', 'noopener,noreferrer');
  };

  const handleTabular = (reportId: string) => {
    window.open(reportTabularPath(reportId), '_blank', 'noopener,noreferrer');
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
                {report.id === 'lagging-analysis' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleView(report.id)}
                      className="cursor-pointer flex-1"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleTabular(report.id)}
                      className="cursor-pointer flex-1"
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      Dashboard
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={exporting === report.id}
                      onClick={() => handleExport(report.id)}
                      className="cursor-pointer flex-1"
                    >
                      <Download className="h-3 w-3" />
                      Download
                    </Button>
                  </>
                ) : (
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
                )}
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
