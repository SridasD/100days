# HDP Platform - OSD Administrator Dashboard Design

## Important Clarification

Do not create a new role.

Create a dedicated user:

- Username: `osd.admin`
- Role: Administrator (`role_id = 4`)
- Access model: customized permissions

---

## User Visibility Rules

The Administrator must **not** see Tech Administrator entities anywhere.

Completely hide:

- Tech Administrator users
- Tech Administrator counts
- Tech Administrator reports
- Tech Administrator search results

Administrator should only see:

- Verification Officers
- Nodal Officers
- Administrators

---

## Administrator Responsibilities

Focus areas:

- Project Monitoring
- Project Creation
- Project Editing
- User Administration
- Department Monitoring
- Sector Monitoring
- Verification Monitoring
- Report Generation

Out of scope:

- System Administration
- Infrastructure Monitoring
- Technical Health Monitoring
- Security Configuration
- Application Performance Monitoring

---

## Dashboard Objective

Designed for:

- Department Secretary
- OSD Officers
- Senior Government Administrators

Core questions answered:

1. How many projects are running?
2. How many projects are completed?
3. Which departments are performing best?
4. Which departments require attention?
5. What is the physical achievement?
6. What is the financial achievement?
7. How much employment has been generated?
8. How many projects are pending verification?
9. Which districts have the most progress?

---

## Dashboard Layout

### 1) Executive Summary Cards

Display:

- Total Projects
- Active Projects
- Completed Projects
- Physical Achievement %
- Financial Achievement %
- Employment Generated
- Pending Verification

Use large KPI cards with trend delta and clear status color.

### 2) Department Performance

Display ranking by:

- Department Name
- Physical %
- Financial %
- Project Count

Highlight:

- Top Performing Departments
- Lowest Performing Departments

### 3) Sector Performance

Display:

- Sector-wise project count
- Sector-wise achievement

Sectors:

- Agriculture
- Infrastructure
- Health
- Education
- Tourism
- Others

### 4) District Progress

Display:

- District
- Total Projects
- Physical %
- Financial %

Provide district ranking.

### 5) Verification Monitoring

Display:

- Pending Verification Projects
- Recently Verified Projects
- Verification Officer Workload

### 6) Employment Generation

Display:

- Direct Employment
- Indirect Employment

Provide department-wise summary.

### 7) Quick Actions

Buttons:

- Create Project
- View Projects
- Manage Users
- Reports
- Department Summary

---

## User Management

Allow:

- View Users
- Search Users
- Activate Users
- Deactivate Users
- Reset Password

Do not allow:

- Managing Tech Administrators
- Viewing Tech Administrators

---

## Project Management

Allow:

- Create Project
- Edit Project
- Archive Project
- View Project

Do not allow:

- Permanent Delete

---

## Current Dashboard Pain Points

1. KPI data spread across multiple screens.
2. No single executive at-a-glance decision view.
3. Role noise from non-governance technical data.
4. Department ranking lacks clear intervention signals.
5. Weak insight-to-action flow for verification bottlenecks.
6. District comparison not prominently ranked.
7. Employment impact not surfaced as a top KPI.

---

## Executive Dashboard Wireframe (Logical)

- Header: OSD Administrator Dashboard + filters (Phase, Date, Department, Sector, District)
- Row 1: 7 KPI Cards
- Row 2: Department Ranking + Verification Monitoring
- Row 3: Sector Performance + District Ranking
- Row 4: Employment Summary + Quick Actions

---

## Recommended Layout Specification

1. Top bar
   - Title, filters, and data timestamp.
2. Row 1
   - KPI cards with trend comparison.
3. Row 2
   - Left: Department ranking table.
   - Right: Verification monitoring panel.
4. Row 3
   - Left: Sector performance chart.
   - Right: District ranking table.
5. Row 4
   - Left: Employment generation summary.
   - Right: Quick action buttons.

Visual guidance:

- Green: on track
- Amber: watchlist
- Red: requires intervention

---

## Department Performance Design

Columns:

- Department Name
- Physical Achievement %
- Financial Achievement %
- Project Count
- Completed Projects
- Pending Verification

Scoring model:

- Composite Score = (0.45 x Physical%) + (0.35 x Financial%) + (0.20 x Completion Ratio)

Highlight rules:

- Top performing: Score >= 75
- Requires attention: Score < 50

---

## Sector Performance Design

Metrics per sector:

- Total Projects
- Active Projects
- Completed Projects
- Physical %
- Financial %

Display:

- Project count bars
- Achievement overlay (line or grouped bars)

---

## District Performance Design

Columns:

- District
- Total Projects
- Physical %
- Financial %
- Completed Projects
- Pending Verification

Features:

- Rank districts by composite score
- Show top 3 and bottom 3
- Mark intervention-priority districts

---

## User Management Design

List fields:

- Name
- Login
- Role
- Department
- Status
- Last Login
- Actions

Enforcement:

- Exclude Tech Administrators at API query layer, search layer, and exports.

---

## Project Management Design

Panels:

- Project Metadata
- Physical and Financial Progress
- Verification Status
- Employment Impact
- Media Summary

Risk tags:

- Delayed
- Pending Verification
- Low Financial Utilization

---

## Permission Matrix for `osd.admin`

| Module                 | Capability                          | osd.admin |
| ---------------------- | ----------------------------------- | --------- |
| Dashboard              | View executive project KPIs         | Allow     |
| Dashboard              | View technical/system metrics       | Deny      |
| Users                  | View Verification/Nodal/Admin users | Allow     |
| Users                  | View Tech Administrator users       | Deny      |
| Users                  | Search Tech Administrator users     | Deny      |
| Users                  | Activate/Deactivate allowed users   | Allow     |
| Users                  | Reset password for allowed users    | Allow     |
| Projects               | Create                              | Allow     |
| Projects               | Edit                                | Allow     |
| Projects               | Archive                             | Allow     |
| Projects               | Permanent Delete                    | Deny      |
| Departments            | View rankings and detail            | Allow     |
| Sectors                | View performance                    | Allow     |
| Districts              | View rankings and detail            | Allow     |
| Verification           | View pending/recent/workload        | Allow     |
| Reports                | Generate executive reports          | Allow     |
| Reports                | Tech Administrator reports          | Deny      |
| Security/System Config | Access configuration                | Deny      |
| Infra/App Health       | Access monitoring pages             | Deny      |

---

## Final Production-Ready Dashboard Specification

1. Identity and access
   - Create dedicated user `osd.admin` with `role_id = 4`.
   - Apply restricted permission profile above.
2. Visibility policy
   - Hide Tech Administrator entities across UI, API, search, and reports.
3. KPI contract
   - Total Projects
   - Active Projects
   - Completed Projects
   - Physical Achievement %
   - Financial Achievement %
   - Employment Generated (Direct + Indirect)
   - Pending Verification
4. Mandatory modules
   - Department ranking
   - Sector performance
   - District ranking
   - Verification monitoring
   - Employment generation
   - Quick actions
5. UX and governance
   - Executive-first layout, minimal clicks to action.
   - Data timestamp and scheduled refresh.
   - CSV/PDF export for review meetings.
6. Exclusions
   - No system administration dashboards.
   - No infrastructure/technical health analytics.
   - No developer-oriented performance metrics.
