export function parseLockoutTimestamp(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string") return null;

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  // Legacy rows came from a timestamp-without-time-zone column that stored
  // UTC wall-clock fields. Append Z only for strings that still lack an
  // explicit offset so old and migrated data both resolve to the same instant.
  const withZone = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const parsed = new Date(withZone);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatLockoutTimestampIso(value: unknown): string | null {
  const parsed = parseLockoutTimestamp(value);
  return parsed ? parsed.toISOString() : null;
}

export function isLockoutActive(value: unknown, now = new Date()): boolean {
  const parsed = parseLockoutTimestamp(value);
  return !!parsed && parsed > now;
}
