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
  const action = searchParams.get("action") ?? undefined;
  const entity = searchParams.get("entity") ?? undefined;
  const userId = searchParams.get("userId") ?? undefined;
  const limit = Math.min(Number(searchParams.get("limit") ?? 100), 1000);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  try {
    let where = "";
    const params: any[] = [];
    const conditions: string[] = [];

    if (action) {
      conditions.push(`ul.action = $${params.length + 1}`);
      params.push(action);
    }
    if (entity) {
      conditions.push(`ul.entity = $${params.length + 1}`);
      params.push(entity);
    }
    if (userId) {
      conditions.push(`ul.user_id = $${params.length + 1}`);
      params.push(Number(userId));
    }

    if (conditions.length > 0) {
      where = "WHERE " + conditions.join(" AND ");
    }

    const countResult = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM hdp.user_log ul ${
        where ? sql.raw(where) : sql``
      }
    `);
    const total = ((countResult.rows[0] as any)?.count as number) || 0;

    const result = await db.execute(sql`
      SELECT
        ul.log_id,
        ul.user_id,
        ud.user_name,
        ul.action,
        ul.entity,
        ul.entity_id,
        ul.outcome,
        ul.recorded_at,
        ul.meta,
        ul.user_agent
      FROM hdp.user_log ul
      LEFT JOIN hdp.user_details ud ON ul.user_id = ud.user_id
      ${where ? sql.raw(where) : sql``}
      ORDER BY ul.recorded_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    return NextResponse.json({
      logs: result.rows.map((r: any) => ({
        logId: r.log_id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        entity: r.entity,
        entityId: r.entity_id,
        outcome: r.outcome,
        recordedAt: r.recorded_at,
        meta: r.meta,
        userAgent: r.user_agent,
      })),
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

