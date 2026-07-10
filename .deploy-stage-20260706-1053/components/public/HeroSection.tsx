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
import Image from 'next/image';
import { ArrowRight, Leaf } from 'lucide-react';
import { LiveCountdown } from './LiveCountdown';

export interface HeroSectionProps {
  /** Phase boundaries — drives countdown + ring fill */
  phaseStart: string; // ISO date
  phaseEnd: string; // ISO date
  miniStats?: Array<{ label: string; value: number; pct: number }>;
}

export function HeroSection(_unusedProps: HeroSectionProps) {
  void _unusedProps;
  // The phase start/end + countdown / time calculations now live inside
  // <LiveCountdown />, which reads them from env vars (NEXT_PUBLIC_HDP_PHASE_*).
  // Mini-stats are no longer rendered here either; the widget speaks for
  // itself.

  return (
    <section className="relative isolate overflow-hidden bg-hdp-bg">
      {/* Split composition background. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-30 bg-cover bg-[position:60%_center] md:bg-center"
        style={{
          backgroundImage: 'url(/images/bg.jpg)',
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-gradient-to-r from-white/90 via-white/52 to-white/12"
      />

      <div
        aria-hidden
        className="absolute inset-y-0 left-0 -z-10 w-[60%] bg-gradient-to-r from-white/72 via-white/34 to-transparent"
      />

      <div className="container relative z-10 mx-auto grid gap-6 px-4 py-12 sm:py-14 md:gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(150px,190px)_minmax(280px,330px)] lg:items-center lg:gap-5 lg:py-16 xl:grid-cols-[minmax(0,1.7fr)_minmax(170px,220px)_minmax(300px,340px)] xl:gap-6 xl:py-20">
        {/* LEFT — headline + CTAs */}
        <div className="flex max-w-2xl flex-col justify-center text-foreground lg:max-w-none">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-hdp-green/20 bg-white/90 px-3 py-1 text-xs font-semibold text-hdp-green shadow-sm">
            <Leaf className="h-3.5 w-3.5" />
            കേരള സർക്കാർ
          </span>

          <h1 className="font-malayalam mt-5 flex max-w-none flex-col gap-1.5 text-[clamp(2rem,3.5vw,3.2rem)] font-bold leading-[1.08] tracking-normal text-hdp-green sm:text-[clamp(2.35rem,3vw,3.5rem)] lg:text-[42px] xl:text-[48px]">
            <span className="block">പുതുയുഗ കേരളത്തിനായി</span>
            <span className="block text-hdp-green-active">നൂറുദിന കർമ്മപദ്ധതി</span>
          </h1>

          <p className="font-malayalam mt-5 max-w-xl text-base leading-relaxed text-foreground/75 md:text-lg">
            സുദൃഢവും, ജനകീയവുമായ വികസനത്തിലേക്ക് കേരളത്തിന്റെ ഉറച്ച ചുവടുവയ്പ്പ്.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#sector-projects"
              className="group inline-flex cursor-pointer items-center gap-2 rounded-full bg-hdp-green px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-hdp-green-active hover:shadow-xl"
            >
              <span className="font-malayalam">പദ്ധതികൾ കാണുക</span>
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#sector-projects"
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-hdp-green/30 bg-white/85 px-6 py-3 text-sm font-semibold text-hdp-green backdrop-blur transition-colors duration-200 hover:bg-white"
            >
              <span className="font-malayalam">പുരോഗതി അറിയുക</span>
            </Link>
          </div>
        </div>

        {/* SMALL/MEDIUM — portrait thumbnail when the full-body CM column is hidden. */}
        <div className="absolute right-4 top-4 z-20 lg:hidden sm:right-6 sm:top-6 md:right-8 md:top-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-xl ring-1 ring-black/5 sm:h-24 sm:w-24 md:h-28 md:w-28">
            <Image
              src="/images/cm_potrait.png"
              alt="Chief Minister portrait"
              width={320}
              height={320}
              className="h-full w-full rounded-full object-cover object-top"
              priority
            />
          </div>
        </div>

        {/* MIDDLE — CM cutout as a dedicated column on large screens. */}
        <div aria-hidden className="hidden lg:flex items-end justify-center lg:translate-x-6 xl:translate-x-10">
          <Image
            src="/images/cm.png"
            alt=""
            width={700}
            height={1200}
            className="h-[320px] w-auto object-contain object-bottom xl:h-[430px]"
            priority
          />
        </div>

        {/* RIGHT — Live countdown widget (ring + HH:MM:SS clock). */}
        <div className="w-full max-w-[340px] justify-self-end xl:max-w-[360px]">
          <LiveCountdown />
        </div>
      </div>
    </section>
  );
}

// Helper components were moved into <LiveCountdown />.
