import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { isAdminSession, requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const q = req.nextUrl.searchParams;
  const search = (q.get("search") ?? "").trim();
  const department = (q.get("department") ?? "").trim();
  const sector = (q.get("sector") ?? "").trim();
  const district = (q.get("district") ?? "").trim();
  const archivedBy = q.get("archivedBy");
  const archivedById = archivedBy ? Number(archivedBy) : NaN;
  const fromDate = (q.get("fromDate") ?? "").trim() || null;
  const toDate = (q.get("toDate") ?? "").trim() || null;

  try {
    const rows = await db.execute(sql`
      SELECT
        ar.archive_id,
        ar.project_id,
        ar.project_code,
        ar.project_name,
        ar.department_snapshot,
        ar.sector_snapshot,
        ar.district_snapshot,
        ar.project_status,
        ar.archived_by,
        ar.archived_at,
        ar.archive_reason,
        ud.user_name AS archived_by_name,
        ud.login_name AS archived_by_login,
        ar.impact_payload
      FROM hdp.project_archive_repository ar
      LEFT JOIN hdp.user_details ud ON ud.user_id = ar.archived_by
      WHERE ar.is_restored = false
        AND (
          ${search} = '' OR
          COALESCE(ar.project_name, '') ILIKE ${`%${search}%`} OR
          COALESCE(ar.project_code, '') ILIKE ${`%${search}%`}
        )
        AND (
          ${department} = '' OR
          COALESCE(ar.department_snapshot, '') ILIKE ${`%${department}%`}
        )
        AND (
          ${sector} = '' OR
          COALESCE(ar.sector_snapshot, '') ILIKE ${`%${sector}%`}
        )
        AND (
          ${district} = '' OR
          COALESCE(ar.district_snapshot, '') ILIKE ${`%${district}%`}
        )
        AND (
          ${archivedBy ?? ""} = '' OR
          (
            ${Number.isFinite(archivedById)} = true
            AND ar.archived_by = ${Number.isFinite(archivedById) ? archivedById : 0}
          ) OR
          COALESCE(ud.user_name, '') ILIKE ${`%${archivedBy ?? ""}%`} OR
          COALESCE(ud.login_name, '') ILIKE ${`%${archivedBy ?? ""}%`}
        )
        AND (
          ${fromDate}::date IS NULL OR
          ar.archived_at >= (${fromDate}::date)
        )
        AND (
          ${toDate}::date IS NULL OR
          ar.archived_at < ((${toDate}::date) + INTERVAL '1 day')
        )
      ORDER BY ar.archived_at DESC
    `);

    return NextResponse.json({
      archivedProjects: (rows.rows as Array<any>).map((r) => ({
        archiveId: Number(r.archive_id),
        projectId: Number(r.project_id),
        projectCode: r.project_code ?? "",
        projectName: r.project_name ?? "",
        department: r.department_snapshot ?? "—",
        sector: r.sector_snapshot ?? "—",
        district: r.district_snapshot ?? "—",
        originalStatus: Number(r.project_status) || 0,
        archivedBy: r.archived_by_name ?? r.archived_by_login ?? "Unknown",
        archivedById: r.archived_by ? Number(r.archived_by) : null,
        archivedAt: r.archived_at,
        archiveReason: r.archive_reason ?? null,
        impact: r.impact_payload ?? null,
      })),
    });
  } catch (err) {
    const pgErr = err as { code?: string; message?: string };
    if (pgErr.code === "42P01") {
      // Archive repository table is not migrated yet.
      return NextResponse.json({
        archivedProjects: [],
        warning:
          "Archive repository is not available yet. Apply archive migration to enable this module.",
      });
    }
    console.error("GET /api/admin/projects/archive failed", err);
    return NextResponse.json(
      { error: "Failed to load archived projects" },
      { status: 500 },
    );
  }
}
