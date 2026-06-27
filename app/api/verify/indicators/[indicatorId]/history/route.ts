/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import {
  isVerifierSession,
  requireVerifierSession,
} from '@/lib/auth/verifier-session';
import { db } from '@/lib/db/client';
import { verifierOwnsIndicator } from '@/lib/db/queries/verifier';

// History tab data â€” reads every audit row tied to this indicator.
// We pull both indicator-level events (CREATED, SUBMITTED, APPROVED,
// CORRECTED, REJECTED) and child-entity events (MEDIA_UPLOADED,
// MEDIA_DELETED, VIDEO_EMBEDDED) whose meta.indicatorId references this id.
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ indicatorId: string }> },
) {
  const sessionOrResponse = await requireVerifierSession();
  if (!isVerifierSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { indicatorId } = await params;
  const id = Number(indicatorId);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid indicatorId' }, { status: 400 });
  }

  const owns = await verifierOwnsIndicator(id, session.secId);
  if (!owns) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Two unions:
    //   1. user_log rows where entity = 'indicators' AND entity_id = id
    //   2. user_log rows where meta->>'indicatorId' = id (media / video)
    const result = await db.execute(sql`
      SELECT
        ul.user_log_id,
        ul.user_id,
        ul.action,
        ul.entity,
        ul.entity_id,
        ul.outcome,
        ul.logged_on,
        ul.meta,
        ul.user_agent,
        ud.user_name
      FROM hdp.user_log ul
      LEFT JOIN hdp.user_details ud ON ul.user_id = ud.user_id
      WHERE
        (ul.entity = 'indicators' AND ul.entity_id = ${id})
        OR (ul.meta ->> 'indicatorId' = ${String(id)})
      ORDER BY ul.logged_on DESC, ul.user_log_id DESC
      LIMIT 200
    `);

    const events = (result.rows as Array<any>).map((r) => ({
      eventId: Number(r.user_log_id),
      userId: r.user_id != null ? Number(r.user_id) : null,
      userName: r.user_name ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entity_id != null ? Number(r.entity_id) : null,
      outcome: r.outcome,
      loggedOn: r.logged_on,
      meta: r.meta ?? null,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error('GET /api/verify/.../history failed', err);
    return NextResponse.json(
      { error: 'Failed to load history' },
      { status: 500 },
    );
  }
}

