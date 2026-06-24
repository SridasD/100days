import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { userLog, type AuditAction } from '@/lib/db/schema/audit';

interface WriteAuditParams {
  userId?: number | null;
  action: AuditAction;
  entity?: string;
  entityId?: number | bigint | null;
  request: Request | NextRequest;
  outcome?: 'SUCCESS' | 'FAILURE';
  secId?: number | null;
  meta?: Record<string, unknown>;
}

function getClientIP(request: Request | NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Request-aware audit writer for API routes. Captures the caller's IP and
 * user-agent automatically and writes one row to hdp.user_log.
 */
export async function writeAudit(p: WriteAuditParams): Promise<void> {
  const ua = p.request.headers.get('user-agent') ?? null;
  await db.insert(userLog).values({
    userId: p.userId ?? null,
    action: p.action,
    entity: p.entity ?? null,
    entityId:
      typeof p.entityId === 'bigint' ? Number(p.entityId) : p.entityId ?? null,
    userIp: getClientIP(p.request).slice(0, 150),
    userAgent: ua?.slice(0, 500) ?? null,
    browserDetails: ua?.slice(0, 250) ?? null,
    secId: p.secId ?? null,
    outcome: p.outcome ?? 'SUCCESS',
    meta: p.meta ?? null,
    loggedOn: new Date(),
  });
}
