const STATUS_CLASSES: Record<string, string> = {
  Lagging: 'border-rose-200 bg-rose-50 text-rose-700',
  'Pending Verification': 'border-amber-200 bg-amber-50 text-amber-700',
  'No Update': 'border-slate-200 bg-slate-100 text-slate-700',
  'Not Completed': 'border-slate-200 bg-slate-100 text-slate-700',
};

const DEFAULT_CLASSES = 'border-emerald-200 bg-emerald-50 text-emerald-700';

type StatusBadgeProps = {
  status: string;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const classes = STATUS_CLASSES[status] ?? DEFAULT_CLASSES;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}
