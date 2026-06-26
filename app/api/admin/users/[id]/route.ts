import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  isAdminSession,
  requireTechAdminSession,
} from "@/lib/auth/admin-session";
import type { OfficerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { getUser } from "@/lib/db/queries/admin";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET — single user
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const row = (await getUser(userId)) as unknown as Record<
      string,
      unknown
    > | null;
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      user: {
        userId: Number(row.user_id),
        userName: row.user_name ?? "",
        loginName: row.login_name ?? "",
        mobileNo: row.mobile_no ?? "",
        roleId: row.role_id ?? null,
        status: row.status ?? 1,
        secId: row.sec_id ?? null,
        designation: row.designation ?? "",
        lastLogin: row.last_login ?? null,
        registeredOn: row.registered_on ?? null,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/users/[id] failed", err);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update user. Password is optional (only set when admin resets it).
// ---------------------------------------------------------------------------
const updateSchema = z.object({
  user_name: z.string().min(2).max(250),
  mobile_no: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{10}$/.test(v), "Must be 10 digits if provided"),
  role_id: z.coerce.number().int().min(1).max(3),
  sec_id: z.coerce.number().int().positive().optional().nullable(),
  designation: z.string().max(250).optional().nullable(),
  status: z.coerce.number().int().min(0).max(1),
  password: z.string().min(8).optional().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse as OfficerSession;

  const { id } = await params;
  const userId = Number(id);
  if (!Number.isFinite(userId)) {
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

  try {
    const passwordHash = d.password ? await bcrypt.hash(d.password, 12) : null;

    const result = await db.execute(sql`
      UPDATE hdp.user_details SET
        user_name = ${d.user_name},
        mobile_no = ${d.mobile_no},
        role_id = ${d.role_id},
        sec_id = ${d.sec_id ?? 0},
        designation = ${d.designation ?? null},
        status = ${d.status},
        password = COALESCE(${passwordHash}, password),
        failed_login_attempts = CASE
          WHEN ${passwordHash}::text IS NOT NULL THEN 0
          ELSE failed_login_attempts END,
        locked_until = CASE
          WHEN ${passwordHash}::text IS NOT NULL THEN NULL
          ELSE locked_until END
      WHERE user_id = ${userId}
      RETURNING user_id
    `);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await writeAudit({
      userId: session.userId,
      action: passwordHash
        ? AUDIT_ACTIONS.ADMIN_PASSWORD_RESET
        : AUDIT_ACTIONS.USER_UPDATED,
      entity: "user_details",
      entityId: userId,
      request: req,
      meta: {
        target_user_id: userId,
        password_changed: !!passwordHash,
        status: d.status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/users/[id] failed", err);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 },
    );
  }
}
