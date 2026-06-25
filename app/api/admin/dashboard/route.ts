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
          WHERE COALESCE(is_archived, false) = false
        `),
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM hdp.indicators i
          WHERE EXISTS (
            SELECT 1 FROM hdp.master_projects mp
            WHERE mp.project_id = i.project_id
              AND COALESCE(mp.is_archived, false) = false
          )
        `),
        db.execute(sql`
          SELECT COUNT(*)::int as count FROM hdp.indicators i
          WHERE i.verified_date IS NULL
            AND i.submitted_date IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM hdp.master_projects mp
              WHERE mp.project_id = i.project_id
                AND COALESCE(mp.is_archived, false) = false
            )
        `),
      ]);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      stats: {
        activeUsers: ((usersResult.rows[0] as any)?.count as number) || 0,
        totalProjects: ((projectsResult.rows[0] as any)?.count as number) || 0,
        totalIndicators:
          ((indicatorsResult.rows[0] as any)?.count as number) || 0,
        pendingVerification:
          ((pendingResult.rows[0] as any)?.count as number) || 0,
      },
      systemStatus: {
        database: "Connected",
        authentication: "Active",
        fileStorage: "Ready",
      },
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load admin dashboard data" },
      { status: 500 },
    );
  }
}
