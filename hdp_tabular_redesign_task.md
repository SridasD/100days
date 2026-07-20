# Task: Redesign the project progress tabular report UI/UX

> **This report already exists and works.** The data pipeline, queries, status
> logic, and export integration are all in place. This task is a **UI/UX
> redesign** of the rendering layer only.

---

## Entry point

The reports hub page (`/admin/osd/reports` and `/admin/reports`) shows a card:

```
┌────────────────────────────────────────────────────────────────┐
│  Project Progress & Performance Review     [lagging-analysis]  │
│  Hierarchical progress and performance view by administrative  │
│  department, agency, project, and indicator                    │
│                                                                │
│  INCLUDES                                                      │
│  • Administrative Department Summary                           │
│  • Drill-down View                                             │
│  • Indicator-level Performance                                 │
│                                                                │
│  [👁 View]        [📊 Dashboard]        [⬇ Download]           │
│                    ↑                                            │
│                    This button opens the tabular report         │
└────────────────────────────────────────────────────────────────┘
```

### Button rename

In the reports hub (`app/(admin)/admin/reports/page.tsx` and the OSD variant),
rename the button label from **"Tabular View"** to **"Dashboard"**.

This is a one-line text change in the reports hub. Find the button/link that
currently reads "Tabular View" and change it to "Dashboard". The route it
navigates to stays the same (`/admin/reports/lagging-analysis/tabular` or
`/admin/osd/reports/lagging-analysis/tabular`).

Also update the icon if applicable — use a layout/dashboard icon
(e.g., `LayoutDashboard` from Lucide) instead of the table icon.

---

## What already exists

### Files
- **Main component**: `components/reports/ReportTabularPage.tsx` (server component)
- **Admin route**: `app/(admin)/admin/reports/[reportId]/tabular/page.tsx`
- **OSD route**: `app/(admin)/admin/osd/reports/[reportId]/tabular/page.tsx`
- **Reports hub (admin)**: `app/(admin)/admin/reports/page.tsx`
- **Reports hub (OSD)**: `app/(admin)/admin/osd/reports/page.tsx` (or similar — verify)
- **Threshold config**: `lib/config/defaulter-thresholds.ts`

### Working data pipeline (DO NOT rewrite)
- `loadTabularRows()` — raw SQL via `db.execute(sql\`...\`)` with CTEs:
  `secretary_projects` → `dept_hods` → `dept_map` → final select
- `buildDepartments()` — groups rows into `DepartmentGroup[] → ProjectGroup[] → TabularRow[]`
- `aggregate(rows)` — computes KPI totals
- `verificationStatus(row)` — Verified / Pending Verification / No Update
- `indicatorStatus(row)` — Lagging / On Track
- `getDefaulterThresholds()` — configurable staleness logic
- `containsMalayalam()` — Unicode range detection for `lang="ml"`

### What the current UI provides
- Header with navigation
- KPI strip (departments, projects, indicators, lagging)
- Inline aggregate strip (physical, financial, media totals)
- Department-level blocks
- Expandable project blocks (using HTML `<details>`)
- Indicator rows per project
- Horizontal scroll for dense indicator columns
- Malayalam font handling
- XLSX export via `/api/admin/reports/{reportId}?format=xlsx`

---

## What needs to change (UI/UX only)

The current rendering uses basic HTML blocks, `<details>` elements, and inline
grids. The redesign brings it up to the application's ShadCN/Tailwind design
system with a modern enterprise dashboard feel.

### Before you change anything

1. **Read the full current `ReportTabularPage.tsx`** — understand every section
2. **Identify which parts are data logic vs rendering** — only touch rendering
3. **Check which ShadCN components are available** in `components/ui/`
4. **Present your refactoring plan** before making changes
5. **Wait for approval**

---

## Redesign specification

### Overall layout (top to bottom)

