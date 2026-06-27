import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  requireVerifierSession,
  isVerifierSession,
} from "@/lib/auth/verifier-session";
import { db } from "@/lib/db/client";
import { listVerifierProjects } from "@/lib/db/queries/verifier";

export const runtime = "nodejs";

export async function GET() {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  try {
    // Resolve the verifier's own department label, so the UI doesn't have to
    // hard-code "Verifying". `sec_id = 0` is a central/cross-dept verifier.
    let departmentLabel = "All departments";
    if (session.secId && session.secId > 0) {
      const r = await db.execute(sql`
        SELECT secretary_name
        FROM hdp.master_secretary
        WHERE sec_id = ${session.secId}
        LIMIT 1
      `);
      departmentLabel =
        (r.rows[0] as { secretary_name: string | null } | undefined)
          ?.secretary_name ?? "Unknown";
    }

    const rows = await listVerifierProjects(session.secId);
    return NextResponse.json({
      scope: {
        secId: session.secId,
        departmentLabel,
      },
      projects: rows.map((r) => ({
        projectId: r.project_id,
        projectCode: r.project_code,
        projectName: r.project_name,
        projectNameMal: r.project_name_mal,
        department: r.department,
        indicatorsTotal: r.indicators_total,
        indicatorsPending: r.indicators_pending,
        indicatorsVerified: r.indicators_verified,
      })),
    });
  } catch (err) {
    console.error("GET /api/verify/projects failed", err);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 },
    );
  }
}
