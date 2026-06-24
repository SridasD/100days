import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** Right-aligned slot — HOME link on /login, user menu on authenticated pages. */
  right?: ReactNode;
  /** Make the bar stick to the top of the viewport on scroll. Default: true. */
  sticky?: boolean;
  className?: string;
}

/**
 * Shared Kerala govt header used on /login and authenticated pages.
 * Dark green band (#2E7D32), emblem on the left, Malayalam title,
 * caller-provided content on the right.
 */
export function KeralaHeader({ right, sticky = true, className }: Props) {
  return (
    <header
      style={{ backgroundColor: '#2E7D32' }}
      className={cn(
        'z-30 text-white shadow-sm',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
        <a
          href="/"
          className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Kerala Government — 100 Days Programme"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-1 shadow-sm ring-1 ring-white/30 transition-transform duration-200 group-hover:scale-[1.03]">
            <img
              src="/images/kerala-emblem-black.jpg"
              alt="Kerala State emblem"
              className="h-10 w-10 object-contain"
            />
          </div>
          <p className="font-malayalam text-base font-semibold leading-tight">
            കേരള സർക്കാർ
            <span className="px-2 text-white/60">|</span>
            100 ദിന പദ്ധതികൾ
          </p>
        </a>

        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
    </header>
  );
}
