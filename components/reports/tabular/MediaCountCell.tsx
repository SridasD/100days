import type { LucideIcon } from 'lucide-react';

type MediaCountCellProps = {
  icon: LucideIcon;
  count: number;
  label: string;
};

export function MediaCountCell({ icon: Icon, count, label }: MediaCountCellProps) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`${count} ${label}`}>
      <Icon className="h-3.5 w-3.5" />
      {count}
    </span>
  );
}
