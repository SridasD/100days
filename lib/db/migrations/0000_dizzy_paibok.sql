-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE SCHEMA "hdp";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."indicators" (
	"indicator_id" serial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"indicator_name" varchar(255),
	"district_id" integer DEFAULT 0,
	"local_body_type" integer DEFAULT 0,
	"local_body_id" integer[],
	"latitude" numeric(8, 6),
	"longitude" numeric(9, 6),
	"beneficiary" integer[] DEFAULT '{}',
	"no_days_employed_direct" integer DEFAULT 0,
	"no_persons_employed_direct" integer DEFAULT 0,
	"no_days_employed_indirect" integer DEFAULT 0,
	"no_persons_employed_indirect" integer DEFAULT 0,
	"achieved_no_days_employed_direct" integer DEFAULT 0,
	"achieved_no_persons_employed_direct" integer DEFAULT 0,
	"achieved_no_days_employed_indirect" integer DEFAULT 0,
	"achieved_no_persons_employed_indirect" integer DEFAULT 0,
	"unit" varchar(15),
	"financial_target" numeric(13, 5),
	"physical_target" numeric(10, 2),
	"financial_achievement" numeric(13, 5),
	"physical_achievement" integer,
	"physical_description" text,
	"percentage" numeric(5, 2),
	"submitted_by" bigint,
	"submitted_date" timestamp,
	"verified_achieved_no_days_employed_direct" integer DEFAULT 0,
	"verified_achieved_no_persons_employed_direct" integer DEFAULT 0,
	"verified_achieved_no_days_employed_indirect" integer DEFAULT 0,
	"verified_achieved_no_persons_employed_indirect" integer DEFAULT 0,
	"verified_financial_achievement" numeric(10, 2),
	"verified_physical_achievement" integer DEFAULT 0,
	"verified_physical_description" text,
	"verified_by" bigint,
	"verified_date" timestamp,
	"verified_percentage" numeric(5, 2) DEFAULT '0',
	"completed_date" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."documents" (
	"document_id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"indicator_id" integer NOT NULL,
	"description" varchar(255),
	"updated_on" timestamp DEFAULT CURRENT_DATE NOT NULL,
	"updated_by" bigint,
	"document_path" varchar(500),
	"is_verified" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."gallery" (
	"gallery_id" serial PRIMARY KEY NOT NULL,
	"indicator_id" integer NOT NULL,
	"description" varchar(255),
	"gallery_type" integer,
	"updated_on" timestamp DEFAULT CURRENT_DATE NOT NULL,
	"updated_by" bigint,
	"image_path" varchar(500),
	"is_verified" boolean DEFAULT false NOT NULL,
	"project_id" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."govt_employee_details" (
	"govt_employee_id" serial PRIMARY KEY NOT NULL,
	"sec_id" integer,
	"dept_psu_org_name" varchar(500),
	"job_type_id" integer,
	"job_type" varchar(100),
	"emp_name" varchar(255),
	"designation" varchar(255),
	"district_id" integer,
	"district_name" varchar(150),
	"village" varchar(200),
	"updated_on" timestamp DEFAULT CURRENT_DATE NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."govt_employee_details_2" (
	"govt_employee_id" serial PRIMARY KEY NOT NULL,
	"sec_id" integer,
	"dept_psu_org_name" varchar(500),
	"job_type_id" integer,
	"job_type" varchar(100),
	"emp_name" varchar(255),
	"designation" varchar(255),
	"district_id" integer,
	"district_name" varchar(150),
	"village" varchar(200),
	"updated_on" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_projects" (
	"project_id" serial PRIMARY KEY NOT NULL,
	"project_name" varchar(1500),
	"project_name_mal" varchar(1500),
	"is_new" boolean DEFAULT true,
	"project_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"no_days_employed_direct" integer DEFAULT 0,
	"no_persons_employed_direct" integer DEFAULT 0,
	"no_days_employed_indirect" integer DEFAULT 0,
	"no_persons_employed_indirect" integer DEFAULT 0,
	"other_benefits" text,
	"govt_policy_linkage" text,
	"manifesto_linkage" text,
	"sector_id" integer DEFAULT 0,
	"nature_of_project" integer DEFAULT 0,
	"priority" integer DEFAULT 0,
	"is_completed" integer DEFAULT 1,
	"completion_date" timestamp,
	"stage" integer DEFAULT 1 NOT NULL,
	"is_additionaly_added" boolean DEFAULT false,
	"extra_one" text,
	"extra_two" text,
	"extra_three" text,
	"inserted_by" integer NOT NULL,
	"inserted_on" timestamp DEFAULT CURRENT_DATE,
	"updated_by" integer NOT NULL,
	"updated_on" timestamp DEFAULT CURRENT_DATE,
	"raw_project_id" smallint,
	"project_execution_type" smallint DEFAULT 1 NOT NULL,
	"project_code" varchar(25)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."indicators_archive" (
	"archive_indicator_id" bigserial PRIMARY KEY NOT NULL,
	"indicator_id" integer,
	"project_id" integer,
	"indicator_name" varchar(255),
	"district_id" integer DEFAULT 0,
	"local_body_type" integer DEFAULT 0,
	"local_body_id" integer[],
	"latitude" numeric(8, 6),
	"longitude" numeric(9, 6),
	"beneficiary" integer[] DEFAULT '{}',
	"no_days_employed_direct" integer DEFAULT 0,
	"no_persons_employed_direct" integer DEFAULT 0,
	"no_days_employed_indirect" integer DEFAULT 0,
	"no_persons_employed_indirect" integer DEFAULT 0,
	"achieved_no_days_employed_direct" integer DEFAULT 0,
	"achieved_no_persons_employed_direct" integer DEFAULT 0,
	"achieved_no_days_employed_indirect" integer DEFAULT 0,
	"achieved_no_persons_employed_indirect" integer DEFAULT 0,
	"unit" varchar(15),
	"financial_target" numeric(13, 5),
	"physical_target" numeric(10, 2),
	"financial_achievement" numeric(13, 5),
	"physical_achievement" integer,
	"physical_description" text,
	"percentage" numeric(5, 2),
	"submitted_by" bigint,
	"submitted_date" timestamp,
	"verified_achieved_no_days_employed_direct" integer DEFAULT 0,
	"verified_achieved_no_persons_employed_direct" integer DEFAULT 0,
	"verified_achieved_no_days_employed_indirect" integer DEFAULT 0,
	"verified_achieved_no_persons_employed_indirect" integer DEFAULT 0,
	"verified_financial_achievement" numeric(10, 2),
	"verified_physical_achievement" integer DEFAULT 0,
	"verified_physical_description" text,
	"verified_by" bigint,
	"verified_date" timestamp,
	"verified_percentage" numeric(5, 2) DEFAULT '0',
	"completed_date" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_beneficiary" (
	"beneficiary_id" serial PRIMARY KEY NOT NULL,
	"beneficiary" varchar NOT NULL,
	"beneficiary_mal" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_district" (
	"district_id" serial PRIMARY KEY NOT NULL,
	"district_name" varchar(30),
	"district_name_mal" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_localbody" (
	"localbody_id" integer,
	"localbody_name_mal" varchar(255),
	"localbody_name" varchar(255),
	"localbody_type" varchar(50),
	"localbody_type_id" integer,
	"block_id" integer,
	"block_name" varchar(50),
	"district_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_localbody_type" (
	"localbody_type_id" serial NOT NULL,
	"localbody_type" varchar(50),
	"localbody_type_mal" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_projects_archive" (
	"archive_project_id" bigserial PRIMARY KEY NOT NULL,
	"project_id" integer,
	"project_name" varchar(1500),
	"project_name_mal" varchar(1500),
	"is_new" boolean DEFAULT true,
	"project_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"no_days_employed_direct" integer DEFAULT 0,
	"no_persons_employed_direct" integer DEFAULT 0,
	"no_days_employed_indirect" integer DEFAULT 0,
	"no_persons_employed_indirect" integer DEFAULT 0,
	"other_benefits" text,
	"govt_policy_linkage" text,
	"manifesto_linkage" text,
	"sector_id" integer DEFAULT 0,
	"nature_of_project" integer DEFAULT 0,
	"priority" integer DEFAULT 0,
	"is_completed" integer DEFAULT 1,
	"completion_date" timestamp,
	"stage" integer DEFAULT 1 NOT NULL,
	"is_additionaly_added" boolean DEFAULT false,
	"extra_one" text,
	"extra_two" text,
	"extra_three" text,
	"inserted_by" integer NOT NULL,
	"inserted_on" timestamp,
	"updated_by" integer NOT NULL,
	"updated_on" timestamp,
	"raw_project_id" smallint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_role" (
	"role_id" integer PRIMARY KEY NOT NULL,
	"role_description" varchar(150)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_secretary" (
	"sec_id" integer PRIMARY KEY NOT NULL,
	"secretary_name" varchar(255),
	"secretary_name_mal" varchar(255),
	"is_used" boolean DEFAULT true,
	"target_govt_employee" integer DEFAULT 0,
	"target_pvt_employee" integer DEFAULT 0,
	"target_sdt_employee" integer DEFAULT 0,
	"target_govt_employee_2" integer DEFAULT 0,
	"target_pvt_employee_2" integer DEFAULT 0,
	"target_sdt_employee_2" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."master_sector" (
	"sector_id" serial PRIMARY KEY NOT NULL,
	"sector" varchar(150) NOT NULL,
	"sector_mal" varchar(500)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."private_employee_details" (
	"pvt_employee_id" serial PRIMARY KEY NOT NULL,
	"sec_id" integer,
	"line_department" varchar(500),
	"pvt_sect_org_name" varchar(500),
	"district_id" integer,
	"district_name" varchar(150),
	"village" varchar(200),
	"no_of_jobs_created" integer,
	"updated_on" timestamp DEFAULT CURRENT_DATE NOT NULL,
	"employee_list" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."private_employee_details_2" (
	"pvt_employee_id" serial PRIMARY KEY NOT NULL,
	"sec_id" integer,
	"line_department" varchar(500),
	"pvt_sect_org_name" varchar(500),
	"district_id" integer,
	"district_name" varchar(150),
	"village" varchar(200),
	"no_of_jobs_created" integer,
	"updated_on" timestamp,
	"employee_list" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."project_secretary" (
	"project_sec_id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"sec_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."project_secretary_archive" (
	"archive_project_sec_id" bigserial PRIMARY KEY NOT NULL,
	"project_sec_id" integer,
	"project_id" integer NOT NULL,
	"sec_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."raw_master_projects" (
	"project_name" varchar(1500),
	"is_new" varchar,
	"description" text,
	"no_persons_employed_direct" varchar,
	"no_days_employed_direct" varchar,
	"no_persons_employed_indirect" varchar,
	"no_days_employed_indirect" varchar,
	"govt_policy_linkage" text,
	"priority" varchar,
	"nature_of_project" varchar,
	"project_cost" varchar,
	"admin_department" text,
	"manifesto_linkage" varchar(1500),
	"project_id" "smallserial" PRIMARY KEY NOT NULL,
	"admin_dept_id" smallint,
	"project_execution_type" varchar(1500),
	"sec" varchar(1500),
	"sec_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."skill_development_employee_details" (
	"sdt_employee_id" serial PRIMARY KEY NOT NULL,
	"sec_id" integer,
	"line_department" varchar(500),
	"sdt_sect_org_name" varchar(500),
	"district_id" integer,
	"district_name" varchar(150),
	"village" varchar(200),
	"no_of_jobs_created" integer,
	"updated_on" timestamp DEFAULT CURRENT_DATE NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."user_details" (
	"user_id" bigserial PRIMARY KEY NOT NULL,
	"user_name" varchar(250),
	"login_name" varchar(150),
	"password" varchar(25),
	"mobile_no" varchar(10),
	"role_id" integer,
	"status" integer,
	"registered_on" timestamp DEFAULT CURRENT_DATE NOT NULL,
	"registered_by" varchar(150),
	"sec_id" integer DEFAULT 0 NOT NULL,
	"designation" varchar(250)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hdp"."user_log" (
	"user_log_id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"user_ip" varchar(150),
	"logged_on" timestamp DEFAULT CURRENT_DATE NOT NULL,
	"browser_details" varchar(250),
	"sec_id" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_details_login_name_uindex" ON "hdp"."user_details" USING btree ("login_name" text_ops);--> statement-breakpoint
CREATE VIEW "hdp"."indicators_stages" AS (SELECT i.indicator_id, i.project_id, i.district_id, i.indicator_name, i.unit, i.physical_target, i.physical_achievement, i.physical_description, i.verified_physical_achievement, i.verified_physical_description, i.submitted_by, i.submitted_date, i.verified_by, i.verified_date, i.percentage, i.verified_percentage, i.completed_date, mp.stage FROM hdp.indicators i JOIN hdp.master_projects mp ON i.project_id = mp.project_id);--> statement-breakpoint
CREATE VIEW "hdp"."at_a_glance" AS (SELECT tnp.sec_id, tnp.secretary_name_mal, tnp.total_no_of_projects, tnp.project_cost, tni.financial_achievement, cp.completed_projects, tni.total_no_of_indicators, ci.total_no_of_indicators_fully_completed, img.total_images, video.total_video FROM ( SELECT ms.sec_id, ms.secretary_name_mal, count(mp.project_id) AS total_no_of_projects, sum(COALESCE(mp.project_cost, 0::numeric)) AS project_cost FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) tnp JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(mp.project_id) AS completed_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 AND mp.is_completed = 2 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) cp ON tnp.sec_id = cp.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(mp.project_id) AS inprogress_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 AND mp.is_completed = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) ip ON tnp.sec_id = ip.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(i.indicator_id) AS total_no_of_indicators, sum(COALESCE(i.financial_achievement, 0::numeric)) AS financial_achievement FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) tni ON tnp.sec_id = tni.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(i.indicator_id) AS total_no_of_indicators_fully_completed FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id AND i.verified_percentage = 100::numeric WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) ci ON tnp.sec_id = ci.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(g.gallery_id) AS total_images FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id LEFT JOIN hdp.gallery g ON i.indicator_id = g.indicator_id AND g.gallery_type = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) img ON tnp.sec_id = img.sec_id JOIN ( SELECT ms.sec_id, ms.secretary_name_mal, count(g.gallery_id) AS total_video FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.stage = 1 LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id LEFT JOIN hdp.gallery g ON i.indicator_id = g.indicator_id AND g.gallery_type = 2 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name_mal) video ON tnp.sec_id = video.sec_id WHERE tnp.total_no_of_projects <> 0 ORDER BY tnp.total_no_of_projects DESC);--> statement-breakpoint
CREATE VIEW "hdp"."project_perc" AS (WITH prj_ind AS ( SELECT mp.project_id, count(i.indicator_id) AS indicator_defined FROM hdp.master_projects mp LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id GROUP BY mp.project_id ORDER BY mp.project_id ), pic AS ( SELECT count(indicators.indicator_id) AS indicators_completed_100_perc, indicators.project_id FROM hdp.indicators WHERE indicators.verified_percentage = 100::numeric GROUP BY indicators.project_id ORDER BY indicators.project_id ) SELECT prj_ind.project_id, prj_ind.indicator_defined, COALESCE(pic.indicators_completed_100_perc, 0::bigint) AS indicators_completed_100_percentage, COALESCE(round((pic.indicators_completed_100_perc::double precision / prj_ind.indicator_defined::double precision * 100::double precision)::numeric, 2), 0::numeric) AS perc FROM prj_ind LEFT JOIN pic ON prj_ind.project_id = pic.project_id);--> statement-breakpoint
CREATE VIEW "hdp"."projects_without_indicators" AS (SELECT mp.project_id, count(i.indicator_id) AS indicator_defined FROM hdp.master_projects mp JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id GROUP BY mp.project_id HAVING count(i.indicator_id) = 0);--> statement-breakpoint
CREATE VIEW "hdp"."project_perc_based_on_status" AS (WITH tnp AS ( SELECT ms.sec_id, ms.secretary_name, count(mp.project_id) AS total_no_of_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ), cp AS ( SELECT ms.sec_id, ms.secretary_name, count(mp.project_id) AS completed_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.is_completed = 2 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ), ip AS ( SELECT ms.sec_id, ms.secretary_name, count(mp.project_id) AS inprogress_projects FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id AND mp.is_completed = 1 WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ), tni AS ( SELECT ms.sec_id, ms.secretary_name, count(i.indicator_id) AS total_no_of_indicators FROM hdp.master_secretary ms LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id LEFT JOIN hdp.master_projects mp ON ps.project_id = mp.project_id LEFT JOIN hdp.indicators i ON mp.project_id = i.project_id WHERE ms.is_used = true GROUP BY ms.sec_id ORDER BY ms.secretary_name ) SELECT tnp.sec_id, tnp.secretary_name AS "Administrative Department", tnp.total_no_of_projects AS "Total number of projects", cp.completed_projects AS "Completed Projects", tni.total_no_of_indicators AS "Total number of indicators" FROM tnp JOIN cp ON tnp.sec_id = cp.sec_id JOIN ip ON tnp.sec_id = ip.sec_id JOIN tni ON tnp.sec_id = tni.sec_id WHERE tnp.total_no_of_projects > 0 ORDER BY tnp.secretary_name);
*/