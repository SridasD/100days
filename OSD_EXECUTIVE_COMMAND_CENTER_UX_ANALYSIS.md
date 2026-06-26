# OSD Executive Command Center UX Analysis and Redesign

Project: Kerala CMO HDP (100 Days Programme) Executive Monitoring Portal  
Primary User: OSD Administrator

This document captures the UX audit and redesign framework used to move the OSD screen from a reporting dashboard to an executive command center.

## 1. UX Audit

### Current strengths
- Clean visual style and consistent component usage.
- Role separation already implemented for OSD versus tech admin.
- Good baseline KPI coverage across projects, departments, districts, sectors, verification, and employment.

### Current issues (validated against your problem list)
- Left sidebar consumed high-value space in a data-dense executive view.
- Quick Actions repeated what section navigation already provided.
- Key intervention metrics were not clustered into a true top command strip.
- Screen behavior resembled static reporting rather than decision support.
- Trend intelligence was weak or absent at the executive level.
- Risk signals were not explicit enough for immediate intervention.
- Intervention recommendations were not surfaced as first-class content.
- Tables dominated visual hierarchy and slowed executive scanning.
- Information hierarchy did not sufficiently prioritize what needs action now.

### UX risk summary
- High risk of delayed intervention decisions.
- Medium risk of executive cognitive overload.
- Medium risk of missed bottlenecks due to table-first layout.

## 2. Information Architecture

### Global command-center order
1. Command Header and Programme Health strip
2. Executive Top Row Metrics (intervention-first)
3. Attention Center (Critical, Warning, Normal)
4. Executive Insight Rail (dynamic signal cards)
5. District Intelligence Map grid
6. Verification Command Center
7. Department Leaderboard (top and bottom)
8. Sector Analytics
9. Employment Impact
10. Intervention Recommendations and Command Actions

### Why this order
- Moves high-urgency decision content above the fold.
- Replaces passive data browsing with action-oriented interpretation.
- Keeps table use only where ranking precision is required.

## 3. Wireframe (Text)

Desktop structure:
- Row 1:
  - Left: Command Header (title, badges, update timestamp)
  - Right: Programme Health Score card (score, trend, risk level)
- Row 2:
  - Five KPI cards: Projects at Risk, Pending Verification, Delayed Projects, Districts Needing Attention, Employment Generated
- Row 3:
  - Left: Attention Center (Critical, Warning, Normal columns)
  - Right: Executive Insight Rail
- Row 4:
  - Left: District Intelligence Map grid
  - Right: Verification Command Center
- Row 5:
  - Left: Top Performer leaderboard table
  - Right: Bottom Performer leaderboard table
- Row 6:
  - Left: Sector Analytics cards/charts
  - Right: Employment Impact cards and trend bars
- Row 7:
  - Left: Intervention Recommendations
  - Right: Command Actions panel

Mobile structure:
- Health Score card directly under title
- Priority KPI cards in 1-column stacked sequence
- Attention Center before everything else
- Insight Rail cards stacked
- District map cards stacked
- Verification and leaderboards as scrollable card blocks

## 4. Component Hierarchy

### Page-level
- OsdExecutiveCommandCenterPage
  - CommandHeader
  - ProgrammeHealthCard
  - ExecutiveKpiRow
  - AttentionCenter
  - ExecutiveInsightRail
  - DistrictIntelligenceGrid
  - VerificationCommandCenter
  - DepartmentLeaderboardTop
  - DepartmentLeaderboardBottom
  - SectorAnalyticsPanel
  - EmploymentImpactPanel
  - InterventionRecommendationsPanel
  - CommandActionsPanel

### Reusable atomic components
- InsightCard
- KpiTile
- MetricMini
- SparkBars
- AttentionColumn
- RankTable

## 5. Dashboard Redesign Summary

