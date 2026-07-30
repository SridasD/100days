import { auth } from "@/auth";
import { writeAuditLog } from "@/lib/audit";
import { AUDIT_ACTIONS } from "@/lib/db/schema/audit";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  const user = session?.user as
    | { id?: string; roleId?: number; loginName?: string }
    | undefined;
  const ip =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    null;
  const userAgent = request.headers.get("user-agent") ?? null;

  try {
    await writeAuditLog({
      userId: user?.id ? Number(user.id) : null,
      action: AUDIT_ACTIONS.LOGOUT,
      outcome: "SUCCESS",
      ip,
      userAgent,
      secId: (session?.user as { secId?: number } | undefined)?.secId ?? null,
      meta: {
        loginName: user?.loginName ?? null,
        roleId: user?.roleId ?? null,
      },
    });
  } catch {
    // Best effort: do not fail the logout flow if audit logging errors.
  }

  return Response.json({ ok: true });
}
