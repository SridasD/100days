const STATUS_CLASSES: Record<string, string> = {
  'Needs Attention': 'border-rose-200 bg-rose-50 text-rose-700',
  'Pending Verification': 'border-amber-200 bg-amber-50 text-amber-700',
  'No Update': 'border-slate-200 bg-slate-100 text-slate-700',
  'Not Completed': 'border-slate-200 bg-slate-100 text-slate-700',
};

const DEFAULT_CLASSES = 'border-emerald-200 bg-emerald-50 text-emerald-700';

type StatusBadgeProps = {
  status: string;
  /** e.g. "1/47" — rendered inside the same pill, before the status word, so a
   * rollup that's mostly fine doesn't read as if the whole scope is affected. */
  ratio?: string;
};

export function StatusBadge({ status, ratio }: StatusBadgeProps) {
  const classes = STATUS_CLASSES[status] ?? DEFAULT_CLASSES;

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${classes}`}
    >
      {ratio ? `${ratio} ` : ''}{status}
    </span>
  );
}
