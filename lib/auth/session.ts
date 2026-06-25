import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

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
  OSD_ADMIN: 4,
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
export async function requireSession(
  req?: NextRequest,
): Promise<OfficerSession | NextResponse> {
  let token:
    | {
        id?: string | null;
        sub?: string | null;
        loginName?: string | null;
        name?: string | null;
        roleId?: number | string | null;
        secId?: number | string | null;
      }
    | null = null;

  if (req) {
    token = await getToken({
      req,
      secret: process.env.AUTH_SECRET,
    });
  } else {
    const hdrs = await headers();
    token = await getToken({
      req: {
        headers: {
          cookie: hdrs.get("cookie") ?? "",
          "x-forwarded-proto": hdrs.get("x-forwarded-proto") ?? "http",
        },
      } as any,
      secret: process.env.AUTH_SECRET,
    });
  }

  let user:
    | {
        id: string;
        loginName: string;
        name?: string | null;
        roleId: number;
        secId: number;
      }
    | undefined;

  if (token) {
    const tokenId = token.id ?? token.sub;
    user = {
      id: String(tokenId ?? ""),
      loginName: String(token.loginName ?? ""),
      name: (token.name as string | null | undefined) ?? null,
      roleId: Number(token.roleId ?? 0),
      secId: Number(token.secId ?? 0),
    };
  }

  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number(user.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Bad session" }, { status: 400 });
  }

  // Re-resolve live sec_id / role_id from DB so admin updates take effect
  // without forcing every user to log out + back in.
  let liveSecId = user.secId;
  let liveRoleId = user.roleId;
  let liveUserName = user.name ?? user.loginName;
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
        return NextResponse.json(
          { error: "Account inactive" },
          { status: 403 },
        );
      }
      liveSecId = row.sec_id ?? user.secId;
      liveRoleId = row.role_id ?? user.roleId;
      liveUserName = row.user_name ?? liveUserName;
    }
  } catch {
    // DB hiccup — fall back to JWT values rather than blocking the request.
  }

  return {
    userId,
    loginName: user.loginName,
    userName: liveUserName,
    roleId: liveRoleId,
    secId: liveSecId,
  };
}

export async function requireOfficerSession(
  req?: NextRequest,
): Promise<
  OfficerSession | NextResponse
> {
  const s = await requireSession(req);
  if (s instanceof NextResponse) return s;
  if (s.roleId !== ROLE.NODAL_OFFICER) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return s;
}

/** True when the value isn't a NextResponse — useful as a type guard. */
export function isSession(
  v: OfficerSession | NextResponse,
): v is OfficerSession {
  return !(v instanceof NextResponse);
}
