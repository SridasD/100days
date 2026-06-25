import { NextRequest, NextResponse } from "next/server";
import { requireSession, ROLE } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Require an admin session (role_id = 3 or 4)
 */
export async function requireAdminSession(req?: NextRequest) {
  const s = await requireSession(req);
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.ADMIN && s.roleId !== ROLE.OSD_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return s;
}

/** Require a technical administrator session (role_id = 3 only). */
export async function requireTechAdminSession(req?: NextRequest) {
  const s = await requireSession(req);
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return s;
}

/** Require an OSD administrator session (role_id = 4 only). */
export async function requireOsdAdminSession(req?: NextRequest) {
  const s = await requireSession(req);
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.OSD_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return s;
}

export function isAdminSession(v: any): v is any {
  return !(v instanceof NextResponse);
}
