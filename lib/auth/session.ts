import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";
import { sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";

export interface OfficerSession {
  userId: number;
  loginName: string;
  userName: string;
  roleId: number;
  secId: number;
  deptId: number;
}

export const ROLE = {
  VERIFICATION_OFFICER: 1,
  NODAL_OFFICER: 2,
  SECRETARY: 5,
  HEAD_OF_DEPARTMENT: 6,
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
  const authDebug = process.env.AUTH_DEBUG_LOG === "true";
  const saltCandidates = [
    process.env.AUTH_SALT,
    "__Secure-authjs.session-token",
    "authjs.session-token",
    "__Secure-next-auth.session-token",
    "next-auth.session-token",
  ].filter((v, i, arr): v is string => Boolean(v) && arr.indexOf(v) === i);

  let token: {
    id?: string | null;
    sub?: string | null;
    loginName?: string | null;
    name?: string | null;
    roleId?: number | string | null;
    secId?: number | string | null;
    deptId?: number | string | null;
  } | null = null;

  if (req) {
    for (const salt of saltCandidates) {
      token = await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? "",
        salt,
      });
      if (token) break;
    }
    if (authDebug) {
      const host = req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto");
      const cookieHeader = req.headers.get("cookie") ?? "";
      const hasAuthjsSecure = cookieHeader.includes(
        "__Secure-authjs.session-token=",
      );
      const hasAuthjs = cookieHeader.includes("authjs.session-token=");
      const hasNextAuthSecure = cookieHeader.includes(
        "__Secure-next-auth.session-token=",
      );
      const hasNextAuth = cookieHeader.includes("next-auth.session-token=");
      console.info("[auth][requireSession][req]", {
        path: req.nextUrl.pathname,
        method: req.method,
        host,
        proto,
        hasAuthjsSecure,
        hasAuthjs,
        hasNextAuthSecure,
        hasNextAuth,
        tokenResolved: Boolean(token),
      });
    }
  } else {
    const hdrs = await headers();
    const forwardedProto =
      hdrs.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    for (const salt of saltCandidates) {
      token = await getToken({
        req: {
          headers: {
            cookie: hdrs.get("cookie") ?? "",
            "x-forwarded-proto": forwardedProto,
          },
        } as unknown as Parameters<typeof getToken>[0]["req"],
        secret: process.env.AUTH_SECRET ?? "",
        salt,
      });
      if (token) break;
    }
    if (authDebug) {
      const cookieHeader = hdrs.get("cookie") ?? "";
      const hasAuthjsSecure = cookieHeader.includes(
        "__Secure-authjs.session-token=",
      );
      const hasAuthjs = cookieHeader.includes("authjs.session-token=");
      const hasNextAuthSecure = cookieHeader.includes(
        "__Secure-next-auth.session-token=",
      );
      const hasNextAuth = cookieHeader.includes("next-auth.session-token=");
      console.info("[auth][requireSession][headers]", {
        host: hdrs.get("host"),
        forwardedProto,
        hasAuthjsSecure,
        hasAuthjs,
        hasNextAuthSecure,
        hasNextAuth,
        tokenResolved: Boolean(token),
      });
    }
  }

  let user:
    | {
        id: string;
        loginName: string;
        name?: string | null;
        roleId: number;
        secId: number;
        deptId: number;
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
      deptId: Number(token.deptId ?? 0),
    };
  }

  // Fallback: in some proxy/runtime setups getToken can intermittently fail
  // even when a valid session exists. Try NextAuth's auth() before rejecting.
  if (!user?.id) {
    try {
      const authWithReq = auth as unknown as (
        request: NextRequest,
      ) => Promise<{ user?: unknown } | null>;
      const session = req ? await authWithReq(req) : await auth();
      const sessionUser = session?.user as
        | {
            id?: string;
            loginName?: string;
            name?: string | null;
            roleId?: number;
            secId?: number;
            deptId?: number;
          }
        | undefined;

      if (sessionUser?.id) {
        user = {
          id: String(sessionUser.id),
          loginName: String(sessionUser.loginName ?? ""),
          name: sessionUser.name ?? null,
          roleId: Number(sessionUser.roleId ?? 0),
          secId: Number(sessionUser.secId ?? 0),
          deptId: Number(sessionUser.deptId ?? 0),
        };
      }

      if (authDebug) {
        console.info("[auth][requireSession][fallbackAuth]", {
          resolved: Boolean(user?.id),
          roleId: user?.roleId ?? null,
        });
      }
    } catch {
      // Ignore and return Unauthorized below if no usable session is found.
    }
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
  let liveDeptId = user.deptId;
  let liveRoleId = user.roleId;
  let liveUserName = user.name ?? user.loginName;
  try {
    const fresh = await db.execute(sql`
      SELECT sec_id, dept_id, role_id, user_name, status
      FROM hdp.user_details
      WHERE user_id = ${userId}
      LIMIT 1
    `);
    const row = fresh.rows[0] as
      | {
          sec_id: number | null;
          dept_id: number | null;
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
      liveDeptId = row.dept_id ?? user.deptId;
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
    deptId: liveDeptId,
  };
}

export async function requireOfficerSession(
  req?: NextRequest,
): Promise<OfficerSession | NextResponse> {
  const s = await requireSession(req);
  if (s instanceof NextResponse) return s;
  if (
    s.roleId !== ROLE.NODAL_OFFICER &&
    s.roleId !== ROLE.HEAD_OF_DEPARTMENT &&
    s.roleId !== ROLE.SECRETARY &&
    s.roleId !== ROLE.ADMIN &&
    s.roleId !== ROLE.OSD_ADMIN
  ) {
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
