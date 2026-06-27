/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  isAdminSession,
  requireTechAdminSession,
} from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";
import { resolveProjectId } from "@/lib/db/public-id";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  try {
    const result = await db.execute(sql`
      SELECT
        ar.*,
        ud.user_name AS archived_by_name,
        ud.login_name AS archived_by_login
      FROM hdp.project_archive_repository ar
      LEFT JOIN hdp.user_details ud ON ud.user_id = ar.archived_by
      WHERE ar.project_id = ${id}
      ORDER BY ar.archived_at DESC
      LIMIT 1
    `);

    const row = result.rows[0] as any;
    if (!row) {
      return NextResponse.json(
        { error: "Archived project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      archive: {
        archiveId: Number(row.archive_id),
        projectId: Number(row.project_id),
        projectPublicId: row.public_id ?? String(id),
        projectCode: row.project_code ?? "",
        projectName: row.project_name ?? "",
        department: row.department_snapshot ?? "â€”",
        sector: row.sector_snapshot ?? "â€”",
        district: row.district_snapshot ?? "â€”",
        originalStatus: Number(row.project_status) || 0,
        archivedBy: row.archived_by_name ?? row.archived_by_login ?? "Unknown",
        archivedById: row.archived_by ? Number(row.archived_by) : null,
        archivedAt: row.archived_at,
        archiveReason: row.archive_reason ?? null,
        archivePayload: row.archive_payload ?? null,
        impactPayload: row.impact_payload ?? null,
        restoredAt: row.restored_at,
        restoredBy: row.restored_by ? Number(row.restored_by) : null,
        isRestored: Boolean(row.is_restored),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/projects/archive/[projectId] failed", err);
    return NextResponse.json(
      { error: "Failed to load archived project details" },
      { status: 500 },
    );
  }
}
