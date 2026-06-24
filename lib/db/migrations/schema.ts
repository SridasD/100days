import { pgTable, pgSchema, serial, integer, varchar, numeric, text, bigint, timestamp, boolean, smallint, bigserial, smallserial, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const hdp = pgSchema("hdp");


export const indicatorsInHdp = hdp.table("indicators", {
	indicatorId: serial("indicator_id").primaryKey().notNull(),
	projectId: integer("project_id"),
	indicatorName: varchar("indicator_name", { length: 255 }),
	districtId: integer("district_id").default(0),
	localBodyType: integer("local_body_type").default(0),
	localBodyId: integer("local_body_id").array(),
	latitude: numeric({ precision: 8, scale:  6 }),
	longitude: numeric({ precision: 9, scale:  6 }),
	beneficiary: integer().array().default([]),
	noDaysEmployedDirect: integer("no_days_employed_direct").default(0),
	noPersonsEmployedDirect: integer("no_persons_employed_direct").default(0),
	noDaysEmployedIndirect: integer("no_days_employed_indirect").default(0),
	noPersonsEmployedIndirect: integer("no_persons_employed_indirect").default(0),
	achievedNoDaysEmployedDirect: integer("achieved_no_days_employed_direct").default(0),
	achievedNoPersonsEmployedDirect: integer("achieved_no_persons_employed_direct").default(0),
	achievedNoDaysEmployedIndirect: integer("achieved_no_days_employed_indirect").default(0),
	achievedNoPersonsEmployedIndirect: integer("achieved_no_persons_employed_indirect").default(0),
	unit: varchar({ length: 15 }),
	financialTarget: numeric("financial_target", { precision: 13, scale:  5 }),
	physicalTarget: numeric("physical_target", { precision: 10, scale:  2 }),
	financialAchievement: numeric("financial_achievement", { precision: 13, scale:  5 }),
	physicalAchievement: integer("physical_achievement"),
	physicalDescription: text("physical_description"),
	percentage: numeric({ precision: 5, scale:  2 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submittedBy: bigint("submitted_by", { mode: "number" }),
	submittedDate: timestamp("submitted_date", { mode: 'string' }),
	verifiedAchievedNoDaysEmployedDirect: integer("verified_achieved_no_days_employed_direct").default(0),
	verifiedAchievedNoPersonsEmployedDirect: integer("verified_achieved_no_persons_employed_direct").default(0),
	verifiedAchievedNoDaysEmployedIndirect: integer("verified_achieved_no_days_employed_indirect").default(0),
	verifiedAchievedNoPersonsEmployedIndirect: integer("verified_achieved_no_persons_employed_indirect").default(0),
	verifiedFinancialAchievement: numeric("verified_financial_achievement", { precision: 10, scale:  2 }),
	verifiedPhysicalAchievement: integer("verified_physical_achievement").default(0),
	verifiedPhysicalDescription: text("verified_physical_description"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	verifiedBy: bigint("verified_by", { mode: "number" }),
	verifiedDate: timestamp("verified_date", { mode: 'string' }),
	verifiedPercentage: numeric("verified_percentage", { precision: 5, scale:  2 }).default('0'),
	completedDate: timestamp("completed_date", { mode: 'string' }),
});

export const documentsInHdp = hdp.table("documents", {
	documentId: serial("document_id").primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	indicatorId: integer("indicator_id").notNull(),
	description: varchar({ length: 255 }),
	updatedOn: timestamp("updated_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedBy: bigint("updated_by", { mode: "number" }),
	documentPath: varchar("document_path", { length: 500 }),
	isVerified: boolean("is_verified").default(false).notNull(),
});

export const galleryInHdp = hdp.table("gallery", {
	galleryId: serial("gallery_id").primaryKey().notNull(),
	indicatorId: integer("indicator_id").notNull(),
	description: varchar({ length: 255 }),
	galleryType: integer("gallery_type"),
	updatedOn: timestamp("updated_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	updatedBy: bigint("updated_by", { mode: "number" }),
	imagePath: varchar("image_path", { length: 500 }),
	isVerified: boolean("is_verified").default(false).notNull(),
	projectId: integer("project_id").default(0),
});

export const govtEmployeeDetailsInHdp = hdp.table("govt_employee_details", {
	govtEmployeeId: serial("govt_employee_id").primaryKey().notNull(),
	secId: integer("sec_id"),
	deptPsuOrgName: varchar("dept_psu_org_name", { length: 500 }),
	jobTypeId: integer("job_type_id"),
	jobType: varchar("job_type", { length: 100 }),
	empName: varchar("emp_name", { length: 255 }),
	designation: varchar({ length: 255 }),
	districtId: integer("district_id"),
	districtName: varchar("district_name", { length: 150 }),
	village: varchar({ length: 200 }),
	updatedOn: timestamp("updated_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
});

export const govtEmployeeDetails2InHdp = hdp.table("govt_employee_details_2", {
	govtEmployeeId: serial("govt_employee_id").primaryKey().notNull(),
	secId: integer("sec_id"),
	deptPsuOrgName: varchar("dept_psu_org_name", { length: 500 }),
	jobTypeId: integer("job_type_id"),
	jobType: varchar("job_type", { length: 100 }),
	empName: varchar("emp_name", { length: 255 }),
	designation: varchar({ length: 255 }),
	districtId: integer("district_id"),
	districtName: varchar("district_name", { length: 150 }),
	village: varchar({ length: 200 }),
	updatedOn: timestamp("updated_on", { mode: 'string' }),
});

export const masterProjectsInHdp = hdp.table("master_projects", {
	projectId: serial("project_id").primaryKey().notNull(),
	projectName: varchar("project_name", { length: 1500 }),
	projectNameMal: varchar("project_name_mal", { length: 1500 }),
	isNew: boolean("is_new").default(true),
	projectCost: numeric("project_cost", { precision: 12, scale:  2 }).default('0').notNull(),
	description: text(),
	noDaysEmployedDirect: integer("no_days_employed_direct").default(0),
	noPersonsEmployedDirect: integer("no_persons_employed_direct").default(0),
	noDaysEmployedIndirect: integer("no_days_employed_indirect").default(0),
	noPersonsEmployedIndirect: integer("no_persons_employed_indirect").default(0),
	otherBenefits: text("other_benefits"),
	govtPolicyLinkage: text("govt_policy_linkage"),
	manifestoLinkage: text("manifesto_linkage"),
	sectorId: integer("sector_id").default(0),
	natureOfProject: integer("nature_of_project").default(0),
	priority: integer().default(0),
	isCompleted: integer("is_completed").default(1),
	completionDate: timestamp("completion_date", { mode: 'string' }),
	stage: integer().default(1).notNull(),
	isAdditionalyAdded: boolean("is_additionaly_added").default(false),
	extraOne: text("extra_one"),
	extraTwo: text("extra_two"),
	extraThree: text("extra_three"),
	insertedBy: integer("inserted_by").notNull(),
	insertedOn: timestamp("inserted_on", { mode: 'string' }).default(sql`CURRENT_DATE`),
	updatedBy: integer("updated_by").notNull(),
	updatedOn: timestamp("updated_on", { mode: 'string' }).default(sql`CURRENT_DATE`),
	rawProjectId: smallint("raw_project_id"),
	projectExecutionType: smallint("project_execution_type").default(1).notNull(),
	projectCode: varchar("project_code", { length: 25 }),
});

export const indicatorsArchiveInHdp = hdp.table("indicators_archive", {
	archiveIndicatorId: bigserial("archive_indicator_id", { mode: "bigint" }).primaryKey().notNull(),
	indicatorId: integer("indicator_id"),
	projectId: integer("project_id"),
	indicatorName: varchar("indicator_name", { length: 255 }),
	districtId: integer("district_id").default(0),
	localBodyType: integer("local_body_type").default(0),
	localBodyId: integer("local_body_id").array(),
	latitude: numeric({ precision: 8, scale:  6 }),
	longitude: numeric({ precision: 9, scale:  6 }),
	beneficiary: integer().array().default([]),
	noDaysEmployedDirect: integer("no_days_employed_direct").default(0),
	noPersonsEmployedDirect: integer("no_persons_employed_direct").default(0),
	noDaysEmployedIndirect: integer("no_days_employed_indirect").default(0),
	noPersonsEmployedIndirect: integer("no_persons_employed_indirect").default(0),
	achievedNoDaysEmployedDirect: integer("achieved_no_days_employed_direct").default(0),
	achievedNoPersonsEmployedDirect: integer("achieved_no_persons_employed_direct").default(0),
	achievedNoDaysEmployedIndirect: integer("achieved_no_days_employed_indirect").default(0),
	achievedNoPersonsEmployedIndirect: integer("achieved_no_persons_employed_indirect").default(0),
	unit: varchar({ length: 15 }),
	financialTarget: numeric("financial_target", { precision: 13, scale:  5 }),
	physicalTarget: numeric("physical_target", { precision: 10, scale:  2 }),
	financialAchievement: numeric("financial_achievement", { precision: 13, scale:  5 }),
	physicalAchievement: integer("physical_achievement"),
	physicalDescription: text("physical_description"),
	percentage: numeric({ precision: 5, scale:  2 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submittedBy: bigint("submitted_by", { mode: "number" }),
	submittedDate: timestamp("submitted_date", { mode: 'string' }),
	verifiedAchievedNoDaysEmployedDirect: integer("verified_achieved_no_days_employed_direct").default(0),
	verifiedAchievedNoPersonsEmployedDirect: integer("verified_achieved_no_persons_employed_direct").default(0),
	verifiedAchievedNoDaysEmployedIndirect: integer("verified_achieved_no_days_employed_indirect").default(0),
	verifiedAchievedNoPersonsEmployedIndirect: integer("verified_achieved_no_persons_employed_indirect").default(0),
	verifiedFinancialAchievement: numeric("verified_financial_achievement", { precision: 10, scale:  2 }),
	verifiedPhysicalAchievement: integer("verified_physical_achievement").default(0),
	verifiedPhysicalDescription: text("verified_physical_description"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	verifiedBy: bigint("verified_by", { mode: "number" }),
	verifiedDate: timestamp("verified_date", { mode: 'string' }),
	verifiedPercentage: numeric("verified_percentage", { precision: 5, scale:  2 }).default('0'),
	completedDate: timestamp("completed_date", { mode: 'string' }),
});

export const masterBeneficiaryInHdp = hdp.table("master_beneficiary", {
	beneficiaryId: serial("beneficiary_id").primaryKey().notNull(),
	beneficiary: varchar().notNull(),
	beneficiaryMal: varchar("beneficiary_mal"),
});

export const masterDistrictInHdp = hdp.table("master_district", {
	districtId: serial("district_id").primaryKey().notNull(),
	districtName: varchar("district_name", { length: 30 }),
	districtNameMal: varchar("district_name_mal", { length: 255 }),
});

export const masterLocalbodyInHdp = hdp.table("master_localbody", {
	localbodyId: integer("localbody_id"),
	localbodyNameMal: varchar("localbody_name_mal", { length: 255 }),
	localbodyName: varchar("localbody_name", { length: 255 }),
	localbodyType: varchar("localbody_type", { length: 50 }),
	localbodyTypeId: integer("localbody_type_id"),
	blockId: integer("block_id"),
	blockName: varchar("block_name", { length: 50 }),
	districtId: integer("district_id"),
});

export const masterLocalbodyTypeInHdp = hdp.table("master_localbody_type", {
	localbodyTypeId: serial("localbody_type_id").notNull(),
	localbodyType: varchar("localbody_type", { length: 50 }),
	localbodyTypeMal: varchar("localbody_type_mal", { length: 255 }),
});

export const masterProjectsArchiveInHdp = hdp.table("master_projects_archive", {
	archiveProjectId: bigserial("archive_project_id", { mode: "bigint" }).primaryKey().notNull(),
	projectId: integer("project_id"),
	projectName: varchar("project_name", { length: 1500 }),
	projectNameMal: varchar("project_name_mal", { length: 1500 }),
	isNew: boolean("is_new").default(true),
	projectCost: numeric("project_cost", { precision: 12, scale:  2 }).default('0').notNull(),
	description: text(),
	noDaysEmployedDirect: integer("no_days_employed_direct").default(0),
	noPersonsEmployedDirect: integer("no_persons_employed_direct").default(0),
	noDaysEmployedIndirect: integer("no_days_employed_indirect").default(0),
	noPersonsEmployedIndirect: integer("no_persons_employed_indirect").default(0),
	otherBenefits: text("other_benefits"),
	govtPolicyLinkage: text("govt_policy_linkage"),
	manifestoLinkage: text("manifesto_linkage"),
	sectorId: integer("sector_id").default(0),
	natureOfProject: integer("nature_of_project").default(0),
	priority: integer().default(0),
	isCompleted: integer("is_completed").default(1),
	completionDate: timestamp("completion_date", { mode: 'string' }),
	stage: integer().default(1).notNull(),
	isAdditionalyAdded: boolean("is_additionaly_added").default(false),
	extraOne: text("extra_one"),
	extraTwo: text("extra_two"),
	extraThree: text("extra_three"),
	insertedBy: integer("inserted_by").notNull(),
	insertedOn: timestamp("inserted_on", { mode: 'string' }),
	updatedBy: integer("updated_by").notNull(),
	updatedOn: timestamp("updated_on", { mode: 'string' }),
	rawProjectId: smallint("raw_project_id"),
});

export const masterRoleInHdp = hdp.table("master_role", {
	roleId: integer("role_id").primaryKey().notNull(),
	roleDescription: varchar("role_description", { length: 150 }),
});

export const masterSecretaryInHdp = hdp.table("master_secretary", {
	secId: integer("sec_id").primaryKey().notNull(),
	secretaryName: varchar("secretary_name", { length: 255 }),
	secretaryNameMal: varchar("secretary_name_mal", { length: 255 }),
	isUsed: boolean("is_used").default(true),
	targetGovtEmployee: integer("target_govt_employee").default(0),
	targetPvtEmployee: integer("target_pvt_employee").default(0),
	targetSdtEmployee: integer("target_sdt_employee").default(0),
	targetGovtEmployee2: integer("target_govt_employee_2").default(0),
	targetPvtEmployee2: integer("target_pvt_employee_2").default(0),
	targetSdtEmployee2: integer("target_sdt_employee_2").default(0),
});

export const masterSectorInHdp = hdp.table("master_sector", {
	sectorId: serial("sector_id").primaryKey().notNull(),
	sector: varchar({ length: 150 }).notNull(),
	sectorMal: varchar("sector_mal", { length: 500 }),
});

export const privateEmployeeDetailsInHdp = hdp.table("private_employee_details", {
	pvtEmployeeId: serial("pvt_employee_id").primaryKey().notNull(),
	secId: integer("sec_id"),
	lineDepartment: varchar("line_department", { length: 500 }),
	pvtSectOrgName: varchar("pvt_sect_org_name", { length: 500 }),
	districtId: integer("district_id"),
	districtName: varchar("district_name", { length: 150 }),
	village: varchar({ length: 200 }),
	noOfJobsCreated: integer("no_of_jobs_created"),
	updatedOn: timestamp("updated_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
	employeeList: text("employee_list"),
});

export const privateEmployeeDetails2InHdp = hdp.table("private_employee_details_2", {
	pvtEmployeeId: serial("pvt_employee_id").primaryKey().notNull(),
	secId: integer("sec_id"),
	lineDepartment: varchar("line_department", { length: 500 }),
	pvtSectOrgName: varchar("pvt_sect_org_name", { length: 500 }),
	districtId: integer("district_id"),
	districtName: varchar("district_name", { length: 150 }),
	village: varchar({ length: 200 }),
	noOfJobsCreated: integer("no_of_jobs_created"),
	updatedOn: timestamp("updated_on", { mode: 'string' }),
	employeeList: text("employee_list"),
});

export const projectSecretaryInHdp = hdp.table("project_secretary", {
	projectSecId: serial("project_sec_id").primaryKey().notNull(),
	projectId: integer("project_id").notNull(),
	secId: integer("sec_id").notNull(),
});

export const projectSecretaryArchiveInHdp = hdp.table("project_secretary_archive", {
	archiveProjectSecId: bigserial("archive_project_sec_id", { mode: "bigint" }).primaryKey().notNull(),
	projectSecId: integer("project_sec_id"),
	projectId: integer("project_id").notNull(),
	secId: integer("sec_id").notNull(),
});

export const rawMasterProjectsInHdp = hdp.table("raw_master_projects", {
	projectName: varchar("project_name", { length: 1500 }),
	isNew: varchar("is_new"),
	description: text(),
	noPersonsEmployedDirect: varchar("no_persons_employed_direct"),
	noDaysEmployedDirect: varchar("no_days_employed_direct"),
	noPersonsEmployedIndirect: varchar("no_persons_employed_indirect"),
	noDaysEmployedIndirect: varchar("no_days_employed_indirect"),
	govtPolicyLinkage: text("govt_policy_linkage"),
	priority: varchar(),
	natureOfProject: varchar("nature_of_project"),
	projectCost: varchar("project_cost"),
	adminDepartment: text("admin_department"),
	manifestoLinkage: varchar("manifesto_linkage", { length: 1500 }),
	projectId: smallserial("project_id").primaryKey().notNull(),
	adminDeptId: smallint("admin_dept_id"),
	projectExecutionType: varchar("project_execution_type", { length: 1500 }),
	sec: varchar({ length: 1500 }),
	secId: integer("sec_id"),
});

export const skillDevelopmentEmployeeDetailsInHdp = hdp.table("skill_development_employee_details", {
	sdtEmployeeId: serial("sdt_employee_id").primaryKey().notNull(),
	secId: integer("sec_id"),
	lineDepartment: varchar("line_department", { length: 500 }),
	sdtSectOrgName: varchar("sdt_sect_org_name", { length: 500 }),
	districtId: integer("district_id"),
	districtName: varchar("district_name", { length: 150 }),
	village: varchar({ length: 200 }),
	noOfJobsCreated: integer("no_of_jobs_created"),
	updatedOn: timestamp("updated_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
});

export const userDetailsInHdp = hdp.table("user_details", {
	userId: bigserial("user_id", { mode: "bigint" }).primaryKey().notNull(),
	userName: varchar("user_name", { length: 250 }),
	loginName: varchar("login_name", { length: 150 }),
	password: varchar({ length: 25 }),
	mobileNo: varchar("mobile_no", { length: 10 }),
	roleId: integer("role_id"),
	status: integer(),
	registeredOn: timestamp("registered_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
	registeredBy: varchar("registered_by", { length: 150 }),
	secId: integer("sec_id").default(0).notNull(),
	designation: varchar({ length: 250 }),
}, (table) => {
	return {
		loginNameUindex: uniqueIndex("user_details_login_name_uindex").using("btree", table.loginName.asc().nullsLast().op("text_ops")),
	}
});

export const userLogInHdp = hdp.table("user_log", {
	userLogId: bigserial("user_log_id", { mode: "bigint" }).primaryKey().notNull(),
	userId: integer("user_id"),
	userIp: varchar("user_ip", { length: 150 }),
	loggedOn: timestamp("logged_on", { mode: 'string' }).default(sql`CURRENT_DATE`).notNull(),
	browserDetails: varchar("browser_details", { length: 250 }),
	secId: integer("sec_id"),
});
export const indicatorsStagesInHdp = hdp.view("indicators_stages", {	indicatorId: integer("indicator_id"),
	projectId: integer("project_id"),
	districtId: integer("district_id"),
	indicatorName: varchar("indicator_name", { length: 255 }),
	unit: varchar({ length: 15 }),
	physicalTarget: numeric("physical_target", { precision: 10, scale:  2 }),
	physicalAchievement: integer("physical_achievement"),
	physicalDescription: text("physical_description"),
	verifiedPhysicalAchievement: integer("verified_physical_achievement"),
	verifiedPhysicalDescription: text("verified_physical_description"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	submittedBy: bigint("submitted_by", { mode: "number" }),
	submittedDate: timestamp("submitted_date", { mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	verifiedBy: bigint("verified_by", { mode: "number" }),
	verifiedDate: timestamp("verified_date", { mode: 'string' }),
	percentage: numeric({ precision: 5, scale:  2 }),
	verifiedPercentage: numeric("verified_percentage", { precision: 5, scale:  2 }),
	completedDate: timestamp("completed_date", { mode: 'string' }),
	stage: integer(),
}).as(sql`SELECT i.indicator_id, i.project_id, i.district_id, i.indicator_name, i.unit, i.physical_target, i.physical_achievement, i.physical_description, i.verified_physical_achievement, i.verified_physical_description, i.submitted_by, i.submitted_date, i.verified_by, i.verified_date, i.percentage, i.verified_percentage, i.completed_date, mp.stage FROM hdp.indicators i JOIN hdp.master_projects mp ON i.project_id = mp.project_id`);

export const atAGlanceInHdp = hdp.view("at_a_glance", {	secId: integer("sec_id"),
	secretaryNameMal: varchar("secretary_name_mal", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalNoOfProjects: bigint("total_no_of_projects", { mode: "number" }),
	projectCost: numeric("project_cost"),
	financialAchievement: numeric("financial_achievement"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completedProjects: bigint("completed_projects", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalNoOfIndicators: bigint("total_no_of_indicators", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalNoOfIndicatorsFullyCompleted: bigint("total_no_of_indicators_fully_completed", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalImages: bigint("total_images", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalVideo: bigint("total_video", { mode: "number" }),
}).as(sql`SELECT tnp.sec_id, tnp.secretary_name_mal, tnp.total_no_of_projects, tnp.project_cost, tni.financial_achievement, cp.completed_projects, tni.total_no_of_indicators, ci.total_no_of_indicators_fully_completed, img.total_images, video.total_video FROM ( SELECT ms.sec_id, ms.secretary_name_mal, count(mp.project_id) AS total_no_of_projects, sum(COALESCE(mp.project_cost, 0::numeric)) AS project_cost FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) tnp JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(mp.project_id) AS completed_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 AND mp.is_completed = 2 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) cp ON tnp.sec_id = cp.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(mp.project_id) AS inprogress_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 AND mp.is_completed = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) ip ON tnp.sec_id = ip.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(i.indicator_id) AS total_no_of_indicators, sum(COALESCE(i.financial_achievement, 0::numeric)) AS financial_achievement FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) tni ON tnp.sec_id = tni.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(i.indicator_id) AS total_no_of_indicators_fully_completed FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id AND i.verified_percentage = 100::numeric WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) ci ON tnp.sec_id = ci.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(g.gallery_id) AS total_images FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id LEFT JOIN hdp.gallery g ON i.indicator_id = g.indicator_id AND g.gallery_type = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) img ON tnp.sec_id = img.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(g.gallery_id) AS total_video FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id LEFT JOIN hdp.gallery g ON i.indicator_id = g.indicator_id AND g.gallery_type = 2 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) video ON tnp.sec_id = video.sec_id WHERE tnp.total_no_of_projects <> 0 ORDER BY tnp.total_no_of_projects DESC`);

export const projectPercInHdp = hdp.view("project_perc", {	projectId: integer("project_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	indicatorDefined: bigint("indicator_defined", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	indicatorsCompleted100Percentage: bigint("indicators_completed_100_percentage", { mode: "number" }),
	perc: numeric(),
}).as(sql`WITH prj_ind AS ( SELECT mp.project_id, count(i.indicator_id) AS indicator_defined FROM hdp.master_projects mp LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id GROUP BY mp.project_id ORDER BY mp.project_id ), pic AS ( SELECT count(indicators.indicator_id) AS indicators_completed_100_perc, indicators.project_id FROM hdp.indicators WHERE indicators.verified_percentage = 100::numeric GROUP BY indicators.project_id ORDER BY indicators.project_id ) SELECT prj_ind.project_id, prj_ind.indicator_defined, COALESCE(pic.indicators_completed_100_perc, 0::bigint) AS indicators_completed_100_percentage, COALESCE(round((pic.indicators_completed_100_perc::double precision / prj_ind.indicator_defined::double precision * 100::double precision)::numeric, 2), 0::numeric) AS perc FROM prj_ind LEFT JOIN pic ON prj_ind.project_id = pic.project_id`);

export const projectsWithoutIndicatorsInHdp = hdp.view("projects_without_indicators", {	projectId: integer("project_id"),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	indicatorDefined: bigint("indicator_defined", { mode: "number" }),
}).as(sql`SELECT mp.project_id, count(i.indicator_id) AS indicator_defined FROM hdp.master_projects mp JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id GROUP BY mp.project_id HAVING count(i.indicator_id) = 0`);

export const projectPercBasedOnStatusInHdp = hdp.view("project_perc_based_on_status", {	secId: integer("sec_id"),
	administrativeDepartment: varchar("Administrative Department", { length: 255 }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalNumberOfProjects: bigint("Total number of projects", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	completedProjects: bigint("Completed Projects", { mode: "number" }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalNumberOfIndicators: bigint("Total number of indicators", { mode: "number" }),
}).as(sql`WITH tnp AS ( SELECT ms.sec_id, ms.secretary_name, count(mp.project_id) AS total_no_of_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ), cp AS ( SELECT ms.sec_id, ms.secretary_name, count(mp.project_id) AS completed_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.is_completed = 2 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ), ip AS ( SELECT ms.sec_id, ms.secretary_name, count(mp.project_id) AS inprogress_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.is_completed = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ), tni AS ( SELECT ms.sec_id, ms.secretary_name, count(i.indicator_id) AS total_no_of_indicators FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ) SELECT tnp.sec_id, tnp.secretary_name AS "Administrative Department", tnp.total_no_of_projects AS "Total number of projects", cp.completed_projects AS "Completed Projects", tni.total_no_of_indicators AS "Total number of indicators" FROM tnp JOIN cp ON tnp.sec_id = cp.sec_id JOIN ip ON tnp.sec_id = ip.sec_id JOIN tni ON tnp.sec_id = tni.sec_id WHERE tnp.total_no_of_projects > 0 ORDER BY tnp.secretary_name`);