-- Enterprise archive workflow for master projects
-- Adds archive metadata columns and immutable archive repository snapshots.
ALTER TABLE hdp.master_projects
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived_at timestamp,
    ADD COLUMN IF NOT EXISTS archived_by bigint,
    ADD COLUMN IF NOT EXISTS archive_reason text,
    ADD COLUMN IF NOT EXISTS archive_session_id varchar(150),
    ADD COLUMN IF NOT EXISTS archived_from_ip varchar(150);
CREATE INDEX IF NOT EXISTS idx_master_projects_is_archived ON hdp.master_projects (is_archived);
CREATE INDEX IF NOT EXISTS idx_master_projects_archived_at ON hdp.master_projects (archived_at DESC);
CREATE TABLE IF NOT EXISTS hdp.project_archive_repository (
    archive_id bigserial PRIMARY KEY,
    project_id bigint NOT NULL,
    project_code varchar(50),
    project_name text,
    archived_at timestamp NOT NULL DEFAULT now(),
    archived_by bigint,
    archived_by_role integer,
    department_snapshot text,
    sector_snapshot text,
    district_snapshot text,
    project_status integer,
    archive_reason text,
    archive_payload jsonb NOT NULL,
    impact_payload jsonb,
    request_ip varchar(150),
    session_identifier varchar(150),
    restored_at timestamp,
    restored_by bigint,
    restored_by_role integer,
    is_restored boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_archive_repository_project_active ON hdp.project_archive_repository (project_id)
WHERE is_restored = false;
CREATE INDEX IF NOT EXISTS idx_project_archive_repository_archived_at ON hdp.project_archive_repository (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_archive_repository_archived_by ON hdp.project_archive_repository (archived_by);