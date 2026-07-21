import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function VerifiedDataBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="success"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-success-green/30 bg-success-green/10 px-2 py-0.5 text-[10px] font-semibold text-success-green',
        className,
      )}
    >
      <CheckCircle2 className="h-3 w-3" aria-hidden />
      Verified Data
    </Badge>
  );
}
