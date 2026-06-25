# HDP Enterprise Project Archive Workflow

Project: Kerala CMO HDP Platform  
Audience: OSD Admin, Admin, PMIS Governance Team

## 1. UX Analysis of Archive Workflow

- The prior delete model carried governance risk because operational users could remove master entities from active context.
- Government PMIS systems require traceability, reversibility, and explicit user intent confirmation.
- Archive is the correct semantic model for project lifecycle closure, de-duplication, or administrative withdrawal.
- Primary UX goals:
  - Prevent accidental destruction.
  - Show impact before action.
  - Require explicit confirmation.
  - Preserve data for audit/reporting.
  - Offer controlled restore path.

## 2. Confirmation Dialog Design

Title: Archive Project

Dialog content blocks:

- Project identity block:
  - Project Name
  - Project Code
  - Department
  - Sector
  - District
  - Project Status
  - Created Date
  - Last Updated
- Impact summary block:
  - Total Indicators
  - Verified Indicators
  - Pending Verification
  - Images Uploaded
  - Documents Uploaded
  - Videos Uploaded
  - Total Progress Updates
- Warning banner:
  - Explains preservation and active-list removal behavior.
- Mandatory confirmation:
  - User must type Project Code exactly.
- Optional reason input:
  - Governance-grade archive rationale.

Buttons:

- Secondary: Cancel
- Primary: Archive Project (warning color, not destructive red)

## 3. Wireframes

### Desktop

1. Projects list table row action -> Archive button
2. Modal width ~ 3xl
3. Top: Title + description
4. Mid 1: Project snapshot card (2-column metadata)
5. Mid 2: Impact summary card (3-column metrics)
6. Mid 3: Warning banner
7. Mid 4: confirmation code input + reason
8. Footer: Cancel + Archive Project

### Mobile

1. Full-width modal sheet style
2. Metadata stack (single column)
3. Impact summary cards stacked
4. Warning banner full-width
5. Confirmation input and reason input stacked
6. Footer buttons full width (Cancel then Archive)

## 4. Information Architecture

### Active Module

- /admin/projects
  - List active projects only
  - Add/Edit project
  - Archive action

### Archive Module

- /admin/projects/archive
  - Search and multi-filter archive list
  - Restore action (authorized)
  - Export action
  - View details

- /admin/projects/archive/[projectId]
  - Full archive snapshot + impact view

## 5. Database Design Recommendation

Chosen architecture: Hybrid soft-archive + immutable snapshot repository.

Implemented:

- hdp.master_projects:
  - is_archived boolean
  - archived_at timestamp
  - archived_by bigint
  - archive_reason text
  - archive_session_id varchar(150)
  - archived_from_ip varchar(150)
- hdp.project_archive_repository:
  - Immutable archive snapshot + impact payload JSONB
  - archived metadata and restore metadata
  - Unique active archive constraint per project

Reason:

- Keeps referential integrity for indicators/media/documents without physically moving rows.
- Prevents wide FK rewrite risk in production.
- Still provides repository-grade archive records for governance.

## 6. Archive Strategy Comparison

### A. Separate archive tables for each entity

Pros:

- Hard separation between active and archived data.
- Potentially cleaner retention boundaries.

Cons:

- High migration complexity.
- FK and transactional move orchestration across many tables.
- Greater operational risk and longer outage window.

### B. Soft archive flag only

Pros:

- Minimal schema and app changes.
- Fast rollout.

Cons:

- Weaker historical snapshots unless separately stored.
- Less explicit governance repository model.

### C. Hybrid (implemented)

Pros:

- Safe rollout with low FK risk.
- Explicit immutable archive repository records.
- Easy restore.
- Strong audit evidence.

Cons:

- Requires strict query discipline to exclude archived from active analytics.

## 7. Transaction Workflow

Archive (single DB transaction):

1. Validate admin session and role.
2. Lock project row (FOR UPDATE).
3. Validate project not already archived.
4. Validate typed project code confirmation.
5. Compute impact summary.
6. Insert immutable archive snapshot record.
7. Update master project archive metadata and active state.
8. Insert audit row.
9. Commit.

Failure path:

- Any error causes full rollback.

## 8. Audit Trail Design

Captured fields:

- project_id, project_code, project_name
- archived_by (user_id)
- archived_by_role
- archived_at
- department snapshot
- optional archive_reason
- request IP
- session_identifier

Audit stores:

- hdp.user_log action: PROJECT_ARCHIVED / PROJECT_RESTORED
- hdp.project_archive_repository immutable archive snapshot

## 9. Role-Based Permissions

- Archive allowed: role_id 3 (Admin), role_id 4 (OSD Admin)
- Restore allowed: role_id 3 (Admin only)
- Access guard: requireAdminSession()

## 10. Next.js + React + Tailwind + Shadcn Implementation Plan

Implemented components and routes:

- Projects page archive dialog workflow:
  - app/(admin)/admin/projects/page.tsx
- Archive preview/archive APIs:
  - app/api/admin/projects/[id]/archive/route.ts
- Archive module list/details pages:
  - app/(admin)/admin/projects/archive/page.tsx
  - app/(admin)/admin/projects/archive/[projectId]/page.tsx
- Archive module APIs:
  - app/api/admin/projects/archive/route.ts
  - app/api/admin/projects/archive/[projectId]/route.ts
  - app/api/admin/projects/archive/[projectId]/restore/route.ts
  - app/api/admin/projects/archive/[projectId]/export/route.ts

## 11. API Changes

New APIs:

- GET /api/admin/projects/[id]/archive
- POST /api/admin/projects/[id]/archive
- GET /api/admin/projects/archive
- GET /api/admin/projects/archive/[projectId]
- POST /api/admin/projects/archive/[projectId]/restore
- GET /api/admin/projects/archive/[projectId]/export

Changed APIs:

- DELETE /api/admin/projects/[id]
  - Disabled for permanent deletion
  - Returns guidance to archive endpoint

## 12. Database Migration Strategy

Migration file:

- lib/db/migrations/0001_project_archive_workflow.sql

Rollout steps:

1. Apply migration in staging.
2. Validate archive + restore APIs.
3. Validate active dashboards/reports exclude archived projects.
4. Backfill optional historical archive records if needed.
5. Promote to production in controlled window.

## 13. Restore Workflow

1. Authorized Admin selects Restore from archive module.
2. System validates role and archive state.
3. Transaction:

- Set master project is_archived=false and clear archive metadata.
- Mark latest archive record restored.
- Write audit entry PROJECT_RESTORED.

4. Project returns to active lists/dashboards.

## 14. Production-Ready UI Specification

Functional UX checklist:

- Professional confirmation dialog with project + impact summary.
- Warning-themed Archive CTA (not destructive red).
- Mandatory typed project code confirmation.
- Optional reason capture.
- Loading states for preview and submit.
- Success notification with actions:
  - View Archived Projects
  - Return to Project List
- Failure notification in banner.
- Duplicate-submit prevention during archive action.
- Keyboard focus and dialog semantics via shadcn/radix.
- Responsive card/table layouts.

WCAG 2.1 AA notes:

- Sufficient contrast used for warning banner and text.
- Focus ring and keyboard navigability preserved with existing component primitives.
- Clear label text and action intent for all controls.
