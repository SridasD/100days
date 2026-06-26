import { NextRequest, NextResponse } from "next/server";
import {
  requireVerifierSession,
  isVerifierSession,
} from "@/lib/auth/verifier-session";
import { listVerifierIndicators } from "@/lib/db/queries/verifier";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  const pendingOnly = req.nextUrl.searchParams.get("pending") === "1";

  try {
    const rows = await listVerifierIndicators(id, session.secId, pendingOnly);
    return NextResponse.json({
      indicators: rows.map((r) => {
        const submittedPhys = r.physical_achievement ?? 0;
        const verifiedPhys =
          r.verified_physical_achievement != null
            ? Number(r.verified_physical_achievement)
            : null;
        const submittedFin = r.financial_achievement
          ? Number(r.financial_achievement)
          : 0;
        const verifiedFin =
          r.verified_financial_achievement != null
            ? Number(r.verified_financial_achievement)
            : null;
        const submittedDesc = r.physical_description ?? "";
        const verifiedDesc = r.verified_physical_description ?? null;
        const submittedAt = r.submitted_date
          ? new Date(r.submitted_date).getTime()
          : 0;
        const verifiedAt = r.verified_date
          ? new Date(r.verified_date).getTime()
          : 0;
        const isCurrentVerified =
          r.verified_date != null &&
          (r.submitted_date == null || verifiedAt >= submittedAt);

        const canonicalPhys =
          isCurrentVerified && verifiedPhys != null ? verifiedPhys : submittedPhys;
        const canonicalFin =
          isCurrentVerified && verifiedFin != null ? verifiedFin : submittedFin;
        const canonicalDesc =
          isCurrentVerified && verifiedDesc != null ? verifiedDesc : submittedDesc;
        return {
          indicatorId: r.indicator_id,
          projectId: r.project_id,
          name: r.indicator_name ?? "",
          district: r.district_name ?? "",
          submittedByName: r.submitted_by_name ?? "",
          physicalTarget: r.physical_target ? Number(r.physical_target) : 0,
          financialTarget: r.financial_target ? Number(r.financial_target) : 0,
          // Canonical values shown in the list: current verified values when
          // the indicator is approved, otherwise latest nodal submission.
          physicalAchievement: canonicalPhys,
          financialAchievement: canonicalFin,
          description: canonicalDesc,
          percentage: r.percentage ? Number(r.percentage) : 0,
          verifiedPercentage: r.verified_percentage
            ? Number(r.verified_percentage)
            : 0,
          // Raw nodal vs verifier values for the comparison panel
          submittedPhysicalAchievement: submittedPhys,
          submittedFinancialAchievement: submittedFin,
          submittedDescription: submittedDesc,
          verifiedPhysicalAchievement: verifiedPhys,
          verifiedFinancialAchievement: verifiedFin,
          verifiedDescription: verifiedDesc,
          submittedDate: r.submitted_date,
          verifiedDate: r.verified_date,
          verifiedByName: r.verified_by_name ?? null,
          imageCount: r.image_count,
          videoCount: r.video_count,
          status: r.status,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/verify/projects/[id]/indicators failed", err);
    return NextResponse.json(
      { error: "Failed to load indicators" },
      { status: 500 },
    );
  }
}
