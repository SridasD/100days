import { NextRequest, NextResponse } from 'next/server';
import {
  isAdminSession,
  requireAdminSession,
} from '@/lib/auth/admin-session';
import { getAdminMasterData } from '@/lib/db/queries/admin';

export const runtime = 'nodejs';

// Drop-down lookups for admin forms (secretaries, sectors, roles, districts).
export async function GET(_req: NextRequest) {
  const sessionOrResponse = await requireAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const data = await getAdminMasterData();
    return NextResponse.json({
      secretaries: data.secretaries,
      departments: data.departments,
      sectors: data.sectors,
      roles: data.roles,
      districts: data.districts,
    });
  } catch (err) {
    console.error('GET /api/admin/master failed', err);
    return NextResponse.json(
      { error: 'Failed to load master data' },
      { status: 500 },
    );
  }
}
