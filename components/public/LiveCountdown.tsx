'use client';

/**
 * HDP Live Countdown Widget
 * ------------------------------------------------------------
 * Dual countdown for the Kerala 100-day programme:
 *   • Macro — Days remaining in the 100-day cycle (ring + centre number)
 *   • Micro — Time remaining until midnight IST (HH:MM:SS clock)
 *
 * All time math runs in Asia/Kolkata (IST = UTC+5:30) so the widget
 * displays the same value regardless of the viewer's local timezone.
 *
 * Calculations are deferred to useEffect to avoid SSR / hydration
 * mismatches on time-sensitive values.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
 * CONFIG
 * ──────────────────────────────────────────────────────────── */
// Phase boundaries — read from env so the cycle can roll without a code
// change. Accepts either spelling — the short NEXT_PUBLIC_PHASE_* or the
// fully-qualified NEXT_PUBLIC_HDP_PHASE_* — so docs / env files from
// different generations both work. Defaults to the published 2026 cycle.
// IMPORTANT: NEXT_PUBLIC_* values are baked into the client bundle at
// build time. After editing .env.local you MUST restart `npm run dev`.
const PHASE_START =
  process.env.NEXT_PUBLIC_PHASE_START ??
  process.env.NEXT_PUBLIC_HDP_PHASE_START ??
  '2026-07-15';
const PHASE_END =
  process.env.NEXT_PUBLIC_PHASE_END ??
  process.env.NEXT_PUBLIC_HDP_PHASE_END ??
  '2026-10-22';
const TOTAL_DAYS = 100;
const IST_OFFSET_MIN = 5 * 60 + 30; // UTC+5:30

/* SVG ring geometry */
const RING_VIEWBOX = 220;
const RING_CX = 110;
const RING_CY = 110;
const RING_R = 90;
const RING_STROKE = 10;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R; // ≈ 565.49

/* ─────────────────────────────────────────────────────────────
 * IST helpers
 * ──────────────────────────────────────────────────────────── */
/** Midnight IST at the start of the given YYYY-MM-DD date. */
function istMidnight(dateISO: string): Date {
  // Build the IST midnight as a UTC instant: 00:00 IST = 18:30 UTC the
  // previous day. Easier to construct it as "YYYY-MM-DDT00:00:00+05:30".
  return new Date(`${dateISO}T00:00:00+05:30`);
}

