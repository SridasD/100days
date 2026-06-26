import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isSession, requireOfficerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { officerOwnsIndicator } from "@/lib/db/queries/officer";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

// physical_achievement has no fixed upper bound at parse time — the cap
// depends on the indicator's unit + target, which we can only look up
// after we know the indicator id. Range validation is done in the handler
// once we've fetched the row.
const progressSchema = z.object({
  physical_achievement: z.coerce.number().min(0, "Cannot be negative"),
  financial_achievement: z.coerce.number().min(0),
  completed_date: z.string().optional().nullable(),
  description: z.string().max(2000).optional().default(""),
  achieved_direct_days: z.coerce.number().int().min(0).default(0),
  achieved_direct_persons: z.coerce.number().int().min(0).default(0),
  achieved_indirect_days: z.coerce.number().int().min(0).default(0),
  achieved_indirect_persons: z.coerce.number().int().min(0).default(0),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  // Ownership check — Section 4.3 security boundary
  const owns = await officerOwnsIndicator(id, {
    roleId: session.roleId,
    secId: session.secId,
    deptId: session.deptId,
  });
  if (!owns) {
    return NextResponse.json(
      { error: "Forbidden: indicator does not belong to your department" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const completedDate = d.completed_date ? d.completed_date : null;

  // ----- Unit-aware range check ----------------------------------------
  // We need the indicator's unit + physical_target to know the right cap:
  //   unit === "Percentage" → max 100
  //   anything else         → max physical_target
  // Fetching here keeps the cap definition in one place (no drift between
  // the create-time `physical_target` and submit-time validation).
  const meta = await db.execute(sql`
    SELECT
      unit,
      physical_target,
      verified_date,
      verified_physical_achievement,
      verified_financial_achievement,
      verified_percentage,
      verified_physical_description
    FROM hdp.indicators
    WHERE indicator_id = ${id} LIMIT 1
  `);
  const metaRow = meta.rows[0] as
    | {
        unit: string | null;
        physical_target: number | string | null;
        verified_date: string | null;
        verified_physical_achievement: number | null;
        verified_financial_achievement: number | string | null;
        verified_percentage: number | string | null;
        verified_physical_description: string | null;
      }
    | undefined;
  if (!metaRow) {
    return NextResponse.json({ error: "Indicator not found" }, { status: 404 });
  }
  const unit = (metaRow.unit ?? "").trim().toLowerCase();
  const targetNum =
    metaRow.physical_target != null ? Number(metaRow.physical_target) : 0;
  const isPercentage = unit === "percentage";
  const cap = isPercentage
    ? 100
    : targetNum > 0
      ? targetNum
      : Number.POSITIVE_INFINITY;

  if (d.physical_achievement > cap) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: [
          {
            path: ["physical_achievement"],
            message: isPercentage
              ? "Percentage cannot exceed 100."
              : `Cannot exceed the physical target (${targetNum}).`,
          },
        ],
      },
      { status: 400 },
    );
  }

  // 100% completion still requires a completion date — derive the ratio
  // from achievement vs the cap so the rule works for any unit type.
  const pct =
    Number.isFinite(cap) && cap > 0 ? (d.physical_achievement / cap) * 100 : 0;
  if (pct >= 100 && !completedDate) {
    return NextResponse.json(
      {
        error: "Validation failed",
        issues: [
          {
            path: ["completed_date"],
            message: "Required when 100% complete.",
          },
        ],
      },
      { status: 400 },
    );
  }

  try {
    // percentage = (physical_achievement / physical_target * 100), clamped to 100
    const updated = await db.execute(sql`
      UPDATE hdp.indicators
      SET
        physical_achievement = ${d.physical_achievement},
        financial_achievement = ${d.financial_achievement},
        percentage = CASE
          WHEN physical_target IS NULL OR physical_target = 0 THEN 0
          ELSE LEAST(100, (${d.physical_achievement}::numeric / physical_target::numeric) * 100)
        END,
        achieved_no_days_employed_direct = ${d.achieved_direct_days},
        achieved_no_persons_employed_direct = ${d.achieved_direct_persons},
        achieved_no_days_employed_indirect = ${d.achieved_indirect_days},
        achieved_no_persons_employed_indirect = ${d.achieved_indirect_persons},
        physical_description = ${d.description || null},
        completed_date = ${completedDate},
        submitted_by = ${session.userId},
        submitted_date = now()
      WHERE indicator_id = ${id}
      RETURNING indicator_id, physical_achievement, financial_achievement,
                percentage, completed_date, submitted_date
    `);

    const row = updated.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Indicator not found" },
        { status: 404 },
      );
    }

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.INDICATOR_SUBMITTED,
      entity: "indicators",
      entityId: id,
      request: req,
      secId: session.secId,
      meta: {
        physical_achievement: d.physical_achievement,
        financial_achievement: d.financial_achievement,
        completed_date: completedDate,
        requires_reverification: true,
        previous_verified: {
          verified_date: metaRow.verified_date ?? null,
          physical_achievement:
            metaRow.verified_physical_achievement != null
              ? Number(metaRow.verified_physical_achievement)
              : null,
          financial_achievement:
            metaRow.verified_financial_achievement != null
              ? Number(metaRow.verified_financial_achievement)
              : null,
          percentage:
            metaRow.verified_percentage != null
              ? Number(metaRow.verified_percentage)
              : null,
          description: metaRow.verified_physical_description ?? null,
        },
      },
    });

    return NextResponse.json({ indicator: row });
  } catch (err) {
    console.error("PUT progress failed", err);
    return NextResponse.json(
      { error: "Failed to update indicator" },
      { status: 500 },
    );
  }
}
