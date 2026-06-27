import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import {
  isAdminSession,
  requireTechAdminSession,
} from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";
import { resolveProjectId } from "@/lib/db/public-id";
import { ROLE } from "@/lib/auth/session";
import type { OfficerSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse as OfficerSession;

  // Restore is restricted to full admin only.
  if (session.roleId !== ROLE.ADMIN) {
    return NextResponse.json(
      { error: "Only Admin role can restore archived projects" },
      { status: 403 },
    );
  }

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const requestIp = getClientIP(req).slice(0, 150);

  try {
    const out = await db.transaction(async (tx) => {
      const rowRes = await tx.execute(sql`
        SELECT archive_id, project_code, project_name, is_restored
        FROM hdp.project_archive_repository
        WHERE project_id = ${id}
        ORDER BY archived_at DESC
        LIMIT 1
        FOR UPDATE
      `);
      const archive = rowRes.rows[0] as
        | {
            archive_id: number | string;
            project_code: string | null;
            project_name: string | null;
            is_restored: boolean;
          }
        | undefined;

      if (!archive) return { kind: "not_found" as const };
      if (archive.is_restored) return { kind: "already_restored" as const };

      await tx.execute(sql`
        UPDATE hdp.master_projects
        SET
          is_archived = false,
          archived_at = NULL,
          archived_by = NULL,
          archive_reason = NULL,
          archive_session_id = NULL,
          archived_from_ip = NULL,
          updated_by = ${session.userId}
        WHERE project_id = ${id}
      `);

      await tx.execute(sql`
        UPDATE hdp.project_archive_repository
        SET
          is_restored = true,
          restored_at = NOW(),
          restored_by = ${session.userId},
          restored_by_role = ${session.roleId}
        WHERE archive_id = ${Number(archive.archive_id)}
      `);

      await tx.execute(sql`
        INSERT INTO hdp.user_log (
          user_id,
          user_ip,
          logged_on,
          browser_details,
          action,
          entity,
          entity_id,
          outcome,
          user_agent,
          meta
        ) VALUES (
          ${session.userId},
          ${requestIp},
          NOW(),
          ${req.headers.get("user-agent")?.slice(0, 250) ?? null},
          ${AUDIT_ACTIONS.PROJECT_RESTORED},
          'master_projects',
          ${id},
          'SUCCESS',
          ${req.headers.get("user-agent")?.slice(0, 500) ?? null},
          jsonb_build_object(
            'project_name', ${archive.project_name ?? null},
            'project_code', ${archive.project_code ?? null},
            'role_id', ${session.roleId}
          )
        )
      `);

      return {
        kind: "ok" as const,
        projectCode: archive.project_code ?? "",
        projectName: archive.project_name ?? "",
      };
    });

    if (out.kind === "not_found") {
      return NextResponse.json(
        { error: "Archived project not found" },
        { status: 404 },
      );
    }
    if (out.kind === "already_restored") {
      return NextResponse.json(
        { error: "Project is already restored" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Project restored successfully.",
      projectCode: out.projectCode,
      projectName: out.projectName,
    });
  } catch (err) {
    console.error(
      "POST /api/admin/projects/archive/[projectId]/restore failed",
      err,
    );
    return NextResponse.json(
      { error: "Failed to restore archived project" },
      { status: 500 },
    );
  }
}
