import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { blocklistJWT } from "@/lib/audit";
import { writeAudit } from "@/lib/audit/writeAudit";
import { isSession, requireSession } from "@/lib/auth/session";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";

export const runtime = "nodejs";

const saltCandidates = [
  process.env.AUTH_SALT,
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
].filter(
  (value, index, all): value is string =>
    Boolean(value) && all.indexOf(value) === index,
);

function fallbackBlocklistKey(userId: number): string {
  return `logout-${userId}-${Date.now()}`;
}

export async function POST(req: NextRequest) {
  const sessionOrResponse = await requireSession(req);
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  try {
    let token: Record<string, unknown> | null = null;
    for (const salt of saltCandidates) {
      token = (await getToken({
        req,
        secret: process.env.AUTH_SECRET ?? "",
        salt,
      })) as Record<string, unknown> | null;
      if (token) break;
    }

    const tokenJti =
      typeof token?.jti === "string" && token.jti.trim()
        ? token.jti.trim()
        : null;

    await blocklistJWT(
      session.userId,
      tokenJti ?? fallbackBlocklistKey(session.userId),
      "USER_LOGOUT",
    );

    await writeAudit({
      userId: session.userId,
      action: AUDIT_ACTIONS.LOGOUT,
      entity: "session",
      entityId: session.userId,
      request: req,
      outcome: "SUCCESS",
      secId: session.secId ?? null,
      meta: {
        loginName: session.loginName,
        roleId: session.roleId,
        usedTokenJti: Boolean(tokenJti),
      },
    });
  } catch (error) {
    console.error(
      "[auth][logout] Failed to audit logout or blocklist JWT:",
      error,
    );
  }

  return NextResponse.json({ ok: true });
}
