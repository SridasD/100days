import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdminSession, isAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const [usersResult, projectsResult, indicatorsResult, pendingResult] =
      await Promise.all([
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM hdp.user_details WHERE status = 1
        `),
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM hdp.master_projects
        `),
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM hdp.indicators
        `),
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM hdp.indicators
          WHERE verified_date IS NULL AND submitted_date IS NOT NULL
        `),
      ]);

    return NextResponse.json({
      stats: {
        activeUsers: ((usersResult.rows[0] as any)?.count as number) || 0,
        totalProjects: ((projectsResult.rows[0] as any)?.count as number) || 0,
        totalIndicators:
          ((indicatorsResult.rows[0] as any)?.count as number) || 0,
        pendingVerification:
          ((pendingResult.rows[0] as any)?.count as number) || 0,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 },
    );
  }
}
