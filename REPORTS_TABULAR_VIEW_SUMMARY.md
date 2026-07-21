# Project Progress & Performance Review - Tabular View (Technical Summary)

This document captures the technical implementation used to generate the tabular report for Project Progress & Performance Review.

## 1. Primary implementation files

- [components/reports/ReportTabularPage.tsx](components/reports/ReportTabularPage.tsx)
- [app/(admin)/admin/reports/[reportId]/tabular/page.tsx](app/(admin)/admin/reports/[reportId]/tabular/page.tsx)
- [app/(admin)/admin/osd/reports/[reportId]/tabular/page.tsx](app/(admin)/admin/osd/reports/[reportId]/tabular/page.tsx)
- [app/(admin)/admin/reports/page.tsx](app/(admin)/admin/reports/page.tsx)
- [lib/config/defaulter-thresholds.ts](lib/config/defaulter-thresholds.ts)

## 2. Report routes and access paths

- Admin tabular route: /admin/reports/lagging-analysis/tabular
- OSD tabular route: /admin/osd/reports/lagging-analysis/tabular
- Existing hierarchy route (for comparison): /admin/reports/lagging-analysis/view and /admin/osd/reports/lagging-analysis/view
- Reports hub card provides:
  - View (hierarchy)
  - Tabular View
  - Download (Excel)

## 3. Data retrieval strategy

Data is loaded server-side inside loadTabularRows() in [components/reports/ReportTabularPage.tsx](components/reports/ReportTabularPage.tsx) using Drizzle SQL execution:

- db.execute(sql`...`)
- PostgreSQL schema used: hdp

### 3.1 Query pipeline (CTEs)

1. secretary_projects
- Joins master_projects with project_secretary and master_secretary
- Excludes archived projects via:
  - COALESCE((to_jsonb(mp)->>'is_archived')::boolean, false) = false
- Provides:
  - administrative_department (secretary_name fallback Unassigned)
  - project_id, project_code, project_name

2. dept_hods
- Reads active HOD users from user_details
- Conditions:
  - role_id = 6
  - status = 1
- Aggregates HOD names using STRING_AGG ordered by user_name

3. dept_map
- Connects projects to implementing departments via project_department and master_department
- Joins HOD aggregates
- Provides one flattened department-project mapping set for downstream indicator join

### 3.2 Final select and derived fields

Final query left-joins indicators so projects without indicators still appear.

Key output columns:
- indicator_id
- administrative_department
- department_name (implementing agency)
- hod_names
- project_code, project_name
- indicator_name with fallback rules
- physical_progress
- financial_progress
- submitted_date, verified_date
- last_progress_update = COALESCE(verified_date, submitted_date)
- is_stale (boolean)
- has_no_progress (boolean)
- image_count, video_count, document_count

Indicator name fallback logic:
- If indicator_id is null: No indicator mapped
- If indicator_name empty/null: Untitled indicator
- Else: indicator_name

Progress field precedence:
- Physical: COALESCE(verified_percentage, percentage, 0)
- Financial: COALESCE(verified_financial_achievement, financial_achievement, 0)

Media count sources:
- Images/videos: hdp.gallery
  - is_verified = true
  - gallery_type = 1 for images
  - gallery_type = 2 for videos
- Documents: hdp.documents by indicator_id

## 4. Threshold and lagging configuration

Threshold source: getDefaulterThresholds() in [lib/config/defaulter-thresholds.ts](lib/config/defaulter-thresholds.ts)

Priority order:
1. Feature-specific env vars
2. DEFAULTER_THRESHOLD_DAYS
3. Default 15 days

Env vars used:
- SECRETARY_PENDING_DAYS
- SECRETARY_INACTIVITY_DAYS
- SECRETARY_INDICATOR_STALE_DAYS
- DEFAULTER_THRESHOLD_DAYS

Current tabular lagging logic uses indicatorStaleDays:
- is_stale = true when:
  - no indicator row exists, or
  - no submitted/verified update exists, or
  - last update older than now - indicatorStaleDays
- has_no_progress = true when indicator exists but no submitted/verified update

## 5. In-memory transformation logic

### 5.1 Type normalization

Row values are normalized to a strongly shaped TabularRow object:
- toNumber() for numeric fields
- toDate() for timestamp fields

### 5.2 Hierarchy building

buildDepartments() groups rows into:
- DepartmentGroup[]
  - ProjectGroup[]
    - indicators: TabularRow[]

Project key format:
- department_name|project_code|project_name

### 5.3 Summary aggregation

aggregate(rows) computes:
- totalIndicators (only rows with indicator_id)
- lagging (is_stale or has_no_progress)
- pending (submitted_date exists and verified_date missing)
- image/video/document totals
- average physical and financial progress

Average formulas:
- physical = roundOne(sum(physical_progress of indicator rows) / totalIndicators)
- financial = roundOne(sum(financial_progress of indicator rows) / totalIndicators)

## 6. Status rendering logic shown to users

verificationStatus(row):
- Verified when verified_date exists
- Pending Verification when submitted_date exists and verified_date missing
- No Update otherwise

indicatorStatus(row):
- Lagging when is_stale or has_no_progress
- On Track otherwise

## 7. UI rendering structure

Report page component: ReportTabularPage (server component)

Top sections:
- Header with report title and navigation
- KPI strip (departments, projects, indicators, lagging rows)
- Inline aggregate strip (physical, financial, media totals)

Drill-down layout:
1. Department-level details blocks
2. Expandable project-level details blocks
3. Indicator-level rows per project

Responsive behavior:
- Desktop uses multi-column grid layouts for project and indicator headers
- Indicator section uses horizontal scroll container with min width for dense columns

Malayalam text handling:
- containsMalayalam() checks Unicode Malayalam range
- Applies lang="ml" and font-malayalam class for better readability

## 8. Export integration

Download action points to existing report export endpoint:
- /api/admin/reports/{reportId}?format=xlsx

Reports hub behavior in [app/(admin)/admin/reports/page.tsx](app/(admin)/admin/reports/page.tsx):
- For lagging-analysis card:
  - View opens hierarchy route
  - Tabular View opens tabular route
  - Download fetches XLSX from admin report API

## 9. Reliability and fixes applied

Hydration fix applied:
- Removed invalid HTML pattern where details existed inside tbody
- Reworked nested project rendering into valid block/grid structure

Validation used:
- npm run typecheck
- TypeScript noEmit check passed after tabular changes

## 10. What this report currently provides

- Administrative department level risk and progress snapshot
- Project-level expansion with implementing agency and HOD context
- Indicator-level operational evidence with progress, verification, and media
- Immediate drill-down from summary to exceptions without leaving page
