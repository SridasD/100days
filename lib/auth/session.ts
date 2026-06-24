import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/client';

export interface OfficerSession {
  userId: number;
  loginName: string;
  userName: string;
  roleId: number;
  secId: number;
}

export const ROLE = {
  VERIFICATION_OFFICER: 1,
  NODAL_OFFICER: 2,
  ADMIN: 3,
} as const;

/**
 * Require an authenticated session in an API route. Returns either the session
 * object (typed) or a NextResponse with the appropriate status code. Callers do:
 *
 *   const sessionOrResponse = await requireOfficerSession();
 *   if (sessionOrResponse instanceof NextResponse) return sessionOrResponse;
 *   const session = sessionOrResponse;
 *
 * sec_id and role_id are re-read from hdp.user_details on every request — the
 * JWT can otherwise carry stale values for hours when an admin updates a
 * user's department or role.
 */
export async function requireSession(): Promise<OfficerSession | NextResponse> {
  const s = await auth();
  if (!s?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const u = s.user as {
    id: string;
    loginName: string;
    name?: string | null;
    roleId: number;
    secId: number;
  };
  const userId = Number(u.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Bad session' }, { status: 400 });
  }

  // Re-resolve live sec_id / role_id from DB so admin updates take effect
  // without forcing every user to log out + back in.
  let liveSecId = u.secId;
  let liveRoleId = u.roleId;
  let liveUserName = u.name ?? u.loginName;
  try {
    const fresh = await db.execute(sql`
      SELECT sec_id, role_id, user_name, status
      FROM hdp.user_details
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const row = fresh.rows[0] as
      | {
          sec_id: number | null;
          role_id: number | null;
          user_name: string | null;
          status: number | null;
        }
      | undefined;
    if (row) {
      if (row.status === 0) {
        return NextResponse.json({ error: 'Account inactive' }, { status: 403 });
      }
      liveSecId = row.sec_id ?? u.secId;
      liveRoleId = row.role_id ?? u.roleId;
      liveUserName = row.user_name ?? liveUserName;
    }
  } catch {
    // DB hiccup — fall back to JWT values rather than blocking the request.
  }

  return {
    userId,
    loginName: u.loginName,
    userName: liveUserName,
    roleId: liveRoleId,
    secId: liveSecId,
  };
}

export async function requireOfficerSession(): Promise<
  OfficerSession | NextResponse
> {
  const s = await requireSession();
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.NODAL_OFFICER) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return s;
}

/** True when the value isn't a NextResponse — useful as a type guard. */
export function isSession(v: OfficerSession | NextResponse): v is OfficerSession {
  return !(v instanceof NextResponse);
}