```
┌──────────────────────────────────────────────────────┐
│  Report header                                        │
│  "Project progress and performance review"            │
│  Breadcrumb: Admin Dept → Project → Indicator         │
│  Actions: [Export XLSX] [Refresh] [Last updated: ...]  │
│  View switcher: [Hierarchy] [Tabular (active)]        │
├──────────────────────────────────────────────────────┤
│  KPI summary cards (compact grid row)                 │
│  ┌─────┐ ┌─────┐ ┌─────────┐ ┌───────┐ ┌─────┐ ... │
│  │Depts│ │Projs│ │Indicators│ │Lagging│ │Avg% │     │
│  └─────┘ └─────┘ └─────────┘ └───────┘ └─────┘     │
├──────────────────────────────────────────────────────┤
│  Filter toolbar                                       │
│  [🔍 Search...] [Dept ▼] [Agency ▼] [Status ▼]       │
│  [Apply] [Clear]                                      │
├──────────────────────────────────────────────────────┤
│  Hierarchical expandable table                        │
│                                                        │
│  Name  │ Agency/HOD │ Phys% │ Fin% │ Verif │ Status │ │
│  ──────┼────────────┼───────┼──────┼───────┼────────│ │
│  ▶ Agriculture Dept    34 projects · 185 indicators   │
│  ▼ IT Department                                      │
│    ├─ ▶ KFON           KFON Ltd   88%  80%  ✓  OnTrk │
│    ├─ ▼ E-Gov 3.0      IT Mission                     │
│    │    ├─ Portal migr  —         45%  40%  ⏳ OnTrk  │
│    │    └─ AI chatbot   —         78%  70%  ✓  OnTrk  │
│    └─ ▶ Data Centre     ...                           │
│                                                        │
├──────────────────────────────────────────────────────┤
│  Pagination (department-level)                        │
└──────────────────────────────────────────────────────┘
```

### Visual hierarchy for table rows

| Level | Element | Background | Font | Indent | Left accent | Chevron |
|---|---|---|---|---|---|---|
| Department | `<tr>` or card | `bg-muted/50` | `font-semibold text-sm` | 0 | 3px border, worst-status color | ▶/▼ |
| Project | `<tr>` or row | default bg | `font-medium text-sm` | `pl-6` | 2px border, worst-status color | ▶/▼ |
| Indicator | `<tr>` or row | default bg | `font-normal text-sm` | `pl-12` | none | none |

### KPI summary cards

Use the existing `aggregate()` output. Map to compact cards:

| Card | Source field | Display |
|---|---|---|
| Departments | `departments.length` | Count |
| Projects | total project count across departments | Count |
| Indicators | `agg.totalIndicators` | Count |
| Lagging | `agg.lagging` | Count, red accent if > 0 |
| Avg physical | `agg.avgPhysical` | Percentage |
| Avg financial | `agg.avgFinancial` | Percentage |
| Media uploaded | `agg.images + agg.videos + agg.documents` | Count with breakdown tooltip |

Cards should be compact enough to stay above the fold. Use a responsive grid:
`grid-cols-2 sm:grid-cols-4 lg:grid-cols-7`

### Status badges

Use ShadCN `Badge` component (or the existing badge pattern in the app):

| Status | Variant | Tailwind classes |
|---|---|---|
| Verified | success/teal | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| Pending verification | warning/amber | `bg-amber-50 text-amber-700 border-amber-200` |
| No update | secondary/gray | `bg-gray-100 text-gray-500` |
| On track | success/green | `bg-green-50 text-green-700` |
| Lagging | destructive/red | `bg-red-50 text-red-700 border-red-200` |

Adapt colors to match what the app already uses for badges elsewhere.

### Progress bars

Replace plain numbers with inline progress bars + percentage:

```tsx
<div className="flex items-center gap-2">
  <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
    <div
      className="h-full rounded-full bg-teal-500"
      style={{ width: `${value}%` }}
    />
  </div>
  <span className="text-xs tabular-nums">{value}%</span>
</div>
```

- Physical progress: `bg-teal-500`
- Financial progress: `bg-blue-500`

### Media columns

Three compact columns with Lucide icons:

```tsx
<div className="flex items-center gap-1 text-muted-foreground text-xs">
  <Camera className="h-3.5 w-3.5" />
  <span>{imageCount}</span>
</div>
```

Icons: `Camera` (images), `Video` (videos), `FileText` (documents)

### Expand/collapse behavior

Replace `<details>` elements with React state-driven expansion:

```tsx
const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

// Toggle
const toggleDept = (key: string) => {
  setExpandedDepts(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
};
```

Use `ChevronRight` icon with `rotate-90` transition for open state.

**Important**: This means `ReportTabularPage` will need a client component
wrapper for the interactive table, while the data loading stays server-side.
Pattern: server component loads data → passes to client component for rendering.

### Filter toolbar

