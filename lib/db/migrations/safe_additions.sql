-- Safe migration: add new tables and columns to hdp_v2 (no drops, no data loss)
-- Generated 2026-06-22

-- 1. New tables

CREATE TABLE IF NOT EXISTS "hdp"."password_reset_tokens" (
  "token_id"   bigserial PRIMARY KEY NOT NULL,
  "user_id"    bigint NOT NULL,
  "token"      varchar(100) NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at"    timestamp,
  "reset_by"   bigint,
  "ip_address" varchar(150)
);

CREATE TABLE IF NOT EXISTS "hdp"."session_blocklist" (
  "jti"        varchar(100) PRIMARY KEY NOT NULL,
  "user_id"    bigint NOT NULL,
  "blocked_at" timestamp DEFAULT now(),
  "reason"     varchar(50)
);

-- 2. New columns on existing tables

ALTER TABLE "hdp"."documents"
  ADD COLUMN IF NOT EXISTS "uploaded_by" bigint,
  ADD COLUMN IF NOT EXISTS "uploaded_on" timestamp DEFAULT now();

ALTER TABLE "hdp"."gallery"
  ADD COLUMN IF NOT EXISTS "uploaded_by" bigint,
  ADD COLUMN IF NOT EXISTS "uploaded_on" timestamp DEFAULT now();

ALTER TABLE "hdp"."master_beneficiary"
  ADD COLUMN IF NOT EXISTS "beneficiary_name" varchar(250);

ALTER TABLE "hdp"."master_localbody_type"
  ADD COLUMN IF NOT EXISTS "localbody_type_name" varchar(150);

ALTER TABLE "hdp"."master_sector"
  ADD COLUMN IF NOT EXISTS "sector_name" varchar(250);

ALTER TABLE "hdp"."project_secretary"
  ADD COLUMN IF NOT EXISTS "id" bigint;

ALTER TABLE "hdp"."user_details"
  ADD COLUMN IF NOT EXISTS "password_reset_token"   varchar(100),
  ADD COLUMN IF NOT EXISTS "password_reset_expires" timestamp,
  ADD COLUMN IF NOT EXISTS "last_login"             timestamp,
  ADD COLUMN IF NOT EXISTS "failed_login_attempts"  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until"           timestamp;
