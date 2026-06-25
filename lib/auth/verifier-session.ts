import { NextRequest, NextResponse } from "next/server";
import { requireSession, ROLE } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * Require a verification officer session (role_id = 1).
 *
 * Delegates to `requireSession`, which re-reads role/sec_id from DB so admin
 * edits take effect immediately (no stale JWT problem).
 */
export async function requireVerifierSession(req?: NextRequest) {
  const s = await requireSession(req);
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.VERIFICATION_OFFICER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return s;
}

export function isVerifierSession(v: any): v is any {
  return !(v instanceof NextResponse);
}