/** Current IST wall-clock parts represented via UTC getters. */
function nowISTParts() {
  const shifted = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

/** Next midnight in IST as a real instant. */
function nextIstMidnight(now: Date): Date {
  const { year, month, day } = nowISTParts();
  return new Date(Date.UTC(year, month, day + 1, 0, -IST_OFFSET_MIN, 0, 0));
}

/* ─────────────────────────────────────────────────────────────
 * COLOUR STATES
 * ──────────────────────────────────────────────────────────── */
type Stage = 'not-started' | 'early' | 'mid' | 'final' | 'complete';

function stageFor(daysCompleted: number): Stage {
  if (daysCompleted <= 0) return 'not-started';
  if (daysCompleted >= TOTAL_DAYS) return 'complete';
  if (daysCompleted <= 33) return 'early';
  if (daysCompleted <= 66) return 'mid';
  return 'final';
}

const ARC_COLOR: Record<Stage, string> = {
  'not-started': '#E8E8E8',
  early: '#95D5B2',
  mid: '#52B788',
  final: '#2D6A4F',
  complete: '#2D6A4F',
};

/* ─────────────────────────────────────────────────────────────
 * COMPONENT
 * ──────────────────────────────────────────────────────────── */
export function LiveCountdown() {
  // hydrated = true after the first useEffect runs — we render a static
  // placeholder server-side and on first paint, then swap to the live
  // values. Avoids the React hydration warning on time fields.
  const [hydrated, setHydrated] = useState(false);
  const [daysCompleted, setDaysCompleted] = useState(0);
  const [clock, setClock] = useState<{ h: string; m: string; s: string }>({
    h: '00',
    m: '00',
    s: '00',
  });
  const [phaseStarted, setPhaseStarted] = useState(false);
  const [phaseEnded, setPhaseEnded] = useState(false);

  /* Compute every second. Each tick:
     1. Recomputes daysCompleted (changes once a day, at IST midnight).
     2. Recomputes the time-to-midnight HH:MM:SS clock.
   */
  useEffect(() => {
    setHydrated(true);

    const compute = () => {
      const now = new Date();
      const startMidnight = istMidnight(PHASE_START);
      const endMidnight = istMidnight(PHASE_END);

      const started = now.getTime() >= startMidnight.getTime();
      const ended = now.getTime() >= endMidnight.getTime() + 24 * 3600_000;

      // Days completed = whole IST days since PHASE_START. Clamped 0..100.
      const msSinceStart = now.getTime() - startMidnight.getTime();
      const rawDays = Math.floor(msSinceStart / (24 * 3600_000));
      const days = Math.max(0, Math.min(TOTAL_DAYS, rawDays));
      setDaysCompleted(days);
      setPhaseStarted(started);
      setPhaseEnded(ended);

      // Time to the next IST midnight, in milliseconds, using explicit
      // IST boundary instants so the result is correct in every timezone.
      const diff = Math.max(0, nextIstMidnight(now).getTime() - now.getTime());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setClock({ h: pad(h), m: pad(m), s: pad(s) });
    };

    compute();
    const t = setInterval(compute, 1000);
    return () => clearInterval(t);
  }, []);

  /* Derived display values */
  const daysRemaining = Math.max(0, TOTAL_DAYS - daysCompleted);
  const stage = stageFor(daysCompleted);
  const arcColor = ARC_COLOR[stage];
  const dashOffset = RING_CIRCUMFERENCE * (1 - daysCompleted / TOTAL_DAYS);

  // Dot position — angle in radians offset by −90° so 0 maps to top.
  const angleDeg = (daysCompleted / TOTAL_DAYS) * 360 - 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotCx = RING_CX + RING_R * Math.cos(angleRad);
  const dotCy = RING_CY + RING_R * Math.sin(angleRad);

  const phaseLabel = useMemo(() => {
    const fmt = (s: string) =>
      new Date(`${s}T00:00:00+05:30`).toLocaleDateString('ml-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    return `${fmt(PHASE_START)} — ${fmt(PHASE_END)}`;
  }, []);

  /* Status badge */
  const badgeColor = phaseEnded
    ? 'bg-hdp-success/15 text-hdp-success'
    : 'bg-hdp-warning/15 text-hdp-warning';
  const badgeText = phaseEnded ? 'പൂർത്തിയായി' : 'തൽസമയം';

  return (
    <div className="relative">
      {/* Soft halo behind the card */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 rounded-[28px] bg-hdp-green/15 blur-2xl"
      />
      <div className="rounded-3xl border border-white bg-white/95 p-6 shadow-2xl backdrop-blur-md">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="font-malayalam text-xs text-muted-foreground">
            പദ്ധതി പൂർത്തിയാക്കാൻ
          </p>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badgeColor}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${phaseEnded ? 'bg-hdp-success' : 'bg-hdp-warning'
                }`}
              style={
                !phaseEnded
                  ? { animation: 'hdp-pulse 1.5s ease-in-out infinite' }
                  : undefined
              }
            />
            <span className="font-malayalam">{badgeText}</span>
          </span>
        </div>

        {/* Ring + centre */}
        <div className="relative mx-auto mt-4 h-44 w-44 sm:h-52 sm:w-52">
          <svg
            viewBox={`0 0 ${RING_VIEWBOX} ${RING_VIEWBOX}`}
            className="block h-full w-full"
            role="img"
            aria-label={`${daysRemaining} days remaining`}
          >
            {/* Layer 1: track */}
            <circle
              cx={RING_CX}
              cy={RING_CY}
              r={RING_R}
              fill="none"
              stroke="#E8E8E8"
              strokeWidth={RING_STROKE}
            />

            {/* Layer 2: progress arc — starts at 12 o'clock (rotate -90°
                around the centre), draws clockwise. dasharray = C means
                the dash is the full circumference; dashoffset shifts it
                so only `daysCompleted` worth of arc shows. */}
            <circle
              cx={RING_CX}
              cy={RING_CY}
              r={RING_R}
              fill="none"
              stroke={arcColor}
              strokeWidth={RING_STROKE}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={hydrated ? dashOffset : RING_CIRCUMFERENCE}
              strokeLinecap="round"
              style={{
                transform: `rotate(-90deg)`,
                transformOrigin: `${RING_CX}px ${RING_CY}px`,
                transition: 'stroke-dashoffset 600ms ease-in-out',
              }}
            />

            {/* Layer 3: trailing dot at the arc's leading edge */}
            {hydrated && daysCompleted > 0 && (
              <circle
                cx={dotCx}
                cy={dotCy}
                r={7}
                fill={arcColor}
                stroke="#FFFFFF"
                strokeWidth={2}
                style={{
                  transition:
                    'cx 600ms ease-in-out, cy 600ms ease-in-out, fill 600ms ease-in-out',
                  filter:
                    stage === 'complete'
                      ? 'drop-shadow(0 0 6px #F4A261)'
                      : undefined,
                }}
              >
                {stage === 'complete' && (
                  <animate
                    attributeName="opacity"
                    values="1;0.5;1"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                )}
              </circle>
            )}
          </svg>

          {/* Centre text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {!hydrated ? (
              <span className="font-mono text-5xl font-extrabold leading-none tracking-tight text-hdp-green">
                {TOTAL_DAYS}
              </span>
            ) : !phaseStarted ? (
              <span className="font-malayalam text-sm font-semibold text-muted-foreground">
                ആരംഭിച്ചിട്ടില്ല
              </span>
            ) : phaseEnded ? (
              <>
                <span className="font-mono text-5xl font-extrabold leading-none tracking-tight text-hdp-green">
                  0
                </span>
                <span className="font-malayalam mt-1 text-[11px] text-muted-foreground">
                  ദിവസങ്ങൾ കൂടി
                </span>
              </>
            ) : (
              <>
                <span className="font-mono text-5xl font-extrabold leading-none tracking-tight text-hdp-green">
                  {daysRemaining}
                </span>
                <span className="font-malayalam mt-1 text-[11px] text-muted-foreground">
                  ദിവസങ്ങൾ കൂടി
                </span>
              </>
            )}
          </div>
        </div>

        {/* HH:MM:SS clock — hidden when the phase hasn't started or ended */}
        {hydrated && phaseStarted && !phaseEnded && (
          <div className="mt-5 flex items-center justify-center gap-1.5">
            <ClockBox value={clock.h} labelMal="മണിക്കൂർ" />
            <Sep />
            <ClockBox value={clock.m} labelMal="മിനിറ്റ്" />
            <Sep />
            <ClockBox value={clock.s} labelMal="സെക്കൻഡ്" />
          </div>
        )}

        {/* Phase date footer */}
        <div className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-hdp-bg px-3 py-1.5 text-[11px] text-foreground/70 ring-1 ring-border">
          <CalendarDays className="h-3.5 w-3.5 text-hdp-gold" />
          <span className="font-malayalam">{phaseLabel}</span>
        </div>
      </div>

      {/* Keyframes used by the pulsing status-dot. Scoped via a style tag
          so we don't depend on globals.css edits. */}
      <style>{`
        @keyframes hdp-pulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * sub-components
 * ──────────────────────────────────────────────────────────── */
function ClockBox({
  value,
  labelMal,
}: {
  value: string;
  labelMal: string;
}) {
  return (
    <div className="flex w-14 flex-col items-center gap-1">
      <div className="flex h-12 w-full items-center justify-center rounded-lg border border-border bg-hdp-bg">
        <span className="font-mono text-2xl font-bold tabular-nums leading-none text-foreground">
          {value}
        </span>
      </div>
      <span className="font-malayalam text-[10px] text-muted-foreground">
        {labelMal}
      </span>
    </div>
  );
}

function Sep() {
  return (
    <span
      aria-hidden
      className="select-none pt-1 font-mono text-xl font-bold leading-none text-hdp-green/50"
    >
      :
    </span>
  );
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}
