-- Adds optional supporting implementing departments field on indicators.

BEGIN;

ALTER TABLE hdp.indicators
  ADD COLUMN IF NOT EXISTS supporting_dept_ids integer[] DEFAULT '{}'::integer[];

UPDATE hdp.indicators
SET supporting_dept_ids = '{}'::integer[]
WHERE supporting_dept_ids IS NULL;

ALTER TABLE hdp.indicators
  ALTER COLUMN supporting_dept_ids SET DEFAULT '{}'::integer[];

CREATE INDEX IF NOT EXISTS indicators_supporting_dept_ids_gin_idx
  ON hdp.indicators USING GIN (supporting_dept_ids);

COMMIT;