Add client-side filtering on the already-loaded data (since `loadTabularRows()`
fetches everything server-side already):

- **Search**: filter across department name, project name, indicator name
- **Department dropdown**: unique department list from data
- **Status filter**: Lagging / Pending / Verified / On track
- **Clear button**: reset all filters

If the dataset is small enough (it's loaded in-memory already), client-side
filtering is fine. Don't add new API endpoints unless the data is too large.

### Pagination

If there are many departments, paginate the department list client-side
(the data is already in memory). Show 10-20 departments per page.

### Responsive behavior

| Breakpoint | Behavior |
|---|---|
| `lg` and up | Full table with all columns visible |
| `md` | Slightly condensed, smaller padding |
| `sm` | Sticky first column (hierarchy name), horizontal scroll for rest |

Use `overflow-x-auto` wrapper with `min-w-[900px]` on the table.
Sticky first column: `sticky left-0 bg-background z-10`

### Table header

Make sticky: `sticky top-0 bg-background z-20 border-b`

### Empty / loading states

- While data loads: skeleton rows (use existing Skeleton component)
- No results after filtering: "No departments match your filters" centered message
- Error: "Failed to load report data" with retry action

---

## Implementation approach

### Option A: Refactor in place (recommended if component is ≤500 lines)

Split `ReportTabularPage.tsx` into:

```
components/reports/
  ReportTabularPage.tsx          ← server component (data loading only)
  tabular/
    TabularReportShell.tsx       ← client component (interactive wrapper)
    KPISummaryCards.tsx
    FilterToolbar.tsx
    HierarchicalTable.tsx
    DepartmentRow.tsx
    ProjectRow.tsx
    IndicatorRow.tsx
    ProgressBarCell.tsx
    StatusBadge.tsx
    MediaCell.tsx
```

### Option B: Rewrite rendering (recommended if component is >500 lines)

Create a new `ReportTabularPageV2.tsx` alongside the existing one.
Once validated, swap the import in the route files.
Keep the old file until the new one is confirmed working.

### Either way

- **DO NOT touch** `loadTabularRows()`, `buildDepartments()`, `aggregate()`,
  `verificationStatus()`, `indicatorStatus()`, `getDefaulterThresholds()`,
  or the SQL query
- **DO NOT touch** the route files beyond swapping the component import (if Option B)
- **DO NOT touch** the reports hub page or export endpoint
- **Preserve** Malayalam text handling (`containsMalayalam()`, `lang="ml"`, `font-malayalam`)
- **Preserve** the XLSX export action
- **Preserve** all existing navigation links

---

## Refactoring plan template (fill this in during analysis)

Before making changes, present:

1. Current line count of `ReportTabularPage.tsx`
2. Which option (A or B) you recommend and why
3. Exact list of new files to create
4. Exact list of existing files to modify (and what changes)
5. Which ShadCN components you'll use (confirm they exist in `components/ui/`)
6. Any components you need to create that don't exist yet
7. How you'll handle the server → client component split
8. Confirm these are untouched:
   - [ ] `loadTabularRows()` query logic
   - [ ] `buildDepartments()` grouping logic
   - [ ] `aggregate()` computation
   - [ ] Status functions
   - [ ] Threshold config
   - [ ] Export endpoint
   - [ ] Route files (beyond component import swap)
   - [ ] Reports hub page (except the button label rename: "Tabular View" → "Dashboard")

**Wait for approval before writing any code.**

---

## Checklist before submitting

- [ ] Visual hierarchy: department rows visually heavier than project rows, which are heavier than indicator rows
- [ ] Progress bars render inline next to percentage values
- [ ] Status badges use consistent color coding
- [ ] Expand/collapse works with smooth chevron rotation
- [ ] KPI cards are compact and above the fold
- [ ] Filter toolbar allows search + status filtering
- [ ] Malayalam text still gets `lang="ml"` and correct font
- [ ] Export XLSX button still works
- [ ] View switcher links to hierarchy view
- [ ] Responsive: horizontal scroll on tablet with sticky first column
- [ ] Sticky table header
- [ ] No hydration errors (server/client boundary is clean)
- [ ] TypeScript strict — no `any` types
- [ ] No new npm dependencies unless absolutely necessary
- [ ] Reports hub button renamed from "Tabular View" to "Dashboard"
- [ ] Reports hub button icon updated to dashboard/layout icon
- [ ] Existing report routes still work unchanged
