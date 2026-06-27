import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { isSession, requireOfficerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { listIndicatorsForProject } from "@/lib/db/queries/officer";
import { resolveProjectId } from "@/lib/db/public-id";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Self-healing schema guard.
// The deployed `hdp.indicators` table was missing the cascade columns
// (local_body_type, local_body_id[], beneficiary[], latitude, longitude).
// Rather than block on a manual migration, we run idempotent ALTERs on the
// first POST after server start and cache the result. Each `ADD COLUMN IF
// NOT EXISTS` is a metadata-only operation in Postgres when the default is a
// constant (and a single rewrite when it isn't), so this is cheap.
// ---------------------------------------------------------------------------
let columnsEnsured: Promise<void> | null = null;
async function ensureIndicatorCascadeColumns() {
  if (columnsEnsured) return columnsEnsured;
  columnsEnsured = (async () => {
    try {
      // Run each ALTER separately — if one fails the rest still try, and the
      // exact column at fault surfaces in the error.
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS local_body_type integer DEFAULT 0
      `);
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS local_body_id integer[] DEFAULT '{}'::integer[]
      `);
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS beneficiary integer[] DEFAULT '{}'::integer[]
      `);
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS latitude numeric(8,6)
      `);
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS longitude numeric(9,6)
      `);
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS supporting_dept_ids integer[] DEFAULT '{}'::integer[]
      `);

      // ---- Ensure indicator_id has its own sequence --------------------
      // The deployed table was missing the sequence default, forcing every
      // INSERT to compute MAX+1. We create the sequence owned by the column,
      // seed it past current MAX so it never produces a collision, then set
      // the column DEFAULT to draw from it.
      await db.execute(sql`
        CREATE SEQUENCE IF NOT EXISTS hdp.indicators_indicator_id_seq
          OWNED BY hdp.indicators.indicator_id
      `);
      await db.execute(sql`
        SELECT setval(
          'hdp.indicators_indicator_id_seq',
          COALESCE((SELECT MAX(indicator_id) FROM hdp.indicators), 0) + 1,
          false
        )
      `);
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ALTER COLUMN indicator_id
          SET DEFAULT nextval('hdp.indicators_indicator_id_seq'::regclass)
      `);
    } catch (err) {
      // Reset so the next request can try again — don't bake in a permanent
      // failure if the role temporarily lacked DDL rights.
      columnsEnsured = null;
      throw err;
    }
  })();
  return columnsEnsured;
}

// ---------------------------------------------------------------------------
// GET — list indicators for a project (officer-owned only)
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  try {
    const rows = await listIndicatorsForProject(id, {
      roleId: session.roleId,
      secId: session.secId,
      deptId: session.deptId,
    });
    return NextResponse.json({
      indicators: rows.map((r) => {
        const anyR = r as unknown as {
          verified_physical_achievement: number | null;
          verified_financial_achievement: string | number | null;
          verified_physical_description: string | null;
          supporting_dept_names: string | null;
        };
        const verifiedPhys =
          anyR.verified_physical_achievement != null
            ? Number(anyR.verified_physical_achievement)
            : null;
        const verifiedFin =
          anyR.verified_financial_achievement != null
            ? Number(anyR.verified_financial_achievement)
            : null;
        const verifiedDesc = anyR.verified_physical_description ?? null;
        const submittedAt = r.submitted_date
          ? new Date(r.submitted_date).getTime()
          : 0;
        const verifiedAt = r.verified_date
          ? new Date(r.verified_date).getTime()
          : 0;
        const isCurrentVerified =
          !!r.verified_date && (!r.submitted_date || verifiedAt >= submittedAt);
        const requiresReverification =
          !!r.verified_date && !!r.submitted_date && submittedAt > verifiedAt;

        return {
          indicatorId: r.indicator_id,
          indicatorPublicId: r.public_id,
          projectId: r.project_id,
          projectPublicId: r.project_public_id,
          name: r.indicator_name ?? "",
          unit: r.unit ?? "",
          districtId: r.district_id,
          district: r.district_name ?? "",
          physicalTarget: r.physical_target ? Number(r.physical_target) : 0,
          physicalAchievement: r.physical_achievement ?? 0,
          financialTarget: r.financial_target ? Number(r.financial_target) : 0,
          financialAchievement: r.financial_achievement
            ? Number(r.financial_achievement)
            : 0,
          percentage: r.percentage ? Number(r.percentage) : 0,
          verifiedPercentage: r.verified_percentage
            ? Number(r.verified_percentage)
            : 0,
          description: r.physical_description ?? "",
          completedDate: r.completed_date,
          submittedDate: r.submitted_date,
          verifiedDate: r.verified_date,
          isVerified: isCurrentVerified,
          requiresReverification,
          lastVerifiedSnapshot: !!r.verified_date
            ? {
                physicalAchievement: verifiedPhys,
                financialAchievement: verifiedFin,
                description: verifiedDesc,
              }
            : null,
          lastUpdatedAt: r.submitted_date,
          achievedDirectDays: r.achieved_no_days_employed_direct ?? 0,
          achievedDirectPersons: r.achieved_no_persons_employed_direct ?? 0,
          achievedIndirectDays: r.achieved_no_days_employed_indirect ?? 0,
          achievedIndirectPersons: r.achieved_no_persons_employed_indirect ?? 0,
          imageCount: r.image_count,
          videoCount: r.video_count,
          documentCount: r.document_count,
          supportingDeptNames: anyR.supporting_dept_names ?? "",
        };
      }),
    });
  } catch (err) {
    console.error("GET indicators failed", err);
    return NextResponse.json(
      { error: "Failed to load indicators" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST — create a new indicator
// ---------------------------------------------------------------------------
const createIndicatorSchema = z.object({
  indicator_name: z.string().min(3).max(255),
  // null = "All districts" — the form sends 0 → null in the client
  district_id: z.coerce.number().int().positive().optional().nullable(),
  unit: z.string().max(15),
  physical_target: z.coerce.number().min(0),
  financial_target: z.coerce.number().min(0),
  physical_description: z.string().max(2000).optional(),
  // Cascade fields (optional)
  local_body_type_id: z.coerce.number().int().positive().optional().nullable(),
  local_body_ids: z.array(z.coerce.number().int().positive()).default([]),
  beneficiary_ids: z.array(z.coerce.number().int().positive()).default([]),
  supporting_dept_ids: z.array(z.coerce.number().int().positive()).default([]),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  // Ownership — Nodal Officer by sec_id, HOD by dept_id.
  const own = await db.execute(sql`
    SELECT 1
    FROM hdp.master_projects mp
    WHERE mp.project_id = ${id}
      AND (
        (${session.roleId} = 2 AND EXISTS (
          SELECT 1
          FROM hdp.project_secretary ps
          WHERE ps.project_id = mp.project_id
            AND ps.sec_id = ${session.secId}
        ))
        OR
        (${session.roleId} = 6 AND EXISTS (
          SELECT 1
          FROM hdp.project_department pd
          WHERE pd.project_id = mp.project_id
            AND pd.dept_id = ${session.deptId}
        ))
      )
    LIMIT 1
  `);
  if (own.rows.length === 0) {
    return NextResponse.json(
      { error: "Forbidden: project not assigned to your department" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createIndicatorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    // Make sure every cascade column exists before we INSERT into it.
    await ensureIndicatorCascadeColumns();

    // The legacy `hdp.indicators` columns:
    //   local_body_type → integer (singular, no _id suffix; 0 = unspecified)
    //   local_body_id   → integer[] (postgres array, default '{}')
    //   beneficiary     → integer[] (postgres array, default '{}')
    //   indicator_id    → has its own sequence (no MAX+1 needed)
    //
    // node-postgres encodes JS arrays as records (e.g. `(1,2,3)`), which
    // Postgres rejects when the column is `integer[]`. We instead build the
    // Postgres array literal `{1,2,3}` ourselves and add an explicit
    // `::integer[]` cast in the SQL. Inputs are Zod-coerced positive
    // integers so there is no injection surface.
    const localBodyArr = d.local_body_ids ?? [];
    const beneficiaryArr = d.beneficiary_ids ?? [];
    const supportingDeptArr = d.supporting_dept_ids ?? [];
    const localBodyLit = `{${localBodyArr.join(",")}}`;
    const beneficiaryLit = `{${beneficiaryArr.join(",")}}`;
    const supportingDeptLit = `{${supportingDeptArr.join(",")}}`;

    // indicator_id is supplied by the sequence default we ensured above.
    const inserted = await db.execute(sql`
      INSERT INTO hdp.indicators (
        project_id, indicator_name, district_id, unit,
        physical_target, financial_target, physical_description,
        local_body_type, local_body_id, beneficiary, supporting_dept_ids,
        latitude, longitude,
        submitted_by, submitted_date
      ) VALUES (
        ${id},
        ${d.indicator_name},
        ${d.district_id ?? 0},
        ${d.unit},
        ${d.physical_target ?? null},
        ${d.financial_target ?? null},
        ${d.physical_description ?? null},
        ${d.local_body_type_id ?? 0},
        ${localBodyLit}::integer[],
        ${beneficiaryLit}::integer[],
        ${supportingDeptLit}::integer[],
        ${d.latitude ?? null},
        ${d.longitude ?? null},
        ${session.userId},
        now()
      )
      RETURNING indicator_id
    `);
    const newId = Number(
      (inserted.rows[0] as { indicator_id: number | string }).indicator_id,
    );

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.INDICATOR_CREATED,
      entity: "indicators",
      entityId: newId,
      request: req,
      secId: session.secId,
      meta: { projectId: id, name: d.indicator_name },
    });

    return NextResponse.json({ indicatorId: newId }, { status: 201 });
  } catch (err) {
    console.error("POST indicators failed", err);
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
        error: "Failed to create indicator",
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
