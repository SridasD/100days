import { NextResponse } from "next/server";
import {
  getPublicDashboardStats,
  getPublicDistrictProgress,
  getPublicProgressTimeline,
  getTopProjects,
} from "@/lib/db/queries/public";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [stats, districts, timeline, topProjects] = await Promise.all([
      getPublicDashboardStats(),
      getPublicDistrictProgress(),
      getPublicProgressTimeline(),
      getTopProjects(10),
    ]);

    return NextResponse.json({
      stats,
      districts,
      timeline,
      topProjects,
    });
  } catch (err) {
    console.error("GET /api/public/dashboard failed", err);
    return NextResponse.json(
      { error: "Failed to load dashboard data" },
      { status: 500 },
    );
  }
}
