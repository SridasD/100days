-- Canonicalize user lockout expiry to a timezone-aware instant.
-- Existing rows in locked_until were written from JS Date values into a
-- timestamp-without-time-zone column, so the stored wall-clock value represents
-- a UTC instant and must be reinterpreted as UTC during conversion.
DO $$ BEGIN IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'hdp'
        AND table_name = 'user_details'
        AND column_name = 'locked_until'
        AND data_type = 'timestamp without time zone'
) THEN
ALTER TABLE "hdp"."user_details"
ALTER COLUMN "locked_until" TYPE timestamptz USING "locked_until" AT TIME ZONE 'UTC';
END IF;
END $$;