### What changed in implementation
- Removed OSD sidebar footprint by using role-aware layout expansion for OSD screens.
- Added Programme Health Score block with trend and risk band.
- Added top intervention KPI strip.
- Added Executive Insight Rail with dynamic narrative signals.
- Added Attention Center grouped by severity with direct links.
- Replaced district table emphasis with district status map grid and drill-down links.
- Split department leaderboard into top and bottom performer views.
- Converted sector and employment sections to chart-like visual cards instead of table-heavy output.
- Added intervention recommendation cards for executive action.

### Accessibility and quality targets
- WCAG 2.1 AA baseline via contrast-safe badges, clear labels, and readable text sizing.
- Touch-friendly controls for mobile.
- Keyboard-focusable links and action cards.

## 6. Suggested Charts

### Programme-level
- Radial or gauge indicator for Programme Health Score.
- 7-day versus previous 7-day verification trend micro chart.

### District intelligence
- Choropleth map when GIS layer is available.
- Current implementation uses map-like heat-grid fallback for immediate deployment.

### Department leaderboard
- Ranked horizontal bars for risk score.
- Detailed table for executive drill precision.

### Sector analytics
- Horizontal contribution bars.
- Completion ratio progress bars.

### Employment
- Monthly trend bars.
- District contribution bars.

## 7. Next.js Implementation Strategy

### Data layer
- Expanded API payload in app/api/admin/osd/dashboard/route.ts with:
  - riskSignals
  - full department list
  - district ids for drill-down
  - verification trend windows
  - employment by district
  - employment month trend

### UI layer
- Rebuilt app/(admin)/admin/osd/dashboard/page.tsx to consume expanded payload.
- Added derived metrics in UI for:
  - Programme Health Score
  - Risk score
  - Verification completion
  - Employment achievement proxy
  - Department risk score

### Layout shell
- Updated app/(admin)/admin/layout.tsx:
  - OSD path uses wider canvas
  - OSD hides sidebar chrome
  - non-OSD admin retains standard sidebar

### Performance and maintainability
- Kept componentized card and panel structure for incremental enhancements.
- Maintained no-store fetch for live executive behavior.

## 8. Mobile Layout Strategy

### Priority order on mobile
1. Programme Health Score
2. Top intervention KPI cards
3. Attention Center
4. Insight Rail
5. Verification Command Center
6. District cards
7. Leaderboards
8. Sector and employment panels

### Mobile interaction rules
- Minimum target heights for action controls.
- Single-column cards for readability.
- Compact but legible KPI labels.
- Keep heavy table usage minimized in small viewports.

## 9. KPI Calculation Strategy

### Programme Health Score
Weighted score from four dimensions:
- Physical Achievement: 35%
- Financial Achievement: 25%
- Verification Completion: 25%
- Employment Achievement: 15%

Formula:
ProgrammeHealthScore = 0.35 x Physical + 0.25 x Financial + 0.25 x VerificationCompletion + 0.15 x EmploymentAchievement

Where:
- VerificationCompletion = (TotalIndicators - PendingVerification) / TotalIndicators x 100
- EmploymentAchievement uses a practical normalization proxy capped at 100

### Risk Score
RiskScore = clamp(100 - ProgrammeHealthScore + PendingPenalty + DelayPenalty)

### Department Risk Score
Derived from composite score plus verification and financial signals.

### Trend Intelligence
VerificationTrendPercent compares last 7 days versus previous 7 days.

## 10. Final Screen Mockup Description

The final screen feels like a government-grade command cockpit:
- A strong executive header and score card establish mission context instantly.
- A five-card intervention strip presents immediate action priorities.
- The central canvas focuses on Attention Center and Insight Rail, making recommendations explicit.
- District and verification panels provide spatial and operational bottleneck intelligence.
- Leaderboards separate top performers from lagging departments for sharper interventions.
- Sector and employment panels close the loop from execution to impact.
- The layout is responsive, analytics-first, and optimized for fast executive scanning.

## Delivery Notes

- UI-UX Pro Max design-system guidance was used for data-dense dashboard direction.
- Magic MCP generation was intentionally skipped per instruction and implementation was done directly in project code.
