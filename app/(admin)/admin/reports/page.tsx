'use client';

import { useState } from 'react';
import { Download, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
];

export default function AdminReportsPage() {
  const [exporting, setExporting] = useState<string | null>(null);

  const handleExport = async (reportId: string, format: 'csv' | 'xlsx') => {
    setExporting(`${reportId}-${format}`);
    try {
      const response = await fetch(
        `/api/admin/reports/${reportId}?format=${format}`,
      );
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportId}-report.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
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

  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Reports & Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate and export reports in CSV or Excel format
        </p>
      </div>

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
              <p className="text-sm text-muted-foreground">
                {report.description}
              </p>
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
                  disabled={exporting === `${report.id}-csv`}
                  onClick={() => handleExport(report.id, 'csv')}
                  className="cursor-pointer flex-1"
                >
                  <Download className="h-3 w-3" />
                  CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting === `${report.id}-xlsx`}
                  onClick={() => handleExport(report.id, 'xlsx')}
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
              CSV exports include English headers with data in both English and
              Malayalam where applicable. Excel exports include formatted
              sheets with summary tabs.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
