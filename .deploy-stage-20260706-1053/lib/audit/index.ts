import { db } from "@/lib/db/client";
import { userLog, type AuditAction } from "@/lib/db/schema/audit";

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
  });
}
