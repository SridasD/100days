import { sql } from "drizzle-orm";
import { db } from "../client";

// ---------------------------------------------------------------------------
// Admin-scoped queries (role_id = 3).
// Admins see all users, projects, and can manage both.
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  user_id: number;
  user_name: string | null;
  login_name: string | null;
  mobile_no: string | null;
  role_id: number | null;
  status: number | null;
  sec_id: number | null;
  secretary_name: string | null;
  designation: string | null;
  last_login: string | null;
  registered_on: string | null;
}

/**
 * List all users for admin user management page
 */
export async function listAllUsers(): Promise<AdminUserRow[]> {
  const result = await db.execute(sql`
    SELECT
      ud.user_id,
      ud.user_name,
      ud.login_name,
      ud.mobile_no,
      ud.role_id,
      ud.status,
      ud.sec_id,
      ms.secretary_name,
      ud.designation,
      ud.last_login,
      ud.registered_on
    FROM hdp.user_details ud
    LEFT JOIN hdp.master_secretary ms ON ud.sec_id = ms.sec_id
    ORDER BY ud.user_name ASC
  `);
  return result.rows as unknown as AdminUserRow[];
}

/**
 * Get a single user for editing
 */
export async function getUser(userId: number) {
  const result = await db.execute(sql`
    SELECT
      ud.user_id,
      ud.user_name,
      ud.login_name,
      ud.mobile_no,
      ud.role_id,
      ud.status,
      ud.sec_id,
      ud.designation,
      ud.registered_on,
      ud.last_login
    FROM hdp.user_details ud
    WHERE ud.user_id = ${userId}
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

export interface AdminProjectRow {
  project_id: number;
  project_code: string | null;
  project_name: string | null;
  project_name_mal: string | null;
  description: string | null;
  project_cost: string | null;
  sector_id: number | null;
  is_completed: number | null;
  stage: number | null;
  /** Kept for back-compat with the response mapper; first dept's id. */
  sec_id: number | null;
  /** Kept for back-compat; comma-joined list of all dept names. */
  secretary_name: string | null;
  secretary_count: number;
  indicators_count: number;
}

/**
 * List all projects for admin project management.
 * One row per project — secretaries are aggregated into a single column so
 * multi-department projects don't duplicate React keys in the listing.
 */
export async function listAllProjects(): Promise<AdminProjectRow[]> {
  const result = await db.execute(sql`
    SELECT
      mp.project_id,
      mp.project_code,
      mp.project_name,
      mp.project_name_mal,
      mp.description,
      mp.project_cost,
      mp.sector_id,
      mp.is_completed,
      mp.stage,
      (
        SELECT MIN(ps.sec_id)
        FROM hdp.project_secretary ps
        WHERE ps.project_id = mp.project_id
      ) AS sec_id,
      (
        SELECT STRING_AGG(ms.secretary_name, ', ' ORDER BY ms.secretary_name)
        FROM hdp.project_secretary ps
        LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
        WHERE ps.project_id = mp.project_id
      ) AS secretary_name,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.project_secretary ps
        WHERE ps.project_id = mp.project_id
      ), 0) AS secretary_count,
      COALESCE((
        SELECT COUNT(*)::int FROM hdp.indicators i
        WHERE i.project_id = mp.project_id
      ), 0) AS indicators_count
    FROM hdp.master_projects mp
    WHERE COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    ORDER BY mp.project_name ASC
  `);
  return result.rows as unknown as AdminProjectRow[];
}

/**
 * Get a single project for editing
 */
export async function getProject(projectId: number) {
  const result = await db.execute(sql`
    SELECT
      mp.project_id,
      mp.project_code,
      mp.project_name,
      mp.project_name_mal,
      mp.description,
      mp.project_cost,
      mp.sector_id,
      mp.nature_of_project,
      mp.priority,
      mp.is_completed,
      mp.stage,
      mp.completion_date,
      mp.no_days_employed_direct,
      mp.no_persons_employed_direct,
      mp.no_days_employed_indirect,
      mp.no_persons_employed_indirect,
      ps.sec_id,
      ms.secretary_name
    FROM hdp.master_projects mp
    LEFT JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    LEFT JOIN hdp.master_secretary ms ON ps.sec_id = ms.sec_id
    WHERE mp.project_id = ${projectId}
      AND COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
    LIMIT 1
  `);
  return result.rows[0] ?? null;
}

/**
 * Get all master data (secretaries, sectors, roles, districts) for dropdowns
 */
export async function getAdminMasterData() {
  const [secretariesResult, sectorsResult, rolesResult, districtsResult] =
    await Promise.all([
      db.execute(sql`
      SELECT sec_id, secretary_name FROM hdp.master_secretary
      WHERE is_used = true
      ORDER BY secretary_name ASC
    `),
      db.execute(sql`
      SELECT sector_id, sector_name FROM hdp.master_sector
      ORDER BY sector_name ASC
    `),
      db.execute(sql`
      SELECT role_id, role_description FROM hdp.master_role
      ORDER BY role_id ASC
    `),
      db.execute(sql`
      SELECT district_id, district_name FROM hdp.master_district
      ORDER BY district_name ASC
    `),
    ]);

  return {
    secretaries: secretariesResult.rows as Array<{
      sec_id: number;
      secretary_name: string | null;
    }>,
    sectors: sectorsResult.rows as Array<{
      sector_id: number;
      sector_name: string | null;
    }>,
    roles: rolesResult.rows as Array<{
      role_id: number;
      role_description: string | null;
    }>,
    districts: districtsResult.rows as Array<{
      district_id: number;
      district_name: string | null;
    }>,
  };
}
