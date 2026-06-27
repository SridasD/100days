import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseNumericId(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export async function resolveProjectId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT project_id
    FROM hdp.master_projects
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { project_id: number | string } | undefined;
  return row ? Number(row.project_id) : null;
}

export async function resolveIndicatorId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT indicator_id
    FROM hdp.indicators
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { indicator_id: number | string } | undefined;
  return row ? Number(row.indicator_id) : null;
}

export async function resolveUserId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT user_id
    FROM hdp.user_details
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { user_id: number | string } | undefined;
  return row ? Number(row.user_id) : null;
}

export async function resolveSecretaryId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT sec_id
    FROM hdp.master_secretary
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { sec_id: number | string } | undefined;
  return row ? Number(row.sec_id) : null;
}

export async function resolveSectorId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT sector_id
    FROM hdp.master_sector
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { sector_id: number | string } | undefined;
  return row ? Number(row.sector_id) : null;
}

export async function resolveDistrictId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT district_id
    FROM hdp.master_district
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { district_id: number | string } | undefined;
  return row ? Number(row.district_id) : null;
}

export async function resolveDepartmentId(
  identifier: string,
): Promise<number | null> {
  const numeric = parseNumericId(identifier);
  if (numeric != null) return numeric;

  if (!UUID_RE.test(identifier)) return null;

  const result = await db.execute(sql`
    SELECT dept_id
    FROM hdp.master_department
    WHERE public_id = ${identifier}::uuid
    LIMIT 1
  `);
  const row = result.rows[0] as { dept_id: number | string } | undefined;
  return row ? Number(row.dept_id) : null;
}
