'use client';

/**
 * Full-bleed public hero. Left: bilingual headline + CTAs. Right: glass
 * card with a radial progress ring (days left in phase), live countdown,
 * phase date chip and a mini stat list.
 *
 * Recharts' RadialBarChart is the only chart used here; everything else is
 * Tailwind + a tiny inline countdown hook.
 */
import Link from 'next/link';
import { ArrowRight, Leaf } from 'lucide-react';
import { LiveCountdown } from './LiveCountdown';

export interface HeroSectionProps {
  /** Phase boundaries — drives countdown + ring fill */
  phaseStart: string; // ISO date
  phaseEnd: string; // ISO date
  miniStats?: Array<{ label: string; value: number; pct: number }>;
}

export function HeroSection(_props: HeroSectionProps) {
  // The phase start/end + countdown / time calculations now live inside
  // <LiveCountdown />, which reads them from env vars (NEXT_PUBLIC_HDP_PHASE_*).
  // Mini-stats are no longer rendered here either; the widget speaks for
  // itself.

  return (
    <section className="relative isolate overflow-hidden bg-hdp-bg">
      {/* Photographic background — Kerala backwaters show through almost
          fully. A soft white wash from the left keeps the dark green
          headline readable; the right side stays photo-bright behind the
          white glass card. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{
          backgroundImage: 'url(/images/hero-puduyuga-kerala.png)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-white/80 via-white/55 to-white/15"
      />

      <div className="container mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[1.7fr_minmax(0,360px)] lg:py-24">
        {/* LEFT — headline + CTAs */}
        <div className="flex flex-col justify-center text-foreground">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hdp-green/20 bg-white/90 px-3 py-1 text-xs font-semibold text-hdp-green shadow-sm">
            <Leaf className="h-3.5 w-3.5" />
            കേരള സർക്കാർ
          </span>

          <h1 className="font-malayalam mt-5 text-4xl font-bold leading-tight tracking-tight text-hdp-green md:text-5xl lg:text-[52px]">
            പുതുയുഗ കേരളത്തിനായി
            <br />
            <span className="text-hdp-green-active">നൂറുദിന കർമ്മപദ്ധതി</span>
          </h1>

          <p className="font-malayalam mt-5 max-w-xl text-base leading-relaxed text-foreground/75 md:text-lg">
            സുദൃഢവും, ജനകീയവുമായ വികസനത്തിലേക്ക് കേരളത്തിന്റെ ഉറച്ച ചുവടുവയ്പ്പ്.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/public/projects"
              className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-hdp-green px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-hdp-green-active hover:shadow-xl"
            >
              <span className="font-malayalam">പദ്ധതികൾ കാണുക</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/public/progress"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hdp-green/30 bg-white/85 px-6 py-3 text-sm font-semibold text-hdp-green backdrop-blur transition-colors duration-200 hover:bg-white"
            >
              <span className="font-malayalam">പുരോഗതി അറിയുക</span>
            </Link>
          </div>
        </div>

        {/* RIGHT — Live countdown widget (ring + HH:MM:SS clock). All
            time math + colour states live inside the component. */}
        <LiveCountdown />
      </div>
    </section>
  );
}

// Helper components were moved into <LiveCountdown />.
