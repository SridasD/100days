import {
  bigint,
  integer,
  varchar,
  timestamp,
  boolean,
  numeric,
  text,
} from "drizzle-orm/pg-core";
import { hdp } from "./user";

export const masterSecretary = hdp.table("master_secretary", {
  secId: integer("sec_id").primaryKey().notNull(),
  secretaryName: varchar("secretary_name", { length: 250 }),
  secretaryNameMal: varchar("secretary_name_mal", { length: 250 }),
  isUsed: boolean("is_used").default(true),
});

export const masterDistrict = hdp.table("master_district", {
  districtId: integer("district_id").primaryKey().notNull(),
  districtName: varchar("district_name", { length: 150 }),
  districtNameMal: varchar("district_name_mal", { length: 150 }),
});

export const masterLocalbodyType = hdp.table("master_localbody_type", {
  localbodyTypeId: integer("localbody_type_id").primaryKey().notNull(),
  localbodyTypeName: varchar("localbody_type_name", { length: 150 }),
});

export const masterLocalbody = hdp.table("master_localbody", {
  localbodyId: integer("localbody_id").primaryKey().notNull(),
  localbodyName: varchar("localbody_name", { length: 250 }),
  localbodyTypeId: integer("localbody_type_id"),
  districtId: integer("district_id"),
});

export const masterSector = hdp.table("master_sector", {
  sectorId: integer("sector_id").primaryKey().notNull(),
  sectorName: varchar("sector_name", { length: 250 }),
});

export const masterBeneficiary = hdp.table("master_beneficiary", {
  beneficiaryId: integer("beneficiary_id").primaryKey().notNull(),
  beneficiaryName: varchar("beneficiary_name", { length: 250 }),
});

// hdp.master_projects
export const masterProjects = hdp.table("master_projects", {
  projectId: bigint("project_id", { mode: "number" }).primaryKey().notNull(),
  projectCode: varchar("project_code", { length: 50 }),
  projectName: text("project_name"),
  projectNameMal: text("project_name_mal"),
  description: text("description"),
  projectCost: numeric("project_cost", { precision: 14, scale: 2 }),
  sectorId: integer("sector_id"),
  natureOfProject: integer("nature_of_project"), // 1=Livelihood, 2=Infrastructure
  priority: integer("priority"), // 1=State, 2=District, 3=Sub-district
  projectExecutionType: integer("project_execution_type"),
  isNew: boolean("is_new"),
  isCompleted: integer("is_completed"), // 0=Not started, 1=In Progress, 2=Completed
  stage: integer("stage"),
  completionDate: timestamp("completion_date"),
  noDaysEmployedDirect: integer("no_days_employed_direct"),
  noPersonsEmployedDirect: integer("no_persons_employed_direct"),
  noDaysEmployedIndirect: integer("no_days_employed_indirect"),
  noPersonsEmployedIndirect: integer("no_persons_employed_indirect"),
  otherBenefits: text("other_benefits"),
  govtPolicyLinkage: text("govt_policy_linkage"),
  manifestoLinkage: text("manifesto_linkage"),
  extraOne: text("extra_one"),
  extraTwo: text("extra_two"),
  extraThree: text("extra_three"),
  insertedBy: bigint("inserted_by", { mode: "number" }),
  updatedBy: bigint("updated_by", { mode: "number" }),
  isArchived: boolean("is_archived").default(false),
  archivedAt: timestamp("archived_at"),
  archivedBy: bigint("archived_by", { mode: "number" }),
  archiveReason: text("archive_reason"),
  archiveSessionId: varchar("archive_session_id", { length: 150 }),
  archivedFromIp: varchar("archived_from_ip", { length: 150 }),
});

export const projectSecretary = hdp.table("project_secretary", {
  id: bigint("id", { mode: "number" }).primaryKey().notNull(),
  projectId: bigint("project_id", { mode: "number" }),
  secId: integer("sec_id"),
});

export type MasterProject = typeof masterProjects.$inferSelect;
export type MasterSecretary = typeof masterSecretary.$inferSelect;
