import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  requireTechAdminSession,
  isAdminSession,
} from "@/lib/auth/admin-session";
import type { OfficerSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { listAllUsers } from "@/lib/db/queries/admin";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

const createUserSchema = z.object({
  user_name: z.string().min(2).max(250),
  login_name: z.string().min(3).max(150),
  password: z.string().min(8),
  // Mobile is optional. When provided, must be 10 digits.
  mobile_no: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{10}$/.test(v), "Must be 10 digits if provided"),
  role_id: z.number().int().min(1).max(6),
  sec_id: z.number().int().positive().optional().nullable(),
  designation: z.string().max(250).optional(),
});

export async function GET() {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const rows = await listAllUsers();
    return NextResponse.json({
      users: rows.map((r) => ({
        userId: r.user_id,
        userPublicId: r.public_id,
        userName: r.user_name,
        loginName: r.login_name,
        mobileNo: r.mobile_no,
        roleId: r.role_id,
        status: r.status,
        secId: r.sec_id,
        secretaryName: r.secretary_name,
        designation: r.designation,
        lastLogin: r.last_login,
        registeredOn: r.registered_on,
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/users failed", err);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireTechAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse as OfficerSession;

  const body = await req.json().catch(() => null);
  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const d = parsed.data;

  try {
    // Check login_name is unique
    const existing = await db.execute(sql`
      SELECT user_id FROM hdp.user_details
      WHERE login_name = ${d.login_name} LIMIT 1
    `);
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: "Login name already exists" },
        { status: 409 },
      );
    }

    // Generate user_id (max + 1, or start at 1).
    // NOTE: previous version had an operator-precedence bug:
    //   ((max_id) || 0 + 1)   was grouped as   ((max_id) || (0 + 1))
    // which returned `max_id` unchanged when truthy → unique-PK collision.
    const maxIdResult = await db.execute(sql`
      SELECT COALESCE(MAX(user_id), 0)::bigint AS max_id FROM hdp.user_details
    `);
    const newUserId =
      Number((maxIdResult.rows[0] as { max_id: number | string }).max_id ?? 0) +
      1;

    // Hash password
    const hashedPassword = await bcrypt.hash(d.password, 12);

    // Insert user (empty mobile → NULL)
    const mobileForInsert =
      d.mobile_no && d.mobile_no.trim() ? d.mobile_no.trim() : null;

    const inserted = await db.execute(sql`
      INSERT INTO hdp.user_details (
        user_id, user_name, login_name, password, mobile_no,
        role_id, sec_id, designation, status, registered_on, registered_by
      ) VALUES (
        ${newUserId},
        ${d.user_name},
        ${d.login_name},
        ${hashedPassword},
        ${mobileForInsert},
        ${d.role_id},
        ${d.sec_id ?? null},
        ${d.designation ?? null},
        1,
        now(),
        ${session.userId}
      )
      RETURNING user_id
    `);

    const userId = Number(
      (inserted.rows[0] as { user_id: number | string }).user_id,
    );

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.USER_CREATED,
      entity: "user_details",
      entityId: userId,
      request: req,
      meta: { login_name: d.login_name, role_id: d.role_id },
    });

    return NextResponse.json({ userId }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/users failed", err);
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
        error: "Failed to create user",
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
