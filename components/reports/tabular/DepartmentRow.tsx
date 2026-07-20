'use client';

import { Building2, Camera, ChevronRight, FileText, Video } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import type { DepartmentGroup } from './types';
import { aggregate, countCompletedProjects, financialRollup, formatDateTime, physicalRollup, rollupLastUpdate, rollupStatus, rollupVerification } from './lib';
import { StatusBadge } from './StatusBadge';
import { ProgressBarCell } from './ProgressBarCell';
import { MediaCountCell } from './MediaCountCell';

type DepartmentRowProps = {
  department: DepartmentGroup;
  number: number;
  expanded: boolean;
  onToggle: () => void;
};

export function DepartmentRow({ department, number, expanded, onToggle }: DepartmentRowProps) {
  const rows = department.projects.flatMap((project) => project.indicators);
  const summary = aggregate(rows);
  const verification = rollupVerification(rows);
  const status = rollupStatus(rows);
  const lastUpdate = rollupLastUpdate(rows);
  const accent = summary.lagging > 0 ? 'border-l-rose-400' : 'border-l-emerald-400';

  return (
    <TableRow className="bg-slate-50 font-semibold hover:bg-slate-100">
      <TableCell className={`sticky left-0 z-10 border-l-[3px] ${accent} bg-slate-50 align-top`}>
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-2 text-left">
          <ChevronRight
            className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
          <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-kerala-blue" />
          <span className="text-sm text-foreground">
            {number}. {department.name}
          </span>
        </button>
      </TableCell>
      <TableCell className="align-top text-sm text-foreground">{department.projects.length}</TableCell>
      <TableCell className="align-top text-sm text-foreground">{countCompletedProjects(department.projects)}</TableCell>
      <TableCell className="align-top text-sm text-foreground">{summary.totalIndicators}</TableCell>
      <TableCell className="align-top text-sm text-foreground">{summary.completedIndicators}</TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
      <TableCell className="align-top">
        <ProgressBarCell value={physicalRollup(department.projects)} color="teal" />
      </TableCell>
      <TableCell className="align-top">
        <ProgressBarCell value={financialRollup(department.projects)} color="blue" />
      </TableCell>
      <TableCell className="align-top">
        <StatusBadge status={verification} />
      </TableCell>
      <TableCell className="align-top">
        <StatusBadge status={status} />
      </TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">
        {lastUpdate ? formatDateTime(lastUpdate) : '-'}
      </TableCell>
      <TableCell className="align-top">
        <MediaCountCell icon={Camera} count={summary.images} label="images" />
      </TableCell>
      <TableCell className="align-top">
        <MediaCountCell icon={Video} count={summary.videos} label="videos" />
      </TableCell>
      <TableCell className="align-top">
        <MediaCountCell icon={FileText} count={summary.documents} label="documents" />
      </TableCell>
    </TableRow>
  );
}
