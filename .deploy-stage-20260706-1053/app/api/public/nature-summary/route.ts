/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

// Project counts grouped by nature_of_project. The legacy column convention:
//   1 = Livelihood (à´‰à´ªà´œàµ€à´µà´¨à´®à´¾àµ¼à´—àµà´— à´ªà´¦àµà´§à´¤à´¿à´•àµ¾)
//   2 = Infrastructure (à´ªà´¶àµà´šà´¾à´¤àµà´¤à´² à´µà´¿à´•à´¸à´¨ à´ªà´¦àµà´§à´¤à´¿à´•àµ¾)
// Anything else (NULL / 0 / 3+) falls into "other" and is currently ignored
// by the home page but surfaced here for future use.
export const runtime = "nodejs";

export async function GET() {
  try {
    const r = await db.execute(sql`
      SELECT
        SUM(CASE WHEN nature_of_project = 1 THEN 1 ELSE 0 END)::int AS livelihood_total,
        SUM(CASE WHEN nature_of_project = 1 AND is_completed = 2 THEN 1 ELSE 0 END)::int
                                                                    AS livelihood_completed,
        SUM(CASE WHEN nature_of_project = 2 THEN 1 ELSE 0 END)::int AS infrastructure_total,
        SUM(CASE WHEN nature_of_project = 2 AND is_completed = 2 THEN 1 ELSE 0 END)::int
                                                                    AS infrastructure_completed,
        SUM(CASE
              WHEN nature_of_project IS NULL OR nature_of_project NOT IN (1, 2)
              THEN 1 ELSE 0
            END)::int                                               AS other_total
      FROM hdp.master_projects
      WHERE COALESCE(is_archived, false) = false
    `);
    const row = r.rows[0] as any;
    return NextResponse.json({
      livelihood: {
        total: Number(row?.livelihood_total) || 0,
        completed: Number(row?.livelihood_completed) || 0,
      },
      infrastructure: {
        total: Number(row?.infrastructure_total) || 0,
        completed: Number(row?.infrastructure_completed) || 0,
      },
      other: { total: Number(row?.other_total) || 0 },
    });
  } catch (err) {
    console.error("GET /api/public/nature-summary failed", err);
    return NextResponse.json(
      { error: "Failed to load nature summary" },
      { status: 500 },
    );
  }
}

