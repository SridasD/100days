-- Phase 1: Introduce public_id columns for canonical routing
-- Safe to run multiple times (idempotent).
-- UUID generator
CREATE EXTENSION IF NOT EXISTS pgcrypto;
BEGIN;
-- ---------------------------------------------------------------------------
-- Core entities that exist in this codebase
-- ---------------------------------------------------------------------------
ALTER TABLE hdp.master_projects
ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE hdp.master_projects
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;
ALTER TABLE hdp.master_projects
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_projects_public_id ON hdp.master_projects(public_id);
ALTER TABLE hdp.master_projects
ALTER COLUMN public_id
SET NOT NULL;
ALTER TABLE hdp.indicators
ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE hdp.indicators
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;
ALTER TABLE hdp.indicators
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_indicators_public_id ON hdp.indicators(public_id);
ALTER TABLE hdp.indicators
ALTER COLUMN public_id
SET NOT NULL;
ALTER TABLE hdp.user_details
ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE hdp.user_details
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;
ALTER TABLE hdp.user_details
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_details_public_id ON hdp.user_details(public_id);
ALTER TABLE hdp.user_details
ALTER COLUMN public_id
SET NOT NULL;
ALTER TABLE hdp.master_secretary
ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE hdp.master_secretary
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;
ALTER TABLE hdp.master_secretary
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_secretary_public_id ON hdp.master_secretary(public_id);
ALTER TABLE hdp.master_secretary
ALTER COLUMN public_id
SET NOT NULL;
ALTER TABLE hdp.master_sector
ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE hdp.master_sector
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;
ALTER TABLE hdp.master_sector
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_sector_public_id ON hdp.master_sector(public_id);
ALTER TABLE hdp.master_sector
ALTER COLUMN public_id
SET NOT NULL;
ALTER TABLE hdp.master_district
ADD COLUMN IF NOT EXISTS public_id uuid;
UPDATE hdp.master_district
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;
ALTER TABLE hdp.master_district
ALTER COLUMN public_id
SET DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS uq_master_district_public_id ON hdp.master_district(public_id);
ALTER TABLE hdp.master_district
ALTER COLUMN public_id
SET NOT NULL;
-- ---------------------------------------------------------------------------
-- Optional entity: master_department may exist in deployed DB even if not
-- present in baseline migration file. Guard it.
-- ---------------------------------------------------------------------------
DO $$ BEGIN IF to_regclass('hdp.master_department') IS NOT NULL THEN EXECUTE 'ALTER TABLE hdp.master_department ADD COLUMN IF NOT EXISTS public_id uuid';
EXECUTE 'UPDATE hdp.master_department SET public_id = gen_random_uuid() WHERE public_id IS NULL';
EXECUTE 'ALTER TABLE hdp.master_department ALTER COLUMN public_id SET DEFAULT gen_random_uuid()';
EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_master_department_public_id ON hdp.master_department(public_id)';
EXECUTE 'ALTER TABLE hdp.master_department ALTER COLUMN public_id SET NOT NULL';
END IF;
END $$;
COMMIT;
-- ---------------------------------------------------------------------------
-- Verification queries
-- ---------------------------------------------------------------------------
-- SELECT COUNT(*) AS null_public_ids_projects FROM hdp.master_projects WHERE public_id IS NULL;
-- SELECT COUNT(*) AS null_public_ids_indicators FROM hdp.indicators WHERE public_id IS NULL;
-- SELECT COUNT(*) AS null_public_ids_users FROM hdp.user_details WHERE public_id IS NULL;
-- SELECT public_id, project_id, project_code FROM hdp.master_projects ORDER BY project_id LIMIT 10;