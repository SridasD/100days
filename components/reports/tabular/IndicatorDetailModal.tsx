'use client';

import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { TabularRow } from './types';
import { containsMalayalam, formatDate, formatDateTime, indicatorStatus, isIndicatorCompleted, verificationStatus } from './lib';
import { StatusBadge } from './StatusBadge';
import { ProgressBarCell } from './ProgressBarCell';
import { IndicatorGallery } from './IndicatorGallery';

type IndicatorDetailModalProps = {
  indicator: TabularRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function IndicatorDetailModal({ indicator, open, onOpenChange }: IndicatorDetailModalProps) {
  const verification = verificationStatus(indicator);
  const status = indicatorStatus(indicator);
  const malayalam = containsMalayalam(indicator.indicator_name);
  const completed = isIndicatorCompleted(indicator);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle
            lang={malayalam ? 'ml' : undefined}
            className={malayalam ? 'font-malayalam text-base leading-relaxed tracking-normal' : undefined}
          >
            {indicator.indicator_name}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-1.5">
            <span>{indicator.administrative_department}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{indicator.project_name}</span>
            <ChevronRight className="h-3 w-3" />
            <span>{indicator.department_name}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Project Code</div>
              <div className="mt-1 text-foreground">{indicator.project_code}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">HOD</div>
              <div className="mt-1 text-foreground">{indicator.hod_names}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-slate-50/70 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Physical Progress</div>
              <div className="mt-2">
                <ProgressBarCell value={indicator.physical_progress} color="teal" />
              </div>
            </div>
            <div className="rounded-lg border bg-slate-50/70 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financial Progress</div>
              <div className="mt-2">
                <ProgressBarCell value={indicator.financial_progress} color="blue" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={verification} />
            <StatusBadge status={status} />
            <StatusBadge status={completed ? 'Completed' : 'Not Completed'} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Submitted</div>
              <div className="mt-1 text-foreground">
                {indicator.submitted_date ? formatDateTime(indicator.submitted_date) : '-'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Verified</div>
              <div className="mt-1 text-foreground">
                {indicator.verified_date ? formatDateTime(indicator.verified_date) : '-'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Completed On</div>
              <div className="mt-1 text-foreground">
                {completed && indicator.completed_date ? formatDate(indicator.completed_date) : '-'}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Last Update</div>
              <div className="mt-1 text-foreground">
                {indicator.last_progress_update ? formatDateTime(indicator.last_progress_update) : '-'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gallery</div>
            <div className="mt-2">
              {open && indicator.indicator_id !== null ? (
                <IndicatorGallery indicatorId={indicator.indicator_id} />
              ) : (
                <p className="text-sm text-muted-foreground">No indicator to load media for.</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
