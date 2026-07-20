const COLOR_CLASSES = {
  teal: 'bg-teal-500',
  blue: 'bg-blue-500',
} as const;

type ProgressBarCellProps = {
  value: number | null;
  color?: keyof typeof COLOR_CLASSES;
};

export function ProgressBarCell({ value, color = 'teal' }: ProgressBarCellProps) {
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" />
        <span className="text-xs tabular-nums text-muted-foreground">—</span>
      </div>
    );
  }

  const width = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${COLOR_CLASSES[color]}`} style={{ width: `${width}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{value}%</span>
    </div>
  );
}
