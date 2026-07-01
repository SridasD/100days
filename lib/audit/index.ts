import { db } from "@/lib/db/client";
import { userLog, type AuditAction } from "@/lib/db/schema/audit";
import { sessionBlocklist } from "@/lib/db/schema/user";

export interface AuditParams {
  userId?: number | null;
  action: AuditAction;
  entity?: string;
  entityId?: number | bigint | null;
  ip?: string | null;
  userAgent?: string | null;
  secId?: number | null;
  outcome?: "SUCCESS" | "FAILURE";
  meta?: Record<string, unknown>;
}

/**
 * Writes a row into hdp.user_log. See Section 9 of HDP_Platform_Blueprint_v2.md.
 */
export async function writeAuditLog(p: AuditParams): Promise<void> {
  await db.insert(userLog).values({
    userId: p.userId ?? null,
    action: p.action,
    entity: p.entity ?? null,
    entityId:
      typeof p.entityId === "bigint"
        ? Number(p.entityId)
        : (p.entityId ?? null),
    userIp: p.ip ?? null,
    userAgent: p.userAgent?.slice(0, 500) ?? null,
    browserDetails: p.userAgent?.slice(0, 250) ?? null,
    secId: p.secId ?? null,
    outcome: p.outcome ?? "SUCCESS",
    meta: p.meta ?? null,
    loggedOn: new Date(),
  });
}

/**
 * Blocklist a JWT token to prevent reuse after logout.
 * Stores the jti (JWT ID) in the session blocklist.
 */
export async function blocklistJWT(
  userId: number,
  jti: string,
  reason: string = "USER_LOGOUT",
): Promise<void> {
  try {
    await db.insert(sessionBlocklist).values({
      jti: jti.slice(0, 100), // Ensure it fits the column limit
      userId: userId,
      reason: reason.slice(0, 50),
    });
  } catch (error) {
    // Log the error but don't fail the logout
    console.error("Failed to blocklist JWT:", error);
  }
}
