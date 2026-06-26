import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { isSession, requireOfficerSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { officerOwnsIndicator } from '@/lib/db/queries/officer';
import { writeAudit } from '@/lib/audit/writeAudit';
import { AUDIT_ACTIONS } from '@/lib/db/schema/audit';

export const runtime = 'nodejs';

let supportingDeptColumnEnsured: Promise<void> | null = null;
async function ensureSupportingDeptColumn() {
  if (supportingDeptColumnEnsured) return supportingDeptColumnEnsured;
  supportingDeptColumnEnsured = (async () => {
    try {
      await db.execute(sql`
        ALTER TABLE hdp.indicators
          ADD COLUMN IF NOT EXISTS supporting_dept_ids integer[] DEFAULT '{}'::integer[]
      `);
    } catch (err) {
      supportingDeptColumnEnsured = null;
      throw err;
    }
  })();
  return supportingDeptColumnEnsured;
}

// ---------------------------------------------------------------------------
// GET — fetch a single indicator for the edit form (officer-owned only)
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid indicatorId' }, { status: 400 });
  }

  const owns = await officerOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureSupportingDeptColumn();

    const r = await db.execute(sql`
      SELECT
        i.indicator_id,
        i.project_id,
        i.indicator_name,
        i.unit,
        i.district_id,
        i.physical_target,
        i.financial_target,
        i.physical_description,
        i.local_body_type,
        i.local_body_id,
        i.beneficiary,
        i.supporting_dept_ids,
        i.latitude,
        i.longitude,
        i.submitted_date,
        i.verified_date
      FROM hdp.indicators i
      WHERE i.indicator_id = ${id}
      LIMIT 1
    `);
    const row = r.rows[0] as any;
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      indicator: {
        indicatorId: Number(row.indicator_id),
        projectId: Number(row.project_id),
        indicatorName: row.indicator_name ?? '',
        unit: row.unit ?? '',
        districtId: row.district_id != null ? Number(row.district_id) : 0,
        physicalTarget: row.physical_target ? Number(row.physical_target) : 0,
        financialTarget: row.financial_target ? Number(row.financial_target) : 0,
        physicalDescription: row.physical_description ?? '',
        localBodyTypeId:
          row.local_body_type != null ? Number(row.local_body_type) : 0,
        localBodyIds: Array.isArray(row.local_body_id)
          ? (row.local_body_id as number[]).map(Number)
          : [],
        beneficiaryIds: Array.isArray(row.beneficiary)
          ? (row.beneficiary as number[]).map(Number)
          : [],
        supportingDeptIds: Array.isArray(row.supporting_dept_ids)
          ? (row.supporting_dept_ids as number[]).map(Number)
          : [],
        latitude: row.latitude != null ? Number(row.latitude) : null,
        longitude: row.longitude != null ? Number(row.longitude) : null,
        isSubmitted: !!row.submitted_date,
        isVerified: !!row.verified_date,
      },
    });
  } catch (err) {
    console.error('GET /api/officer/indicators/[id] failed', err);
    return NextResponse.json(
      { error: 'Failed to load indicator' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — update an indicator's master fields.
// If the indicator was already verified, this creates a new pending
// submission (re-verification required) while keeping the last verified
// snapshot intact for public display.
// ---------------------------------------------------------------------------
const patchSchema = z.object({
  indicator_name: z.string().min(3).max(255),
  unit: z.string().max(15),
  district_id: z.coerce.number().int().min(0).optional().nullable(),
  physical_target: z.coerce.number().min(0),
  financial_target: z.coerce.number().min(0),
  physical_description: z.string().max(2000).optional().default(''),
  local_body_type_id: z.coerce.number().int().min(0).optional().nullable(),
  local_body_ids: z.array(z.coerce.number().int().positive()).default([]),
  beneficiary_ids: z.array(z.coerce.number().int().positive()).default([]),
  supporting_dept_ids: z.array(z.coerce.number().int().positive()).default([]),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid indicatorId' }, { status: 400 });
  }

  const owns = await officerOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const prev = await db.execute(sql`
    SELECT
      verified_date,
      verified_physical_achievement,
      verified_financial_achievement,
      verified_percentage,
      verified_physical_description
    FROM hdp.indicators
    WHERE indicator_id = ${id}
    LIMIT 1
  `);
  const prevRow = (prev.rows[0] ?? {}) as {
    verified_date?: string | null;
    verified_physical_achievement?: number | null;
    verified_financial_achievement?: number | string | null;
    verified_percentage?: number | string | null;
    verified_physical_description?: string | null;
  };

  try {
    await ensureSupportingDeptColumn();

    // Build the Postgres array literals — same approach as the POST handler.
    const localBodyLit = `{${(d.local_body_ids ?? []).join(',')}}`;
    const beneficiaryLit = `{${(d.beneficiary_ids ?? []).join(',')}}`;
    const supportingDeptLit = `{${(d.supporting_dept_ids ?? []).join(',')}}`;

    await db.execute(sql`
      UPDATE hdp.indicators
      SET
        indicator_name = ${d.indicator_name},
        unit = ${d.unit},
        district_id = ${d.district_id ?? 0},
        physical_target = ${d.physical_target},
        financial_target = ${d.financial_target},
        physical_description = ${d.physical_description || null},
        local_body_type = ${d.local_body_type_id ?? 0},
        local_body_id = ${localBodyLit}::integer[],
        beneficiary = ${beneficiaryLit}::integer[],
        supporting_dept_ids = ${supportingDeptLit}::integer[],
        latitude = ${d.latitude ?? null},
        longitude = ${d.longitude ?? null},
        submitted_by = ${session.userId},
        submitted_date = now()
      WHERE indicator_id = ${id}
    `);

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.INDICATOR_CREATED, // closest existing action
      entity: 'indicators',
      entityId: id,
      request: req,
      secId: session.secId,
      meta: {
        editedBy: session.userId,
        name: d.indicator_name,
        requires_reverification: true,
        previous_verified: {
          verified_date: prevRow.verified_date ?? null,
          physical_achievement:
            prevRow.verified_physical_achievement != null
              ? Number(prevRow.verified_physical_achievement)
              : null,
          financial_achievement:
            prevRow.verified_financial_achievement != null
              ? Number(prevRow.verified_financial_achievement)
              : null,
          percentage:
            prevRow.verified_percentage != null
              ? Number(prevRow.verified_percentage)
              : null,
          description: prevRow.verified_physical_description ?? null,
        },
      },
    });

    return NextResponse.json({ ok: true, indicatorId: id });
  } catch (err) {
    console.error('PATCH /api/officer/indicators/[id] failed', err);
    const pgErr = err as {
      message?: string;
      code?: string;
      detail?: string;
      column?: string;
    };
    return NextResponse.json(
      {
        error: 'Failed to update indicator',
        debug: {
          message: pgErr.message,
          code: pgErr.code,
          detail: pgErr.detail,
          column: pgErr.column,
        },
      },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE — soft-delete via row removal (the legacy `delete_indicators_trigger`
// archives the row server-side). Allowed only when not yet verified.
// ---------------------------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid indicatorId' }, { status: 400 });
  }

  const owns = await officerOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lock = await db.execute(sql`
    SELECT verified_date FROM hdp.indicators
    WHERE indicator_id = ${id} LIMIT 1
  `);
  const lockRow = lock.rows[0] as { verified_date: string | null } | undefined;
  if (lockRow?.verified_date) {
    return NextResponse.json(
      {
        error:
          'This indicator has already been verified and can no longer be deleted.',
      },
      { status: 409 },
    );
  }

  try {
    await db.execute(sql`DELETE FROM hdp.indicators WHERE indicator_id = ${id}`);

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.INDICATOR_REJECTED, // closest existing for "removed"
      entity: 'indicators',
      entityId: id,
      request: req,
      secId: session.secId,
      meta: { deletedBy: session.userId },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/officer/indicators/[id] failed', err);
    return NextResponse.json(
      { error: 'Failed to delete indicator' },
      { status: 500 },
    );
  }
}
