'use client';

/**
 * 4-up stats strip that sits directly below the hero. Numbers count up
 * once the strip enters the viewport (IntersectionObserver). No external
 * animation library — just a small useCountUp hook.
 */
import { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';

interface Stat {
  /** Lucide icon to render */
  icon: typeof BarChart3;
  /** Final value to animate to */
  value: number;
  /** Tailwind text tone for the icon */
  iconTone: 'green' | 'gold' | 'blue' | 'amber';
  /** Malayalam label below the value */
  labelMal: string;
}

const TONE_BG: Record<Stat['iconTone'], string> = {
  green: 'bg-hdp-green/10 text-hdp-green',
  gold: 'bg-hdp-gold/15 text-hdp-gold',
  blue: 'bg-kerala-blue/10 text-kerala-blue',
  amber: 'bg-hdp-warning/10 text-hdp-warning',
};

export interface StatsOverviewProps {
  totalDepartments: number;
  totalProjects: number;
  completedProjects: number;
  totalIndicators: number;
}

export function StatsOverview({
  totalDepartments,
  totalProjects,
  completedProjects,
  totalIndicators,
}: StatsOverviewProps) {
  // Order per stakeholder request:
  //   1. ആകെ വകുപ്പുകൾ           — total departments
  //   2. ആകെ ലക്ഷ്യമിട്ട പദ്ധതികൾ — total targeted projects
  //   3. പൂർത്തീകരിച്ച പദ്ധതികൾ   — completed projects (is_completed = 2)
  //   4. ആകെ പദ്ധതി ഘടകങ്ങൾ      — total project indicators
  const stats: Stat[] = [
    {
      icon: Building2,
      value: totalDepartments,
      iconTone: 'blue',
      labelMal: 'ആകെ വകുപ്പുകൾ',
    },
    {
      icon: ClipboardList,
      value: totalProjects,
      iconTone: 'green',
      labelMal: 'ആകെ ലക്ഷ്യമിട്ട പദ്ധതികൾ',
    },
    {
      icon: CheckCircle2,
      value: completedProjects,
      iconTone: 'gold',
      labelMal: 'പൂർത്തീകരിച്ച പദ്ധതികൾ',
    },
    {
      icon: BarChart3,
      value: totalIndicators,
      iconTone: 'amber',
      labelMal: 'ആകെ പദ്ധതി ഘടകങ്ങൾ',
    },
  ];

  return (
    <section className="bg-hdp-bg py-8 md:py-10">
      <div className="container mx-auto px-4">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-lg">
          <ul className="grid grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => {
              // Mobile: 2x2 grid → need vertical divider between cols + horizontal divider between rows
              // Desktop: 1x4 row → need vertical dividers between cols only
              const mobileColRight = i % 2 === 0;
              const mobileRowBottom = i < 2;
              const desktopColRight = i < 3;
              return (
                <li
                  key={i}
                  className={[
                    'border-border',
                    mobileColRight ? 'border-r' : '',
                    mobileRowBottom ? 'border-b md:border-b-0' : '',
                    desktopColRight ? 'md:border-r' : 'md:border-r-0',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <StatItem {...s} />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

function StatItem({ icon: Icon, value, iconTone, labelMal }: Stat) {
  const ref = useRef<HTMLDivElement | null>(null);
  const animated = useCountUp(value, ref);

  return (
    <div
      ref={ref}
      className="flex items-center gap-3 px-4 py-5 transition-transform duration-300 hover:scale-[1.02] md:px-6"
    >
      <span
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full ${TONE_BG[iconTone]}`}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-mono text-2xl font-extrabold tabular-nums text-foreground">
          {animated.toLocaleString('en-IN')}
        </p>
        <p className="font-malayalam truncate text-xs text-muted-foreground">
          {labelMal}
        </p>
      </div>
    </div>
  );
}

/**
 * Count up from 0 to `target` once the host element enters the viewport.
 * Returns the current integer. Cleans up on unmount.
 */
function useCountUp(
  target: number,
  ref: React.RefObject<HTMLElement | null>,
  durationMs = 1100,
) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let startedAt = 0;

    const tick = (ts: number) => {
      if (!startedAt) startedAt = ts;
      const elapsed = ts - startedAt;
      const pct = Math.min(1, elapsed / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - pct, 3);
      setValue(Math.round(target * eased));
      if (pct < 1) raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            startedAt = 0;
            raf = requestAnimationFrame(tick);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.3 },
    );

    io.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [target, ref, durationMs]);

  return value;
}
