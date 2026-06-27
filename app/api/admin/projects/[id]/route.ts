import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isAdminSession, requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";
import { getProject } from "@/lib/db/queries/admin";
import { resolveProjectId } from "@/lib/db/public-id";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — single project (used by /admin/projects/[id]/edit)
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const row = (await getProject(projectId)) as unknown as Record<
      string,
      unknown
    > | null;
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch linked administrative department + implementing departments.
    const secResult = await db.execute(sql`
      SELECT ps.sec_id, ms.secretary_name
      FROM hdp.project_secretary ps
      LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
      WHERE ps.project_id = ${projectId}
      ORDER BY ps.sec_id ASC
      LIMIT 1
    `);
    const secRow = secResult.rows[0] as
      | { sec_id: number | string | null; secretary_name: string | null }
      | undefined;

    const deptResult = await db.execute(sql`
      SELECT pd.dept_id, md.dept_name
      FROM hdp.project_department pd
      LEFT JOIN hdp.master_department md ON pd.dept_id = md.dept_id
      WHERE pd.project_id = ${projectId}
      ORDER BY md.dept_name ASC
    `);
    const deptIds = deptResult.rows.map((r) =>
      Number((r as { dept_id: number | string }).dept_id),
    );
    const departmentNames = deptResult.rows
      .map((r) => (r as { dept_name: string | null }).dept_name)
      .filter((n): n is string => !!n);
    const fallbackSecId = deptResult.rows[0]
      ? Number(
          (deptResult.rows[0] as { sec_id: number | string | null }).sec_id ??
            0,
        ) || null
      : null;
    const fallbackSecretaryName = deptResult.rows[0]
      ? ((deptResult.rows[0] as { dept_name: string | null }).dept_name ?? null)
      : null;

    return NextResponse.json({
      project: {
        projectId: Number(row.project_id),
        projectPublicId: row.public_id
          ? String(row.public_id)
          : String(projectId),
        projectCode: row.project_code ?? null,
        projectName: row.project_name ?? "",
        projectNameMal: row.project_name_mal ?? "",
        description: row.description ?? "",
        projectOutcome: row.project_outcome ?? "",
        isNew:
          row.is_new === true || row.is_new === 1 || row.is_new === "1" ? 1 : 0,
        projectCost: row.project_cost ? Number(row.project_cost) : 0,
        sectorId: row.sector_id ?? null,
        sourceOfFundingId: row.source_of_funding_id ?? null,
        sourceOfFundingName: row.source_of_funding_name ?? null,
        natureOfProject: row.nature_of_project ?? null,
        priority: row.priority ?? null,
        projectExecutionType: row.project_execution_type ?? null,
        isCompleted: row.is_completed ?? 0,
        stage: row.stage ?? 1,
        completionDate: row.completion_date ?? null,
        noDaysEmployedDirect: row.no_days_employed_direct ?? 0,
        noPersonsEmployedDirect: row.no_persons_employed_direct ?? 0,
        noDaysEmployedIndirect: row.no_days_employed_indirect ?? 0,
        noPersonsEmployedIndirect: row.no_persons_employed_indirect ?? 0,
        otherBenefits: row.other_benefits ?? "",
        govtPolicyLinkage: row.govt_policy_linkage ?? "",
        manifestoLinkage: row.manifesto_linkage ?? "",
        extraOne: row.extra_one ?? "",
        extraTwo: row.extra_two ?? "",
        extraThree: row.extra_three ?? "",
        secId: secRow?.sec_id != null ? Number(secRow.sec_id) : fallbackSecId,
        secretaryName: secRow?.secretary_name ?? fallbackSecretaryName,
        secIds:
          secRow?.sec_id != null
            ? [Number(secRow.sec_id)]
            : fallbackSecId != null
              ? [fallbackSecId]
              : [],
        secretaryNames: secRow?.secretary_name
          ? [secRow.secretary_name]
          : fallbackSecretaryName
            ? [fallbackSecretaryName]
            : [],
        deptIds,
        departmentNames,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/projects/[id] failed", err);
    return NextResponse.json(
      { error: "Failed to load project" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update a project
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  project_name: z.string().min(3).max(500),
  description: z.string().min(1),
  is_new: z.coerce.number().int().min(0).max(1).default(1),
  project_cost: z.coerce.number().min(0).optional().nullable(),
  nature_of_project: z.coerce
    .number()
    .int()
    .min(1)
    .max(2)
    .optional()
    .nullable(),
  priority: z.coerce.number().int().min(1).max(3).optional().nullable(),
  source_of_funding_id: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .nullable(),
  project_execution_type: z.coerce
    .number()
    .int()
    .min(1)
    .max(2)
    .optional()
    .nullable(),
  is_completed: z.coerce.number().int().min(0).max(2).default(0),
  completion_date: z.string().optional().nullable(),
  sector_id: z.coerce.number().int().positive(),
  sec_id: z.coerce
    .number()
    .int()
    .positive("Administrative department is required"),
  dept_ids: z
    .array(z.coerce.number().int().positive())
    .min(1, "At least one implementing department is required"),
  no_days_employed_direct: z.coerce.number().int().min(0).default(0),
  no_persons_employed_direct: z.coerce.number().int().min(0).default(0),
  no_days_employed_indirect: z.coerce.number().int().min(0).default(0),
  no_persons_employed_indirect: z.coerce.number().int().min(0).default(0),
  project_outcome: z.string().optional().nullable(),
  other_benefits: z.string().optional().nullable(),
  govt_policy_linkage: z.string().optional().nullable(),
  manifesto_linkage: z.string().optional().nullable(),
  extra_one: z.string().optional().nullable(),
  extra_two: z.string().optional().nullable(),
  extra_three: z.string().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const completionDate = d.completion_date ? d.completion_date : null;
  const isNewValue = d.is_new === 1;

  try {
    const updated = await db.execute(sql`
      UPDATE hdp.master_projects SET
        project_name = ${d.project_name},
        description = ${d.description},
        is_new = ${isNewValue},
        project_cost = ${d.project_cost ?? null},
        nature_of_project = ${d.nature_of_project ?? null},
        priority = ${d.priority ?? null},
        source_of_funding_id = ${d.source_of_funding_id ?? null},
        project_execution_type = ${d.project_execution_type ?? null},
        is_completed = ${d.is_completed},
        completion_date = ${completionDate},
        sector_id = ${d.sector_id},
        no_days_employed_direct = ${d.no_days_employed_direct},
        no_persons_employed_direct = ${d.no_persons_employed_direct},
        no_days_employed_indirect = ${d.no_days_employed_indirect},
        no_persons_employed_indirect = ${d.no_persons_employed_indirect},
        project_outcome = ${d.project_outcome ?? null},
        other_benefits = ${d.other_benefits ?? null},
        govt_policy_linkage = ${d.govt_policy_linkage ?? null},
        manifesto_linkage = ${d.manifesto_linkage ?? null},
        extra_one = ${d.extra_one ?? null},
        extra_two = ${d.extra_two ?? null},
        extra_three = ${d.extra_three ?? null},
        updated_by = ${session.userId}
      WHERE project_id = ${projectId}
        AND COALESCE(is_archived, false) = false
      RETURNING project_id, project_code
    `);
    if (updated.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Re-point administrative department link.
    await db.execute(sql`
      DELETE FROM hdp.project_secretary WHERE project_id = ${projectId}
    `);
    await db.execute(sql`
      INSERT INTO hdp.project_secretary (project_id, sec_id)
      VALUES (${projectId}, ${d.sec_id})
    `);

    // Re-point implementing departments.
    await db.execute(sql`
      DELETE FROM hdp.project_department WHERE project_id = ${projectId}
    `);
    const maxDeptRes = await db.execute(sql`
      SELECT COALESCE(MAX(id), 0) AS m FROM hdp.project_department
    `);
    let nextDeptLinkId =
      Number((maxDeptRes.rows[0] as { m: number | string }).m) + 1;
    const uniqueDeptIds = Array.from(new Set(d.dept_ids));
    for (const deptId of uniqueDeptIds) {
      await db.execute(sql`
        INSERT INTO hdp.project_department (id, project_id, dept_id)
        VALUES (${nextDeptLinkId}, ${projectId}, ${deptId})
      `);
      nextDeptLinkId++;
    }

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.PROJECT_UPDATED,
      entity: "master_projects",
      entityId: projectId,
      request: req,
      meta: {
        project_name: d.project_name,
        sec_id: d.sec_id,
        dept_ids: uniqueDeptIds,
        source_of_funding_id: d.source_of_funding_id ?? null,
        project_outcome: d.project_outcome ?? null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/projects/[id] failed", err);
    const pgErr = err as {
      message?: string;
      code?: string;
      detail?: string;
      column?: string;
      table?: string;
      constraint?: string;
    };
    return NextResponse.json(
      {
        error: "Failed to update project",
        debug: {
          message: pgErr.message,
          code: pgErr.code,
          detail: pgErr.detail,
          column: pgErr.column,
          table: pgErr.table,
          constraint: pgErr.constraint,
        },
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE is intentionally disabled. Use archive workflow instead.
// ---------------------------------------------------------------------------
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const projectId = await resolveProjectId(id);
  if (!projectId) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error:
        "Permanent delete is disabled. Use POST /api/admin/projects/[id]/archive instead.",
      projectId,
    },
    { status: 405 },
  );
}
