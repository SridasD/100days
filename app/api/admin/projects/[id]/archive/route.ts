import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isAdminSession, requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";
import { ROLE } from "@/lib/auth/session";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

const archiveSchema = z.object({
  confirmationCode: z.string().min(1),
  reason: z.string().max(1000).optional().nullable(),
});

function getClientIP(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

type SqlExecutor = {
  execute: typeof db.execute;
};

async function getArchivePreview(
  projectId: number,
  executor: SqlExecutor = db,
) {
  const projectRes = await executor.execute(sql`
    SELECT
      mp.project_id,
      mp.project_code,
      mp.project_name,
      COALESCE(ms.sector_name, '—') AS sector_name,
      COALESCE((
        SELECT STRING_AGG(ms2.secretary_name, ', ' ORDER BY ms2.secretary_name)
        FROM hdp.project_secretary ps2
        LEFT JOIN hdp.master_secretary ms2 ON ps2.sec_id = ms2.sec_id
        WHERE ps2.project_id = mp.project_id
      ), '—') AS department_name,
      COALESCE((
        SELECT STRING_AGG(DISTINCT md.district_name, ', ' ORDER BY md.district_name)
        FROM hdp.indicators i
        LEFT JOIN hdp.master_district md ON i.district_id = md.district_id
        WHERE i.project_id = mp.project_id
      ), '—') AS district_name,
      COALESCE(mp.is_completed, 0) AS status_value,
      to_jsonb(mp)->>'inserted_on' AS created_date,
      to_jsonb(mp)->>'updated_on' AS last_updated
    FROM hdp.master_projects mp
    LEFT JOIN hdp.master_sector ms ON mp.sector_id = ms.sector_id
    WHERE mp.project_id = ${projectId}
      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    LIMIT 1
  `);

  const p = projectRes.rows[0] as
    | {
        project_id: number | string;
        project_code: string | null;
        project_name: string | null;
        sector_name: string | null;
        department_name: string | null;
        district_name: string | null;
        status_value: number | string | null;
        created_date: string | null;
        last_updated: string | null;
      }
    | undefined;

  if (!p) return null;

  const impactRes = await executor.execute(sql`
    SELECT
      COUNT(*)::int AS total_indicators,
      COUNT(*) FILTER (WHERE i.verified_date IS NOT NULL)::int AS verified_indicators,
      COUNT(*) FILTER (
        WHERE i.submitted_date IS NOT NULL AND i.verified_date IS NULL
      )::int AS pending_verification,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        INNER JOIN hdp.indicators i2 ON i2.indicator_id = g.indicator_id
        WHERE i2.project_id = ${projectId} AND g.gallery_type = 1
      ), 0) AS images_uploaded,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.documents d
        INNER JOIN hdp.indicators i3 ON i3.indicator_id = d.indicator_id
        WHERE i3.project_id = ${projectId}
      ), 0) AS documents_uploaded,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.gallery g
        INNER JOIN hdp.indicators i4 ON i4.indicator_id = g.indicator_id
        WHERE i4.project_id = ${projectId} AND g.gallery_type = 2
      ), 0) AS videos_uploaded,
      COUNT(*) FILTER (
        WHERE
          i.submitted_date IS NOT NULL OR
          COALESCE(i.physical_achievement, 0) > 0 OR
          COALESCE(i.financial_achievement, 0) > 0
      )::int AS total_progress_updates
    FROM hdp.indicators i
    WHERE i.project_id = ${projectId}
  `);

  const impact = (impactRes.rows[0] ?? {}) as {
    total_indicators?: number | string;
    verified_indicators?: number | string;
    pending_verification?: number | string;
    images_uploaded?: number | string;
    documents_uploaded?: number | string;
    videos_uploaded?: number | string;
    total_progress_updates?: number | string;
  };

  const statusValue = Number(p.status_value) || 0;
  const status =
    statusValue === 2
      ? "Completed"
      : statusValue === 1
        ? "In Progress"
        : "Not Started";

  return {
    project: {
      projectId: Number(p.project_id),
      projectCode: p.project_code ?? "",
      projectName: p.project_name ?? "",
      department: p.department_name ?? "—",
      sector: p.sector_name ?? "—",
      district: p.district_name ?? "—",
      projectStatus: status,
      createdDate: p.created_date,
      lastUpdated: p.last_updated,
    },
    impact: {
      totalIndicators: Number(impact.total_indicators) || 0,
      verifiedIndicators: Number(impact.verified_indicators) || 0,
      pendingVerification: Number(impact.pending_verification) || 0,
      imagesUploaded: Number(impact.images_uploaded) || 0,
      documentsUploaded: Number(impact.documents_uploaded) || 0,
      videosUploaded: Number(impact.videos_uploaded) || 0,
      totalProgressUpdates: Number(impact.total_progress_updates) || 0,
    },
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const preview = await getArchivePreview(projectId);
    if (!preview) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(preview);
  } catch (err) {
    console.error("GET /api/admin/projects/[id]/archive failed", err);
    return NextResponse.json(
      { error: "Failed to load archive preview" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  if (session.roleId !== ROLE.ADMIN && session.roleId !== ROLE.OSD_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const projectId = Number(id);
  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = archiveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const requestIp = getClientIP(req).slice(0, 150);
  const sessionIdentifier =
    req.headers.get("x-session-id") ??
    req.cookies.get("next-auth.session-token")?.value ??
    `uid:${session.userId}`;

  try {
    const out = await db.transaction(async (tx) => {
      const lockRes = await tx.execute(sql`
        SELECT
          mp.project_id,
          mp.project_code,
          mp.project_name,
          COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) AS is_archived,
          COALESCE((
            SELECT MIN(ps.sec_id) FROM hdp.project_secretary ps
            WHERE ps.project_id = mp.project_id
          ), 0) AS sec_id
        FROM hdp.master_projects mp
        WHERE mp.project_id = ${projectId}
        FOR UPDATE
      `);

      const locked = lockRes.rows[0] as
        | {
            project_id: number | string;
            project_code: string | null;
            project_name: string | null;
            is_archived: boolean;
            sec_id: number | string;
          }
        | undefined;

      if (!locked) {
        return { kind: "not_found" as const };
      }

      if (locked.is_archived) {
        return { kind: "already_archived" as const };
      }

      const existingArchiveRes = await tx.execute(sql`
        SELECT
          ar.archived_at,
          ar.archived_by,
          ar.archive_reason,
          ar.session_identifier,
          ar.request_ip
        FROM hdp.project_archive_repository ar
        WHERE ar.project_id = ${projectId}
          AND COALESCE(ar.is_restored, false) = false
        ORDER BY ar.archived_at DESC
        LIMIT 1
      `);

      const existingArchive = existingArchiveRes.rows[0] as
        | {
            archived_at: string | null;
            archived_by: number | string | null;
            archive_reason: string | null;
            session_identifier: string | null;
            request_ip: string | null;
          }
        | undefined;

      if (existingArchive) {
        await tx.execute(sql`
          UPDATE hdp.master_projects
          SET
            is_archived = true,
            archived_at = COALESCE(${existingArchive.archived_at}::timestamp, NOW()),
            archived_by = ${
              existingArchive.archived_by != null
                ? Number(existingArchive.archived_by)
                : session.userId
            },
            archive_reason = ${existingArchive.archive_reason ?? parsed.data.reason ?? null},
            archive_session_id = ${
              existingArchive.session_identifier?.slice(0, 150) ??
              sessionIdentifier.slice(0, 150)
            },
            archived_from_ip = ${
              existingArchive.request_ip?.slice(0, 150) ?? requestIp
            },
            updated_by = ${session.userId}
          WHERE project_id = ${projectId}
        `);

        return {
          kind: "synced_existing_archive" as const,
          projectCode: locked.project_code ?? "",
          projectName: locked.project_name ?? "",
        };
      }

      const expectedCode = locked.project_code ?? "";
      if (parsed.data.confirmationCode !== expectedCode) {
        return { kind: "confirmation_mismatch" as const, expectedCode };
      }

      const preview = await getArchivePreview(projectId, tx);
      if (!preview) {
        return { kind: "not_found" as const };
      }

      await tx.execute(sql`
        INSERT INTO hdp.project_archive_repository (
          project_id,
          project_code,
          project_name,
          archived_at,
          archived_by,
          archived_by_role,
          department_snapshot,
          sector_snapshot,
          district_snapshot,
          project_status,
          archive_reason,
          archive_payload,
          impact_payload,
          request_ip,
          session_identifier
        ) VALUES (
          ${projectId},
          ${preview.project.projectCode},
          ${preview.project.projectName},
          NOW(),
          ${session.userId},
          ${session.roleId},
          ${preview.project.department},
          ${preview.project.sector},
          ${preview.project.district},
          ${
            preview.project.projectStatus === "Completed"
              ? 2
              : preview.project.projectStatus === "In Progress"
                ? 1
                : 0
          },
          ${parsed.data.reason ?? null},
          ${JSON.stringify(preview.project)}::jsonb,
          ${JSON.stringify(preview.impact)}::jsonb,
          ${requestIp},
          ${sessionIdentifier.slice(0, 150)}
        )
      `);

      await tx.execute(sql`
        UPDATE hdp.master_projects
        SET
          is_archived = true,
          archived_at = NOW(),
          archived_by = ${session.userId},
          archive_reason = ${parsed.data.reason ?? null},
          archive_session_id = ${sessionIdentifier.slice(0, 150)},
          archived_from_ip = ${requestIp},
          updated_by = ${session.userId}
        WHERE project_id = ${projectId}
      `);

      await tx.execute(sql`
        INSERT INTO hdp.user_log (
          user_id,
          user_ip,
          logged_on,
          browser_details,
          sec_id,
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
          ${Number(locked.sec_id) || null},
          ${AUDIT_ACTIONS.PROJECT_ARCHIVED},
          'master_projects',
          ${projectId},
          'SUCCESS',
          ${req.headers.get("user-agent")?.slice(0, 500) ?? null},
          jsonb_build_object(
            'project_name', ${locked.project_name ?? null}::text,
            'project_code', ${locked.project_code ?? null}::text,
            'role_id', ${session.roleId}::int,
            'archive_reason', ${parsed.data.reason ?? null}::text,
            'session_identifier', ${sessionIdentifier.slice(0, 150)}::text
          )
        )
      `);

      return {
        kind: "ok" as const,
        projectCode: locked.project_code ?? "",
        projectName: locked.project_name ?? "",
      };
    });

    if (out.kind === "not_found") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (out.kind === "already_archived") {
      return NextResponse.json(
        { error: "Project is already archived" },
        { status: 409 },
      );
    }

    if (out.kind === "confirmation_mismatch") {
      return NextResponse.json(
        {
          error: "Project code confirmation does not match.",
          expectedCode: out.expectedCode,
        },
        { status: 400 },
      );
    }

    if (out.kind === "synced_existing_archive") {
      return NextResponse.json({
        ok: true,
        message:
          "Project was already archived in repository. Active state has been synchronized and the project is now archived.",
        projectCode: out.projectCode,
        projectName: out.projectName,
      });
    }

    return NextResponse.json({
      ok: true,
      message:
        "Project archived successfully. The project has been removed from the active project list and preserved in the Project Archive.",
      projectCode: out.projectCode,
      projectName: out.projectName,
    });
  } catch (err) {
    const pgErr = err as { code?: string; message?: string; detail?: string };
    if (pgErr.code === "23505") {
      return NextResponse.json(
        {
          error:
            "Project archive record already exists. Refresh the page and check Project Archive list.",
          debug: {
            code: pgErr.code,
            message: pgErr.message,
            detail: pgErr.detail,
          },
        },
        { status: 409 },
      );
    }

    if (pgErr.code === "42P01" || pgErr.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Archive feature is not fully migrated in the database yet. Please apply archive migration (0001_project_archive_workflow.sql) and retry.",
          debug: {
            code: pgErr.code,
            message: pgErr.message,
            detail: pgErr.detail,
          },
        },
        { status: 503 },
      );
    }
    if (pgErr.code?.startsWith("42")) {
      return NextResponse.json(
        {
          error:
            pgErr.message?.slice(0, 300) ||
            "Archive operation failed due to a SQL compatibility issue.",
          debug: {
            code: pgErr.code,
            message: pgErr.message,
            detail: pgErr.detail,
          },
        },
        { status: 500 },
      );
    }

    console.error("POST /api/admin/projects/[id]/archive failed", err);
    return NextResponse.json(
      {
        error: pgErr.message?.slice(0, 300) || "Failed to archive project",
        debug: {
          code: pgErr.code,
          detail: pgErr.detail,
        },
      },
      { status: 500 },
    );
  }
}
