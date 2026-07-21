'use client';

import { useState } from 'react';
import { Camera, FileText, Target, Video } from 'lucide-react';
import { TableCell, TableRow } from '@/components/ui/table';
import type { TabularRow } from './types';
import { containsMalayalam, formatDateTime, indicatorStatus, isIndicatorCompleted, verificationStatus } from './lib';
import { StatusBadge } from './StatusBadge';
import { ProgressBarCell } from './ProgressBarCell';
import { MediaCountCell } from './MediaCountCell';
import { IndicatorDetailModal } from './IndicatorDetailModal';

type IndicatorRowProps = {
  indicator: TabularRow;
  number: string;
};

export function IndicatorRow({ indicator, number }: IndicatorRowProps) {
  const [open, setOpen] = useState(false);
  const verification = verificationStatus(indicator);
  const status = indicatorStatus(indicator);
  const malayalam = containsMalayalam(indicator.indicator_name);
  const completed = isIndicatorCompleted(indicator);

  return (
    <>
      <TableRow className="cursor-pointer bg-background hover:bg-muted/30" onClick={() => setOpen(true)}>
        <TableCell className="sticky left-0 z-10 bg-background pl-12 align-top">
          <div className="flex items-start gap-2">
            <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div
              lang={malayalam ? 'ml' : undefined}
              className={malayalam ? 'font-malayalam text-[0.95rem] leading-relaxed tracking-normal' : 'text-sm leading-relaxed'}
            >
              <span className="mr-1.5 inline-flex shrink-0 items-center rounded-md bg-teal-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-teal-700">
                {number}
              </span>
              {indicator.indicator_name}
            </div>
          </div>
        </TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
        <TableCell className="align-top text-sm text-foreground">{completed ? 1 : 0}</TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">—</TableCell>
        <TableCell className="align-top">
          <ProgressBarCell value={indicator.physical_progress} color="teal" />
        </TableCell>
        <TableCell className="align-top">
          <ProgressBarCell value={indicator.financial_progress} color="blue" />
        </TableCell>
        <TableCell className="align-top">
          <StatusBadge status={verification} />
        </TableCell>
        <TableCell className="align-top">
          <StatusBadge status={status} />
        </TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">
          {indicator.last_progress_update ? formatDateTime(indicator.last_progress_update) : '-'}
        </TableCell>
        <TableCell className="align-top">
          <MediaCountCell icon={Camera} count={indicator.image_count} label="images" />
        </TableCell>
        <TableCell className="align-top">
          <MediaCountCell icon={Video} count={indicator.video_count} label="videos" />
        </TableCell>
        <TableCell className="align-top">
          <MediaCountCell icon={FileText} count={indicator.document_count} label="documents" />
        </TableCell>
      </TableRow>
      <IndicatorDetailModal indicator={indicator} open={open} onOpenChange={setOpen} />
    </>
  );
}
