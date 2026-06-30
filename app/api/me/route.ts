import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { requireSession, isSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { writeAudit } from "@/lib/audit/writeAudit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

// Returns the live profile of the currently signed-in user. The OfficerUserMenu
// calls this on mount so that the displayed name + designation are always
// up to date — independent of what was baked into the JWT at login. Useful
// when an admin edits a user's designation, or when the JWT predates a
// schema change (e.g. before we started storing designation in the token).
export const runtime = "nodejs";

const updateProfileSchema = z.object({
  userName: z.string().min(2).max(250),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254)
    .optional()
    .nullable()
    .or(z.literal("")),
  mobile: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^\d{10}$/.test(v), "Must be 10 digits if provided"),
});

export async function GET(req: NextRequest) {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;
  const userId = session.userId;

  try {
    await db.execute(sql`
      ALTER TABLE hdp.user_details
        ADD COLUMN IF NOT EXISTS email_address varchar(254)
    `);

    const r = await db.execute(sql`
      SELECT
        u.user_id,
        u.user_name,
        u.login_name,
        u.designation,
        u.mobile_no,
        u.email_address,
        u.role_id,
        u.sec_id,
        u.dept_id,
        u.status,
        u.last_login,
        s.secretary_name,
        d.dept_name
      FROM hdp.user_details u
      LEFT JOIN hdp.master_secretary s ON u.sec_id = s.sec_id
      LEFT JOIN hdp.master_department d ON u.dept_id = d.dept_id
      WHERE u.user_id = ${userId}
      LIMIT 1
    `);
    const row = r.rows[0] as
      | {
          user_id: number;
          user_name: string | null;
          login_name: string | null;
          designation: string | null;
          mobile_no: string | null;
          email_address: string | null;
          role_id: number | null;
          sec_id: number | null;
          dept_id: number | null;
          status: number | null;
          last_login: string | null;
          secretary_name: string | null;
          dept_name: string | null;
        }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      userId: Number(row.user_id),
      userName: row.user_name ?? row.login_name ?? "",
      loginName: row.login_name ?? "",
      designation: row.designation ?? null,
      mobile: row.mobile_no ?? null,
      email: row.email_address ?? null,
      roleId: row.role_id ?? 0,
      secId: row.sec_id ?? 0,
      deptId: row.dept_id ?? 0,
      departmentLabel:
        row.role_id === 6
          ? (row.dept_name ?? null)
          : (row.secretary_name ?? null),
      status: row.status ?? 0,
      lastLogin: row.last_login,
    });
  } catch (err) {
    console.error("GET /api/me failed", err);
    return NextResponse.json(
      { error: "Failed to load profile" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const sessionOrResponse = await requireSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const userName = parsed.data.userName.trim();
  const email =
    typeof parsed.data.email === "string" && parsed.data.email.trim()
      ? parsed.data.email.trim().toLowerCase()
      : null;
  const mobile =
    parsed.data.mobile && parsed.data.mobile.trim()
      ? parsed.data.mobile.trim()
      : null;

  try {
    await db.execute(sql`
      ALTER TABLE hdp.user_details
        ADD COLUMN IF NOT EXISTS email_address varchar(254)
    `);

    const result = await db.execute(sql`
      UPDATE hdp.user_details SET
        user_name = ${userName},
        email_address = ${email},
        mobile_no = ${mobile}
      WHERE user_id = ${session.userId}
      RETURNING user_id
    `);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.USER_UPDATED,
      entity: "user_details",
      entityId: session.userId,
      request: req,
      meta: { profile_update: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/me failed", err);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 },
    );
  }
}
