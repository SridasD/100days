import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  isVerifierSession,
  requireVerifierSession,
} from "@/lib/auth/verifier-session";
import { db } from "@/lib/db/client";
import { resolveProjectId } from "@/lib/db/public-id";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

// Mark a project as physically completed.
// Allowed only when EVERY indicator on the project has been verified at
// 100% (verified_percentage >= 100). The verifier is the role with the
// authority to declare completion — the nodal officer's `percentage` is
// just a self-report.
export const runtime = "nodejs";

const completeSchema = z.object({
  completion_date: z.string().min(1, "Completion date is required"),
  remarks: z.string().max(2000).optional().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  // Sec_id scoping — central verifier (sec_id=0) can complete any project.
  if (session.secId && session.secId > 0) {
    const owns = await db.execute(sql`
      SELECT 1
      FROM hdp.project_secretary ps
      INNER JOIN hdp.master_projects mp ON mp.project_id = ps.project_id
      WHERE ps.project_id = ${id}
        AND ps.sec_id = ${session.secId}
        AND COALESCE(mp.is_archived, false) = false
      LIMIT 1
    `);
    if (owns.rows.length === 0) {
      return NextResponse.json(
        { error: "Forbidden: project not assigned to your department" },
        { status: 403 },
      );
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    // Gate: every indicator must be verified at 100%.
    const stats = await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        SUM(
          CASE
            WHEN verified_date IS NOT NULL
              AND (submitted_date IS NULL OR verified_date >= submitted_date)
              AND COALESCE(verified_percentage, 0) >= 100
            THEN 1 ELSE 0
          END
        )::int AS completed
      FROM hdp.indicators
      WHERE project_id = ${id}
    `);
    const row = stats.rows[0] as { total: number; completed: number };
    if (!row || row.total === 0) {
      return NextResponse.json(
        { error: "Project has no indicators yet — cannot mark complete." },
        { status: 400 },
      );
    }
    if (row.completed < row.total) {
      return NextResponse.json(
        {
          error: `Only ${row.completed} of ${row.total} indicators are verified at 100%. All must be verified-complete first.`,
        },
        { status: 400 },
      );
    }

    await db.execute(sql`
      UPDATE hdp.master_projects
      SET
        is_completed   = 2,
        completion_date = ${d.completion_date}::date,
        updated_by     = ${session.userId}
      WHERE project_id = ${id}
        AND COALESCE(is_archived, false) = false
    `);

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      entity: "master_projects",
      entityId: id,
      request: req,
      secId: session.secId,
      meta: {
        action: "PROJECT_COMPLETED",
        completion_date: d.completion_date,
        remarks: d.remarks || null,
        verified_indicators: row.completed,
        total_indicators: row.total,
      },
    });

    return NextResponse.json({
      projectId: id,
      isCompleted: 2,
      completionDate: d.completion_date,
    });
  } catch (err) {
    console.error("POST /api/verify/projects/[id]/complete failed", err);
    const pgErr = err as { message?: string; code?: string; detail?: string };
    return NextResponse.json(
      {
        error: "Failed to mark project complete",
        debug: {
          message: pgErr.message,
          code: pgErr.code,
          detail: pgErr.detail,
        },
      },
      { status: 500 },
    );
  }
}
