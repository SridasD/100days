import { NextRequest, NextResponse } from "next/server";
import { isSession, requireOfficerSession } from "@/lib/auth/session";
import { getOfficerProject } from "@/lib/db/queries/officer";
import { resolveProjectId } from "@/lib/db/public-id";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const sessionOrResponse = await requireOfficerSession();
  if (!isSession(sessionOrResponse)) return sessionOrResponse;
  const session = sessionOrResponse;

  const { projectId } = await params;
  const id = await resolveProjectId(projectId);
  if (!id) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
  }

  try {
    const row = await getOfficerProject(id, {
      roleId: session.roleId,
      secId: session.secId,
      deptId: session.deptId,
    });
    if (!row) {
      return NextResponse.json(
        { error: "Project not found or not assigned to your department" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      project: {
        projectId: row.project_id,
        projectCode: row.project_code,
        projectName: row.project_name,
        projectNameMal: row.project_name_mal,
        description: row.description,
        projectCost: row.project_cost ? Number(row.project_cost) : 0,
        isCompleted: row.is_completed ?? 0,
        natureOfProject: row.nature_of_project,
        priority: row.priority,
        projectExecutionType: row.project_execution_type,
        completionDate: row.completion_date,
        department: row.department,
        noDaysEmployedDirect: row.no_days_employed_direct ?? 0,
        noPersonsEmployedDirect: row.no_persons_employed_direct ?? 0,
        noDaysEmployedIndirect: row.no_days_employed_indirect ?? 0,
        noPersonsEmployedIndirect: row.no_persons_employed_indirect ?? 0,
        indicatorsTotal: row.indicators_total,
        indicatorsCompleted: row.indicators_completed,
        // Budget — used by the Add Indicator form
        totalAllocated: row.total_allocated ? Number(row.total_allocated) : 0,
        balance:
          (row.project_cost ? Number(row.project_cost) : 0) -
          (row.total_allocated ? Number(row.total_allocated) : 0),
      },
    });
  } catch (err) {
    console.error("GET /api/officer/projects/[projectId] failed", err);
    return NextResponse.json(
      { error: "Failed to load project" },
      { status: 500 },
    );
  }
}
