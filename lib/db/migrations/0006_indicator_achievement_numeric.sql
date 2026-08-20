-- Widen physical_achievement / verified_physical_achievement from integer to
-- numeric(10,2) so achievement values can match decimal physical_target
-- values (e.g. 40.47), instead of Postgres rejecting the write.
--
-- hdp.indicators_stages is a view that reads these columns directly, and
-- Postgres refuses ALTER COLUMN TYPE while a view depends on the column, so
-- the view must be dropped and recreated around the ALTER. Confirmed via
-- pg_depend that no other object depends on hdp.indicators_stages, and that
-- hdp.indicators_archive has no view dependents on these columns.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'hdp' AND table_name = 'indicators'
      AND column_name = 'physical_achievement' AND data_type = 'integer'
  ) THEN
    DROP VIEW IF EXISTS "hdp"."indicators_stages";

    ALTER TABLE "hdp"."indicators" ALTER COLUMN "physical_achievement" TYPE numeric(10,2);
    ALTER TABLE "hdp"."indicators" ALTER COLUMN "verified_physical_achievement" TYPE numeric(10,2);

    CREATE VIEW "hdp"."indicators_stages" AS
    SELECT i.indicator_id,
      i.project_id,
      i.district_id,
      i.indicator_name,
      i.unit,
      i.physical_target,
      i.physical_achievement,
      i.physical_description,
      i.verified_physical_achievement,
      i.verified_physical_description,
      i.submitted_by,
      i.submitted_date,
      i.verified_by,
      i.verified_date,
      i.percentage,
      i.verified_percentage,
      i.completed_date,
      mp.stage
     FROM hdp.indicators i
       JOIN hdp.master_projects mp ON i.project_id = mp.project_id;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'hdp' AND table_name = 'indicators_archive'
      AND column_name = 'physical_achievement' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "hdp"."indicators_archive" ALTER COLUMN "physical_achievement" TYPE numeric(10,2);
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'hdp' AND table_name = 'indicators_archive'
      AND column_name = 'verified_physical_achievement' AND data_type = 'integer'
  ) THEN
    ALTER TABLE "hdp"."indicators_archive" ALTER COLUMN "verified_physical_achievement" TYPE numeric(10,2);
  END IF;
END $$;
