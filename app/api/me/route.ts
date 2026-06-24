import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/lib/db/client';

// Returns the live profile of the currently signed-in user. The OfficerUserMenu
// calls this on mount so that the displayed name + designation are always
// up to date — independent of what was baked into the JWT at login. Useful
// when an admin edits a user's designation, or when the JWT predates a
// schema change (e.g. before we started storing designation in the token).
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessionUser = session.user as {
    id?: string;
    loginName?: string;
    roleId?: number;
    secId?: number;
  };
  const userId = Number(sessionUser.id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: 'Bad session' }, { status: 400 });
  }

  try {
    const r = await db.execute(sql`
      SELECT
        u.user_id,
        u.user_name,
        u.login_name,
        u.designation,
        u.mobile_no,
        u.role_id,
        u.sec_id,
        u.status,
        u.last_login,
        s.secretary_name
      FROM hdp.user_details u
      LEFT JOIN hdp.master_secretary s ON u.sec_id = s.sec_id
      WHERE u.user_id = ${userId}
      LIMIT 1
    `);
    const row = r.rows[0] as
      | {
          user_id: number;
          user_name: string | null;
          login_name: string | null;
          designation: string | null;
          mobile_no: string | null;
          role_id: number | null;
          sec_id: number | null;
          status: number | null;
          last_login: string | null;
          secretary_name: string | null;
        }
      | undefined;
    if (!row) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      userId: Number(row.user_id),
      userName: row.user_name ?? row.login_name ?? '',
      loginName: row.login_name ?? '',
      designation: row.designation ?? null,
      mobile: row.mobile_no ?? null,
      roleId: row.role_id ?? 0,
      secId: row.sec_id ?? 0,
      departmentLabel: row.secretary_name ?? null,
      status: row.status ?? 0,
      lastLogin: row.last_login,
    });
  } catch (err) {
    console.error('GET /api/me failed', err);
    return NextResponse.json(
      { error: 'Failed to load profile' },
      { status: 500 },
    );
  }
}
