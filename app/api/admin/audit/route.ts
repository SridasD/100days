/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  requireTechAdminSession,
  isAdminSession,
} from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const searchParams = req.nextUrl.searchParams;
  const action = searchParams.get("action")?.trim() || undefined;
  const entity = searchParams.get("entity")?.trim() || undefined;
  const userId = searchParams.get("userId")?.trim() || undefined;
  const outcome = searchParams.get("outcome")?.trim() || undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const rawLimit = Number(searchParams.get("limit") ?? 100);
  const rawOffset = Number(searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(rawLimit, 1000))
    : 100;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  try {
    const conditions: ReturnType<typeof sql>[] = [];

    if (action) conditions.push(sql`ul.action = ${action}`);
    if (entity) conditions.push(sql`ul.entity = ${entity}`);
    if (outcome) conditions.push(sql`ul.outcome = ${outcome}`);
    if (userId) {
      const parsedUserId = Number(userId);
      if (Number.isFinite(parsedUserId)) {
        conditions.push(sql`ul.user_id = ${parsedUserId}`);
      }
    }
    if (q) {
      const like = `%${q}%`;
      conditions.push(sql`
        (
          ul.action ILIKE ${like}
          OR ul.entity ILIKE ${like}
          OR COALESCE(ud.user_name, '') ILIKE ${like}
          OR CAST(ul.meta AS text) ILIKE ${like}
        )
      `);
    }

    const whereClause = conditions.length
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM hdp.user_log ul
      LEFT JOIN hdp.user_details ud ON ul.user_id = ud.user_id
      ${whereClause}
    `);
    const total = ((countResult.rows[0] as any)?.count as number) || 0;

    const result = await db.execute(sql`
      SELECT
        ul.user_log_id,
        ul.user_id,
        ud.user_name,
        ul.action,
        ul.entity,
        ul.entity_id,
        ul.outcome,
        ul.logged_on,
        ul.meta,
        ul.user_agent
      FROM hdp.user_log ul
      LEFT JOIN hdp.user_details ud ON ul.user_id = ud.user_id
      ${whereClause}
      ORDER BY ul.logged_on DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const actionsResult = await db.execute(sql`
      SELECT DISTINCT ul.action
      FROM hdp.user_log ul
      WHERE ul.action IS NOT NULL AND ul.action <> ''
      ORDER BY ul.action ASC
    `);

    return NextResponse.json({
      logs: result.rows.map((r: any) => ({
        logId: r.user_log_id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        outcome: r.outcome,
        recordedAt: r.logged_on,
        meta: r.meta,
        userAgent: r.user_agent,
      })),
      actions: actionsResult.rows
        .map((row: any) => row.action)
        .filter((value: unknown): value is string => typeof value === "string"),
      total,
      limit,
      offset,
    });
  } catch (err) {
    console.error("GET /api/admin/audit failed", err);
    return NextResponse.json(
      { error: "Failed to load audit log" },
      { status: 500 },
    );
  }
}
