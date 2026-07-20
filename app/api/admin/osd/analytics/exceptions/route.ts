import { NextRequest, NextResponse } from "next/server";
import {
  isAdminSession,
  requireOsdAdminSession,
} from "@/lib/auth/admin-session";
import { getOsdExceptionMonitorData } from "@/lib/db/queries/osd-exceptions";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const sessionOrResponse = await requireOsdAdminSession();
  if (!isAdminSession(sessionOrResponse)) return sessionOrResponse;

  try {
    const data = await getOsdExceptionMonitorData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("GET /api/admin/osd/analytics/exceptions failed", err);
    return NextResponse.json(
      { error: "Failed to load OSD exception monitor" },
      { status: 500 },
    );
  }
}
