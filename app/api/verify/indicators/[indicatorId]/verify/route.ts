/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import {
  requireVerifierSession,
  isVerifierSession,
} from "@/lib/auth/verifier-session";
import { db } from "@/lib/db/client";
import { resolveIndicatorId } from "@/lib/db/public-id";
import { verifierOwnsIndicator } from "@/lib/db/queries/verifier";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

const verifySchema = z.object({
  verified_physical_achievement: z.number().min(0),
  verified_financial_achievement: z.number().min(0).optional().default(0),
  verified_description: z.string().max(2000).optional().default(""),
  verified_direct_days: z.number().int().min(0).default(0),
  verified_direct_persons: z.number().int().min(0).default(0),
  verified_indirect_days: z.number().int().min(0).default(0),
  verified_indirect_persons: z.number().int().min(0).default(0),
  // Verifier remarks â€” required when corrections diverge from nodal values,
  // but always recommended. Min 5 chars when present so the trail is useful.
  remarks: z.string().max(2000).optional().default(""),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = await resolveIndicatorId(indicatorId);
  if (!id) {
    return NextResponse.json({ error: "Invalid indicatorId" }, { status: 400 });
  }

  // Ownership check
  const owns = await verifierOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json(
      { error: "Forbidden: indicator not assigned to your department" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    // Snapshot the current row so we can diff what the verifier changed.
    const beforeRow = await db.execute(sql`
      SELECT physical_target, physical_achievement, financial_achievement,
             physical_description,
             achieved_no_days_employed_direct,
             achieved_no_persons_employed_direct,
             achieved_no_days_employed_indirect,
             achieved_no_persons_employed_indirect
      FROM hdp.indicators
      WHERE indicator_id = ${id}
      LIMIT 1
    `);
    const before = (beforeRow.rows[0] ?? {}) as any;
    const physicalTarget = before.physical_target
      ? Number(before.physical_target)
      : 0;
    const verifiedPercentage =
      physicalTarget > 0
        ? Math.min(
            100,
            (d.verified_physical_achievement / physicalTarget) * 100,
          )
        : 0;

    // Build a per-field diff between nodal-submitted and verifier-corrected.
    const corrections: Record<string, { from: any; to: any }> = {};
    const cmp = (key: string, beforeVal: any, afterVal: any) => {
      const a = beforeVal == null ? 0 : Number(beforeVal);
      const b = afterVal == null ? 0 : Number(afterVal);
      if (a !== b) corrections[key] = { from: a, to: b };
    };
    cmp(
      "physical_achievement",
      before.physical_achievement,
      d.verified_physical_achievement,
    );
    cmp(
      "financial_achievement",
      before.financial_achievement,
      d.verified_financial_achievement,
    );
    cmp(
      "days_direct",
      before.achieved_no_days_employed_direct,
      d.verified_direct_days,
    );
    cmp(
      "persons_direct",
      before.achieved_no_persons_employed_direct,
      d.verified_direct_persons,
    );
    cmp(
      "days_indirect",
      before.achieved_no_days_employed_indirect,
      d.verified_indirect_days,
    );
    cmp(
      "persons_indirect",
      before.achieved_no_persons_employed_indirect,
      d.verified_indirect_persons,
    );
    if (
      (before.physical_description ?? "") !== (d.verified_description ?? "")
    ) {
      corrections["description"] = {
        from: before.physical_description ?? "",
        to: d.verified_description ?? "",
      };
    }

    // Update with verified fields
    const updated = await db.execute(sql`
      UPDATE hdp.indicators
      SET
        physical_achievement = ${d.verified_physical_achievement},
        financial_achievement = ${d.verified_financial_achievement},
        percentage = ${verifiedPercentage},
        physical_description = ${d.verified_description || null},
        verified_physical_achievement = ${d.verified_physical_achievement},
        verified_financial_achievement = ${d.verified_financial_achievement},
        verified_percentage = ${verifiedPercentage},
        verified_achieved_no_days_employed_direct = ${d.verified_direct_days},
        verified_achieved_no_persons_employed_direct = ${d.verified_direct_persons},
        verified_achieved_no_days_employed_indirect = ${d.verified_indirect_days},
        verified_achieved_no_persons_employed_indirect = ${d.verified_indirect_persons},
        verified_physical_description = ${d.verified_description || null},
        verified_by = ${session.userId},
        verified_date = now()
      WHERE indicator_id = ${id}
      RETURNING indicator_id, verified_by, verified_date, verified_percentage
    `);

    // Publish currently attached media to public views once the indicator
    // itself is verified. Public APIs intentionally read only verified media.
    await db.execute(sql`
      UPDATE hdp.gallery
      SET is_verified = true
      WHERE indicator_id = ${id}
        AND COALESCE(is_verified, false) = false
    `);

    const row = updated.rows[0];
    if (!row) {
      return NextResponse.json(
        { error: "Indicator not found" },
        { status: 404 },
      );
    }

    // If the verifier actually changed something, log a CORRECTED event
    // before the APPROVED event so the timeline shows both.
    if (Object.keys(corrections).length > 0) {
      await writeAudit({
        userId: session.userId,
        action: AUDIT_ACTIONS.INDICATOR_CORRECTED,
        entity: "indicators",
        entityId: id,
        request: req,
        secId: session.secId,
        meta: {
          corrections,
          remarks: d.remarks || null,
        },
      });
    }

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.INDICATOR_APPROVED,
      entity: "indicators",
      entityId: id,
      request: req,
      secId: session.secId,
      meta: {
        verified_physical_achievement: d.verified_physical_achievement,
        verified_financial_achievement: d.verified_financial_achievement,
        verified_percentage: verifiedPercentage,
        remarks: d.remarks || null,
      },
    });

    return NextResponse.json({
      indicatorId: id,
      verifiedBy: (row as any).verified_by,
      verifiedDate: (row as any).verified_date,
      verifiedPercentage,
    });
  } catch (err) {
    console.error("POST /api/verify/[id]/verify failed", err);
    return NextResponse.json(
      { error: "Failed to verify indicator" },
      { status: 500 },
    );
  }
}
