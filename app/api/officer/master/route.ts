import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { isSession, requireOfficerSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';

// Lookup data needed by officer-side forms (Add Indicator etc).
// Officer-only auth; no admin-scoped data exposed.
export async function GET(_req: NextRequest) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const [districtsResult, beneficiariesResult, lbTypesResult, lbsResult] =
      await Promise.all([
        db.execute(sql`
          SELECT district_id, district_name FROM hdp.master_district
          ORDER BY district_name ASC
        `),
        db.execute(sql`
          SELECT beneficiary_id, beneficiary_name FROM hdp.master_beneficiary
          ORDER BY beneficiary_name ASC
        `),
        // IDs 1 and 2 are legacy sentinel rows ("All" etc) — never offered to
        // the officer; only the real types (Grama Panchayat / Corporation /
        // Municipality / Block Panchayat / District Panchayat) are returned.
        db.execute(sql`
          SELECT localbody_type_id, localbody_type_name
          FROM hdp.master_localbody_type
          WHERE localbody_type_id NOT IN (1, 2)
          ORDER BY localbody_type_name ASC
        `),
        db.execute(sql`
          SELECT localbody_id, localbody_name, localbody_type_id, district_id
          FROM hdp.master_localbody
          ORDER BY localbody_name ASC
        `),
      ]);

    return NextResponse.json({
      districts: districtsResult.rows as Array<{
        district_id: number;
        district_name: string | null;
      }>,
      beneficiaries: beneficiariesResult.rows as Array<{
        beneficiary_id: number;
        beneficiary_name: string | null;
      }>,
      localBodyTypes: lbTypesResult.rows as Array<{
        localbody_type_id: number;
        localbody_type_name: string | null;
      }>,
      localBodies: lbsResult.rows as Array<{
        localbody_id: number;
        localbody_name: string | null;
        localbody_type_id: number | null;
        district_id: number | null;
      }>,
    });
  } catch (err) {
    console.error('GET /api/officer/master failed', err);
    return NextResponse.json(
      { error: 'Failed to load master data' },
      { status: 500 },
    );
  }
}
