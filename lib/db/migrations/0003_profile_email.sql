-- Adds an optional email address column used by the shared profile page.

BEGIN;

ALTER TABLE hdp.user_details
  ADD COLUMN IF NOT EXISTS email_address varchar(254);

COMMIT;