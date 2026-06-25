import { NextRequest, NextResponse } from "next/server";
import { requireSession, ROLE } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Require an admin session (role_id = 3 or 4)
 */
export async function requireAdminSession() {
  const s = await requireSession();
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.ADMIN && s.roleId !== ROLE.OSD_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return s;
}

export function isAdminSession(v: any): v is any {
  return !(v instanceof NextResponse);
}
