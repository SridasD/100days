/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  isAdminSession,
  requireTechAdminSession,
} from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { projectId } = await params;
  const id = Number(projectId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        project_id,
        project_code,
        project_name,
        department_snapshot,
        sector_snapshot,
        district_snapshot,
        project_status,
        archived_by,
        archived_at,
        archive_reason,
        impact_payload
      FROM hdp.project_archive_repository
      WHERE project_id = ${id}
      ORDER BY archived_at DESC
      LIMIT 1
    `);

    const row = result.rows[0] as any;
    if (!row) {
      return NextResponse.json(
        { error: "Archived project not found" },
        { status: 404 },
      );
    }

    const impact = row.impact_payload ?? {};
    const headers = [
      "Project ID",
      "Project Code",
      "Project Name",
      "Department",
      "Sector",
      "District",
      "Original Status",
      "Archived By",
      "Archived At",
      "Archive Reason",
      "Total Indicators",
      "Verified Indicators",
      "Pending Verification",
      "Images Uploaded",
      "Documents Uploaded",
      "Videos Uploaded",
      "Total Progress Updates",
    ];

    const data = [
      row.project_id,
      row.project_code,
      row.project_name,
      row.department_snapshot,
      row.sector_snapshot,
      row.district_snapshot,
      row.project_status,
      row.archived_by,
      row.archived_at,
      row.archive_reason,
      impact.totalIndicators ?? 0,
      impact.verifiedIndicators ?? 0,
      impact.pendingVerification ?? 0,
      impact.imagesUploaded ?? 0,
      impact.documentsUploaded ?? 0,
      impact.videosUploaded ?? 0,
      impact.totalProgressUpdates ?? 0,
    ];

    const csv = [headers, data]
      .map((r) => r.map(csvEscape).join(","))
      .join("\n");

    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="archived-project-${id}.csv"`,
      },
    });
  } catch (err) {
    console.error(
      "GET /api/admin/projects/archive/[projectId]/export failed",
      err,
    );
    return NextResponse.json(
      { error: "Failed to export archive details" },
      { status: 500 },
    );
  }
}

