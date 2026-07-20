'use client';

import { Camera, ChevronRight, FileText, Folder, Video } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import type { ProjectGroup } from './types';
import { aggregate, financialRollup, formatDateTime, rollupLastUpdate, rollupStatus, rollupVerification } from './lib';
import { StatusBadge } from './StatusBadge';
import { ProgressBarCell } from './ProgressBarCell';
import { MediaCountCell } from './MediaCountCell';

type ProjectRowProps = {
  project: ProjectGroup;
  number: string;
  expanded: boolean;
  onToggle: () => void;
};

export function ProjectRow({ project, number, expanded, onToggle }: ProjectRowProps) {
  const summary = aggregate(project.indicators);
  const verification = rollupVerification(project.indicators);
  const status = rollupStatus(project.indicators);
  const lastUpdate = rollupLastUpdate(project.indicators);
  const accent = summary.lagging > 0 ? 'border-l-rose-300' : 'border-l-emerald-300';

  return (
    <TableRow className="bg-background hover:bg-muted/30">
      <TableCell className={`sticky left-0 z-10 border-l-2 ${accent} bg-background pl-6 align-top`}>
        <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-start gap-2 text-left">
          <ChevronRight
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
          />
          <Folder className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="text-sm font-medium text-foreground">
            {number} {project.projectName}
          </span>
        </button>
      </TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
      <TableCell className="align-top text-sm text-foreground">{project.indicators.length}</TableCell>
      <TableCell className="align-top text-sm text-foreground">{summary.completedIndicators}</TableCell>
      <TableCell className="align-top text-xs text-muted-foreground">
        <div>{project.agencyName}</div>
        <div className="text-muted-foreground/80">HOD: {project.hodNames}</div>
      </TableCell>
      <TableCell className="align-top">
        <ProgressBarCell value={summary.physical} color="teal" />
      </TableCell>
      <TableCell className="align-top">
        <ProgressBarCell value={financialRollup([project])} color="blue" />
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
