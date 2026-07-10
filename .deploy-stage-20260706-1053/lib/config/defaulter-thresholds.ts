type Thresholds = {
  pendingDays: number;
  inactivityDays: number;
  indicatorStaleDays: number;
};

function parseDays(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
}

/**
 * Central source for secretary defaulter thresholds.
 *
 * Priority:
 * 1) Feature-specific vars (for backward compatibility)
 * 2) Global defaulter threshold var
 * 3) Safe default (15 days)
 */
export function getDefaulterThresholds(): Thresholds {
  const globalDefault = parseDays(process.env.DEFAULTER_THRESHOLD_DAYS, 15);

  return {
    pendingDays: parseDays(process.env.SECRETARY_PENDING_DAYS, globalDefault),
    inactivityDays: parseDays(
      process.env.SECRETARY_INACTIVITY_DAYS,
      globalDefault,
    ),
    indicatorStaleDays: parseDays(
      process.env.SECRETARY_INDICATOR_STALE_DAYS,
      globalDefault,
    ),
  };
}
