import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isAdminSession, requireAdminSession } from "@/lib/auth/admin-session";
import { db } from "@/lib/db/client";
import { listAllProjects } from "@/lib/db/queries/admin";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — list all projects
// ---------------------------------------------------------------------------
export async function GET() {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const rows = await listAllProjects();
    return NextResponse.json({
      projects: rows.map((r) => ({
        projectId: r.project_id,
        projectCode: r.project_code,
        projectName: r.project_name,
        projectNameMal: r.project_name_mal,
        description: r.description,
        projectCost: r.project_cost,
        sectorId: r.sector_id,
        isCompleted: r.is_completed,
        stage: r.stage,
        secId: r.sec_id,
        secretaryName: r.secretary_name,
        indicatorsCount: r.indicators_count,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/projects failed", err);
    return NextResponse.json(
      { error: "Failed to load projects" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create a new project (Appendix C.10)
// ---------------------------------------------------------------------------
const createProjectSchema = z.object({
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
  other_benefits: z.string().optional().nullable(),
  govt_policy_linkage: z.string().optional().nullable(),
  manifesto_linkage: z.string().optional().nullable(),
  extra_one: z.string().optional().nullable(),
  extra_two: z.string().optional().nullable(),
  extra_three: z.string().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const body = await req.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
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
    const inserted = await db.execute(sql`
      INSERT INTO hdp.master_projects (
        project_id, project_name, description, is_new, project_cost,
        nature_of_project, priority, project_execution_type, is_completed,
        completion_date, sector_id, stage,
        no_days_employed_direct, no_persons_employed_direct,
        no_days_employed_indirect, no_persons_employed_indirect,
        other_benefits, govt_policy_linkage, manifesto_linkage,
        extra_one, extra_two, extra_three,
        inserted_by, updated_by
      ) VALUES (
        COALESCE((SELECT MAX(project_id) FROM hdp.master_projects), 0) + 1,
        ${d.project_name}, ${d.description}, ${isNewValue}, ${d.project_cost ?? null},
        ${d.nature_of_project ?? null}, ${d.priority ?? null},
        ${d.project_execution_type ?? null}, ${d.is_completed},
        ${completionDate}, ${d.sector_id}, 1,
        ${d.no_days_employed_direct}, ${d.no_persons_employed_direct},
        ${d.no_days_employed_indirect}, ${d.no_persons_employed_indirect},
        ${d.other_benefits ?? null}, ${d.govt_policy_linkage ?? null},
        ${d.manifesto_linkage ?? null},
        ${d.extra_one ?? null}, ${d.extra_two ?? null}, ${d.extra_three ?? null},
        ${session.userId}, ${session.userId}
      )
      RETURNING project_id
    `);

    const row = inserted.rows[0] as {
      project_id: number | string;
    };
    const projectId = Number(row.project_id);

    // ----- generate project_code in the new HDP-{year}-{NNNN} format ------
    // The "year" is the calendar year of creation (defensible audit trail).
    // The sequence is the count of projects whose project_id is <= this row
    // and that match the same year — guarantees stable, contiguous numbering
    // even across concurrent inserts because project_id is monotonic.
    const codeYear = new Date().getFullYear();
    const codeResult = await db.execute(sql`
      WITH this_year AS (
        SELECT COUNT(*)::int AS seq
        FROM hdp.master_projects mp
        WHERE mp.project_id <= ${projectId}
          AND COALESCE(
            EXTRACT(YEAR FROM mp.completion_date)::int,
            ${codeYear}
          ) = ${codeYear}
      )
      UPDATE hdp.master_projects
      SET project_code = 'HDP-' || ${codeYear}::text || '-' || LPAD(
        (SELECT GREATEST(seq, 1) FROM this_year)::text, 4, '0'
      )
      WHERE project_id = ${projectId}
      RETURNING project_code
    `);
    const projectCode =
      (codeResult.rows[0] as { project_code: string | null } | undefined)
        ?.project_code ??
      `HDP-${codeYear}-${String(projectId).padStart(4, "0")}`;

    await db.execute(sql`
      INSERT INTO hdp.project_secretary (project_id, sec_id)
      VALUES (${projectId}, ${d.sec_id})
    `);

    // Link to selected implementing departments.
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
      action: AUDIT_ACTIONS.PROJECT_CREATED,
      entity: "master_projects",
      entityId: projectId,
      request: req,
      meta: {
        project_name: d.project_name,
        sec_id: d.sec_id,
        dept_ids: uniqueDeptIds,
        sector_id: d.sector_id,
        project_code: projectCode,
      },
    });

    return NextResponse.json({ projectId, projectCode }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/projects failed", err);
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
        error: "Failed to create project",
        // Detailed PG fields surfaced so the form can show "column X does not exist"
        // and the dev can patch the schema or the INSERT without re-running.
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
