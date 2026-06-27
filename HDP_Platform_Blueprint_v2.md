# Hundred Days Programme (HDP) — Platform Blueprint v2.0

**Project:** 100daysprogramme · Kerala CMO Portal Rebuild  
**Document ID:** CDIPD/HDP/PO/02 · **Version:** 2.0 · **Date:** June 2026  
**Prepared by:** Sridas D, Solution Architect, CDIPD  
**Stack:** Next.js 15 · PostgreSQL 15 (RLS) · NextAuth.js v5 · Tailwind CSS · ShadCN UI · 21st.dev Magic

---

## Amendment History

| Ver | Date        | Prepared by | Change                                                                             |
| --- | ----------- | ----------- | ---------------------------------------------------------------------------------- |
| 1.0 | 18-Jun-2026 | Sridas D    | Initial draft                                                                      |
| 2.0 | 22-Jun-2026 | Sridas D    | Restructured with actual legacy schema, security corrections, password reset flows |

---

## Table of Contents

1. Project Context
2. User Roles & Stakeholders
3. Functional Workflow
4. Database Architecture (Legacy → New)
5. Authentication & Security
6. Application Architecture
7. Page & Feature Blueprints
8. Form Validation Strategy
9. Audit & Logging
10. API Routes
11. UI Design System
12. Implementation Roadmap
13. Open Issues & Assumptions

---

## 1. PROJECT CONTEXT

### Background

HDP (Hundred Days Programme), hosted at `100days.kerala.gov.in`, is a CMO Kerala project-tracking portal that monitors government project delivery across fixed 100-day cycles ("phases"). Built and maintained by Digital University Kerala (DUK), with CDIPD providing solution architecture.

The current system is a **Java JSP/Servlet WAR** deployed on Apache Tomcat with a PostgreSQL `hdp` schema. This blueprint covers a **Next.js rebuild** preserving the existing `hdp` schema as the data layer while modernising the frontend, authentication, and security posture.

### What This Rebuild Delivers

- Secure, modern authentication replacing plaintext password storage
- Role-based dashboards for Nodal Officers and Verification Officers
- Full audit trail replacing the bare `user_log` table
- Password reset (self-service + admin-initiated)
- Progress entry forms, media upload, and verification workflows
- Public-facing reporting views (no login required)

### Scope Boundary

| In Scope                                  | Out of Scope                         |
| ----------------------------------------- | ------------------------------------ |
| Auth, dashboards, forms, workflows, audit | Dept-internal legacy systems         |
| Rebuild of JSP screens in Next.js         | Infrastructure outside app + DB      |
| Password encryption & reset               | New 100-day phase seeding procedures |
| Admin user management                     | Payment integrations                 |

---

## 2. USER ROLES & STAKEHOLDERS

### Roles (from `hdp.master_role` + `hdp.user_details.role_id`)

| Role                     | Legacy role_id         | Responsibility                                                  | Login Required |
| ------------------------ | ---------------------- | --------------------------------------------------------------- | -------------- |
| **Nodal Officer**        | 2                      | Enters project/indicator progress, uploads photo/video evidence | ✅ Yes         |
| **Verification Officer** | 1 (Secretary/CMO-side) | Reviews, validates, approves Nodal Officer submissions          | ✅ Yes         |
| **Admin / Super Admin**  | 3                      | User management, system settings, reports, password resets      | ✅ Yes         |
| **Public / Citizen**     | —                      | Views published, verified progress data                         | ❌ No login    |

### Stakeholder Context

- **CMO Kerala** — Executive sponsor; consumes consolidated dashboards
- **DUK-CDIPD** — Platform owner; architects and governs the system
- **Citizens** — Read-only public reports (no authentication)

---

## 3. FUNCTIONAL WORKFLOW

```
Phase Start
    │
    ▼
[Admin] Seeds master_projects + project_secretary (Secretary assignments)
    │
    ▼
[Nodal Officer] Logs in → Creates/updates indicators per project
    │   - Sets targets (financial + physical)
    │   - Uploads photo/video evidence
    │   - Submits progress update
    │
    ▼
[Verification Officer] Reviews submitted indicators
    │   - Verifies financial + physical achievement
    │   - Approves or sends back with remarks
    │
    ▼
[System] Publishes approved data to public dashboard
    │
    ▼
[Public] Views district/secretary-wise progress (no login)
```

---

## 4. DATABASE ARCHITECTURE

### Strategy: Shared Database + Row Level Security (Option C)

Retain the existing `hdp` schema. Add security and audit enhancements only where noted.

---

### 4.1 Existing Tables (Legacy — Retain As-Is)

#### `hdp.user_details` — ⚠️ SECURITY CORRECTION REQUIRED

```sql
-- CURRENT (insecure — plaintext password, varchar(25) limit)
CREATE TABLE hdp.user_details (
    user_id       bigint NOT NULL,
    user_name     character varying(250),
    login_name    character varying(150),
    password      character varying(25),   -- ❌ PLAINTEXT — must fix
    mobile_no     character varying(10),
    role_id       integer,                 -- FK to master_role
    status        integer,                 -- 1=active, 0=inactive
    registered_on timestamp DEFAULT CURRENT_DATE,
    registered_by character varying(150),
    sec_id        integer DEFAULT 0,       -- FK to master_secretary
    designation   character varying(250)
);
```

#### `hdp.user_log` — ⚠️ ENHANCEMENT REQUIRED

```sql
-- CURRENT (minimal — missing device/action/outcome fields)
CREATE TABLE hdp.user_log (
    user_log_id    bigint NOT NULL,
    user_id        integer,
    user_ip        character varying(150),
    logged_on      timestamp DEFAULT CURRENT_DATE,
    browser_details character varying(250),
    sec_id         integer
);
```

#### `hdp.master_role`

```sql
CREATE TABLE hdp.master_role (
    role_id          integer NOT NULL,
    role_description character varying(150)
);
-- Seed: 1=Verification Officer, 2=Nodal Officer, 3=Admin
```

#### `hdp.master_projects` — Core project table

Key columns: `project_id`, `project_name`, `project_name_mal`, `project_cost`, `sector_id`, `stage`, `is_completed`, `inserted_by`, `updated_by`  
Archive trigger: `archive_master_projects()` → `hdp.master_projects_archive`

#### `hdp.indicators` — Progress tracking per project

Key columns: `indicator_id`, `project_id`, `indicator_name`, `district_id`, `financial_target`, `physical_target`, `financial_achievement`, `physical_achievement`, `submitted_by`, `submitted_date`, `verified_by`, `verified_date`, `percentage`, `verified_percentage`  
Archive trigger: `archive_indicators()` → `hdp.indicators_archive`

#### `hdp.master_secretary` — Department/Secretary master

Links to `project_secretary` (which projects belong to which secretary/dept)

#### Supporting Masters

- `hdp.master_district` — 14 Kerala districts
- `hdp.master_localbody` / `master_localbody_type` — Local body classifications
- `hdp.master_sector` — Project sectors
- `hdp.master_beneficiary` — Beneficiary categories
- `hdp.gallery` — Photo/video evidence per indicator (1=Image, 2=Video, 3=Document)
- `hdp.documents` — Supporting documents per indicator

---

### 4.2 Required Schema Alterations (New — Security & Features)

#### ALTER 1: Password column — bcrypt hash

```sql
-- Expand column to hold bcrypt hash (60 chars) + add reset fields
ALTER TABLE hdp.user_details
    ALTER COLUMN password TYPE character varying(100),
    ADD COLUMN IF NOT EXISTS password_reset_token    character varying(100),
    ADD COLUMN IF NOT EXISTS password_reset_expires  timestamp without time zone,
    ADD COLUMN IF NOT EXISTS last_login              timestamp without time zone,
    ADD COLUMN IF NOT EXISTS failed_login_attempts   integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS locked_until            timestamp without time zone;

-- All existing passwords MUST be migrated to bcrypt before go-live
-- Migration script: hash each password with bcrypt(12 rounds), update row
```

#### ALTER 2: Enhanced user_log

```sql
ALTER TABLE hdp.user_log
    ADD COLUMN IF NOT EXISTS action         character varying(50),
    ADD COLUMN IF NOT EXISTS entity         character varying(50),
    ADD COLUMN IF NOT EXISTS entity_id      bigint,
    ADD COLUMN IF NOT EXISTS outcome        character varying(10),  -- 'SUCCESS'|'FAILURE'
    ADD COLUMN IF NOT EXISTS user_agent     character varying(500),
    ADD COLUMN IF NOT EXISTS meta           jsonb;

-- Actions to log: LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT,
-- INDICATOR_SUBMIT, INDICATOR_VERIFY, INDICATOR_REJECT,
-- PASSWORD_RESET_REQUEST, PASSWORD_RESET_COMPLETE,
-- USER_CREATED, USER_STATUS_CHANGED, ADMIN_PASSWORD_RESET
```

#### NEW: Password Reset Tokens Table

```sql
CREATE TABLE IF NOT EXISTS hdp.password_reset_tokens (
    token_id        bigserial PRIMARY KEY,
    user_id         bigint NOT NULL REFERENCES hdp.user_details(user_id),
    token           character varying(100) NOT NULL UNIQUE,
    created_at      timestamp DEFAULT now() NOT NULL,
    expires_at      timestamp NOT NULL,
    used_at         timestamp,
    reset_by        bigint REFERENCES hdp.user_details(user_id), -- NULL = self-service
    ip_address      character varying(150)
);
CREATE INDEX idx_prt_token   ON hdp.password_reset_tokens(token);
CREATE INDEX idx_prt_user    ON hdp.password_reset_tokens(user_id);
CREATE INDEX idx_prt_expires ON hdp.password_reset_tokens(expires_at);
```

#### NEW: Session Blocklist (for forced logout on password reset)

```sql
CREATE TABLE IF NOT EXISTS hdp.session_blocklist (
    jti         character varying(100) PRIMARY KEY,  -- JWT ID
    user_id     bigint NOT NULL,
    blocked_at  timestamp DEFAULT now(),
    reason      character varying(50)                -- 'PASSWORD_RESET'|'ADMIN_REVOKE'
);
```

---

### 4.3 Row Level Security

```sql
-- Enable RLS on indicators (Nodal Officers see only their sec_id's projects)
ALTER TABLE hdp.indicators ENABLE ROW LEVEL SECURITY;

-- Nodal officers see only indicators for their assigned secretary's projects
CREATE POLICY nodal_officer_indicators ON hdp.indicators
    FOR ALL TO hdp_app_user
    USING (
        project_id IN (
            SELECT project_id FROM hdp.project_secretary
            WHERE sec_id = current_setting('app.sec_id')::integer
        )
    );

-- Verification officers and admin see all
CREATE POLICY admin_all_indicators ON hdp.indicators
    FOR ALL TO hdp_app_admin
    USING (TRUE);
```

---

### 4.4 Key Indexes (add if not existing)

```sql
CREATE INDEX IF NOT EXISTS idx_indicators_project    ON hdp.indicators(project_id);
CREATE INDEX IF NOT EXISTS idx_indicators_submitted  ON hdp.indicators(submitted_by, submitted_date);
CREATE INDEX IF NOT EXISTS idx_indicators_verified   ON hdp.indicators(verified_by, verified_date);
CREATE INDEX IF NOT EXISTS idx_indicators_district   ON hdp.indicators(district_id);
CREATE INDEX IF NOT EXISTS idx_user_details_login    ON hdp.user_details(login_name);
CREATE INDEX IF NOT EXISTS idx_user_log_user         ON hdp.user_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_log_action       ON hdp.user_log(action);
```

---

## 5. AUTHENTICATION & SECURITY

### 5.1 Login Flow

```
POST /api/auth/credentials
  → Lookup user by login_name
  → Check status = 1 (active)
  → Check locked_until (account lockout)
  → bcrypt.compare(input, stored_hash)
  → On failure: increment failed_login_attempts
               if attempts ≥ 5: set locked_until = now() + 30 min
  → On success: reset failed_login_attempts = 0
               update last_login = now()
               create JWT session (role_id, user_id, sec_id, login_name)
               write LOGIN_SUCCESS to user_log
  → Redirect to role-based dashboard
```

### 5.2 Password Reset — Two Flows

#### Flow A: Self-Service (Officer resets own password)

```
Officer clicks "Forgot Password" on login page
  → Enters login_name + registered mobile_no (verification)
  → System generates secure random token (crypto.randomBytes(32))
  → Stores token in password_reset_tokens (expires 1 hour)
  → Delivers token via SMS to mobile_no on record
  → Officer enters token + new password (min 8 chars, complexity rules)
  → System validates token (exists, not used, not expired)
  → bcrypt.hash(newPassword, 12) → update user_details.password
  → Mark token used, add old JWT to session_blocklist
  → Log PASSWORD_RESET_COMPLETE to user_log
  → Redirect to login
```

#### Flow B: Admin-Initiated Password Reset

```
Admin navigates to User Management → Officer record
  → Clicks "Reset Password"
  → Admin enters new temporary password OR system generates one
  → System bcrypt-hashes and updates user_details.password
  → Sets password_must_change = true (force change on next login)
  → Adds existing sessions to blocklist (force re-login)
  → Logs ADMIN_PASSWORD_RESET to user_log (with admin's user_id in meta)
  → Shows confirmation with temporary password (one-time display)
```

### 5.3 Security Baseline

| Concern             | Implementation                                              |
| ------------------- | ----------------------------------------------------------- |
| Password storage    | bcrypt, 12 rounds (migrate all existing plaintext → hashed) |
| Session             | httpOnly JWT cookie, 8-hour TTL (government working hours)  |
| Account lockout     | 5 failed attempts → 30-min lockout                          |
| CSRF                | NextAuth.js built-in CSRF token                             |
| SQL injection       | Drizzle ORM parameterized queries only                      |
| XSS                 | React auto-escaping + CSP headers in next.config.js         |
| Route protection    | Next.js middleware checks session + role on every request   |
| Password complexity | Min 8 chars, at least 1 uppercase, 1 number, 1 special char |
| VAPT                | Schedule reassessment (last done April 2022 — overdue)      |

### 5.4 Route Guard Middleware

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const session = getSessionFromCookie(request);
  const { pathname } = request.nextUrl;

  // Unauthenticated access → login
  if (!session && !pathname.startsWith("/public") && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Role enforcement
  if (session?.role_id === 2 && pathname.startsWith("/verify")) {
    return NextResponse.redirect(new URL("/officer/dashboard", request.url));
  }
  if (session?.role_id === 1 && pathname.startsWith("/officer")) {
    return NextResponse.redirect(new URL("/verify/dashboard", request.url));
  }
}
```

---

## 6. APPLICATION ARCHITECTURE

### Tech Stack

| Layer         | Choice                      | Notes                                        |
| ------------- | --------------------------- | -------------------------------------------- |
| Framework     | Next.js 15 (App Router)     | SSR + API routes in one deployment           |
| Language      | TypeScript                  | Full type safety                             |
| UI Base       | ShadCN UI + Tailwind CSS    | Accessible, composable                       |
| UI Generation | 21st.dev Magic MCP          | `/ui ...` prompts for complex components     |
| Auth          | NextAuth.js v5 Credentials  | Username + password only                     |
| DB Client     | Drizzle ORM + node-postgres | Type-safe, connects to existing `hdp` schema |
| Validation    | Zod                         | Shared client + server schemas               |
| Forms         | React Hook Form + Zod       | Controlled forms with real-time validation   |
| File Upload   | Multer / Next.js API route  | Photos/videos to uploads directory           |
| Password      | bcryptjs                    | Hashing for storage + comparison             |

### Folder Structure

```
/app
  /(public)
    /                    → Public dashboard (no login)
    /district/[id]       → District progress view
  /(auth)
    /login               → Login page
    /forgot-password     → Self-service reset step 1
    /reset-password      → Token + new password form
    /change-password     → Force change on first login
  /(officer)             → role_id = 2
    /dashboard           → Officer home
    /indicators          → My project indicators
    /indicators/[id]     → Indicator detail + progress entry
    /indicators/new      → Add new indicator
    /upload/[id]         → Photo/video upload for indicator
  /(verify)              → role_id = 1
    /dashboard           → Verification queue
    /review/[id]         → Indicator review + approve/reject
    /reports             → Secretary-wise summary
  /(admin)               → role_id = 3
    /dashboard           → System overview
    /users               → User list
    /users/new           → Create user
    /users/[id]          → Edit user + reset password
    /projects            → Master project management
    /reports             → Aggregate reports + export
    /audit               → Audit log viewer
  /api
    /auth/[...nextauth]  → NextAuth endpoints
    /indicators          → CRUD
    /indicators/[id]/submit   → Submit for verification
    /indicators/[id]/verify   → Approve/reject
    /upload              → Media upload handler
    /admin/users         → User management
    /admin/reset-password    → Admin-initiated reset
    /auth/forgot-password    → Token generation
    /auth/reset-password     → Token validation + hash update
/components
  /ui                    → ShadCN base
  /forms                 → IndicatorForm, LoginForm, ResetPasswordForm
  /tables                → IndicatorsTable, UsersTable, AuditTable
  /charts                → ProgressChart, DistrictChart, SectorChart
  /layout                → Sidebar, Header, RoleBadge
  /media                 → PhotoUpload, VideoUpload, GalleryView
/lib
  /db                    → Drizzle client + hdp schema types
  /auth                  → NextAuth config + bcrypt helpers
  /validations           → Zod schemas (shared client/server)
  /audit                 → writeAuditLog() helper
  /password              → generateResetToken(), validateToken()
```

---

## 7. PAGE & FEATURE BLUEPRINTS

### 7.1 Login Page (`/login`)

- Centered card, Kerala CMO branding
- Fields: Login Name + Password (show/hide toggle)
- "Forgot Password?" link → `/forgot-password`
- Lockout message: "Account locked. Try again after 30 minutes."
- Error: "Invalid credentials" (no field-level hints)
- Success → redirect to role dashboard

### 7.2 Forgot Password (`/forgot-password`)

- Fields: Login Name + Registered Mobile Number
- On match: "OTP/Token sent to your registered mobile"
- Token entry field + New Password + Confirm Password
- Complexity rules shown inline (checklist style)
- On success: redirect to `/login` with success toast

### 7.3 Nodal Officer Dashboard (`/officer/dashboard`)

**Stats Row**

- Total assigned projects
- Indicators submitted this cycle
- Indicators pending submission
- Overall % physical achievement

**My Project List**

- Cards per secretary/department
- Click → indicator list for that project

**Quick Actions**

- "Add New Indicator" CTA
- "Upload Evidence" shortcut

### 7.4 Indicator Progress Form (`/officer/indicators/[id]`)

```
Fields (map to hdp.indicators columns):
  indicator_name        → Text (varchar 255) — REQUIRED
  district_id           → Dropdown from master_district — REQUIRED
  local_body_type       → Dropdown from master_localbody_type
  local_body_id         → Multi-select from master_localbody (filtered by type)
  beneficiary           → Multi-select from master_beneficiary
  unit                  → Text (varchar 15)
  financial_target      → Decimal (13,5)
  physical_target       → Decimal (10,2)
  financial_achievement → Decimal (13,5)
  physical_achievement  → Integer
  physical_description  → Textarea
  no_days_employed_direct / indirect   → Integer
  no_persons_employed_direct / indirect → Integer
  latitude / longitude  → Decimal (optional, map picker)

Actions:
  [Save Draft]   → saves without submit flag
  [Submit]       → full validation → sets submitted_date, submitted_by

Post-submit: form locked, shows "Pending Verification" badge
Archive trigger fires on update (existing PostgreSQL trigger retained)
```

### 7.5 Media Upload (`/officer/upload/[indicator_id]`)

```
Supported: JPG, PNG, MP4 (max 50MB per file)
Maps to: hdp.gallery (gallery_type: 1=Image, 2=Video)
UI: drag-drop zone + thumbnail preview grid
After upload: is_verified = false (pending verification officer)
```

### 7.6 Verification Officer Dashboard (`/verify/dashboard`)

**Review Queue**

- List of submitted indicators (oldest first)
- Columns: Project | Indicator | Officer | Submitted Date | District | Status
- Click → review detail

**Summary Cards**

- Pending review count
- Approved this week
- Rejected this week
- Overall verified %

### 7.7 Indicator Review (`/verify/review/[id]`)

- Full indicator detail (all fields read-only)
- Gallery viewer (photos/videos with approve/reject per media)
- Verification fields:
  - `verified_financial_achievement`
  - `verified_physical_achievement`
  - `verified_physical_description`
  - `verified_achieved_no_days/persons_employed`
- Action buttons: **[Approve]** | **[Reject with Remarks]**
- Remarks field (required on reject)
- On approve: sets `verified_by`, `verified_date`, `verified_percentage`

### 7.8 Admin — User Management (`/admin/users`)

**User List Table**

- Columns: Name | Login | Role | Secretary | Status | Last Login | Actions
- Actions: Edit | Reset Password | Activate/Deactivate

**Create/Edit User Form**

```
Fields:
  user_name     → Full name (varchar 250)
  login_name    → Login ID (varchar 150, unique)
  password      → Temp password (admin sets, bcrypt-hashed on save)
  mobile_no     → 10-digit mobile
  role_id       → Dropdown (Nodal Officer / Verification Officer / Admin)
  sec_id        → Dropdown from master_secretary (for Nodal Officers)
  designation   → Text
  status        → Active/Inactive toggle
```

**Admin Reset Password Panel**

- "Reset Password" button on user record
- Two options:
  - **Generate temporary password** (system generates, shown once, must change on login)
  - **Set specific password** (admin enters, bcrypt-hashed)
- Confirmation dialog with warning: "This will log out all active sessions"
- Logs `ADMIN_PASSWORD_RESET` with admin's user_id in meta

### 7.9 Public Dashboard (`/` — no login)

- Secretary/district-wise progress cards (from `at_a_glance` view)
- Physical and financial achievement % bars
- Photo gallery of approved evidence
- No edit controls, no PII visible

---

## 8. FORM VALIDATION STRATEGY

### Zod Schemas (shared client + server)

```typescript
// lib/validations/indicator.ts
import { z } from "zod";

export const indicatorSchema = z.object({
  indicator_name: z.string().min(3, "Indicator name required").max(255),
  district_id: z.number().int().positive("Select a district"),
  unit: z.string().max(15).optional(),
  financial_target: z.number().min(0).optional(),
  physical_target: z.number().min(0).optional(),
  financial_achievement: z.number().min(0).optional(),
  physical_achievement: z.number().int().min(0).optional(),
  physical_description: z.string().max(2000).optional(),
  no_days_employed_direct: z.number().int().min(0).default(0),
  no_persons_employed_direct: z.number().int().min(0).default(0),
  no_days_employed_indirect: z.number().int().min(0).default(0),
  no_persons_employed_indirect: z.number().int().min(0).default(0),
});

// lib/validations/password.ts
export const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Minimum 8 characters")
      .regex(/[A-Z]/, "Must contain uppercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// lib/validations/user.ts
export const createUserSchema = z.object({
  user_name: z.string().min(2).max(250),
  login_name: z.string().min(3).max(150),
  password: passwordSchema.shape.password,
  mobile_no: z.string().regex(/^\d{10}$/, "Enter valid 10-digit mobile"),
  role_id: z.number().int().min(1).max(3),
  sec_id: z.number().int().optional(),
  designation: z.string().max(250).optional(),
});
```

### Validation Layers

| Layer              | What                         | When              |
| ------------------ | ---------------------------- | ----------------- |
| Client (RHF + Zod) | Field feedback as user types | Immediately       |
| API Route (Zod)    | Re-validate before DB write  | On every POST/PUT |
| DB (Constraints)   | CHECK constraints, UNIQUE    | Final safety net  |

---

## 9. AUDIT & LOGGING

All actions written to enhanced `hdp.user_log`:

| Action                    | Who                  | When                         |
| ------------------------- | -------------------- | ---------------------------- |
| `LOGIN_SUCCESS`           | Any                  | Successful login             |
| `LOGIN_FAILURE`           | Any                  | Wrong credentials            |
| `ACCOUNT_LOCKED`          | System               | After 5 failures             |
| `LOGOUT`                  | Any                  | Session end                  |
| `INDICATOR_CREATED`       | Nodal Officer        | New indicator added          |
| `INDICATOR_SUBMITTED`     | Nodal Officer        | Submitted for verification   |
| `INDICATOR_APPROVED`      | Verification Officer | Verified and approved        |
| `INDICATOR_REJECTED`      | Verification Officer | Sent back with remarks       |
| `MEDIA_UPLOADED`          | Nodal Officer        | Photo/video added            |
| `PASSWORD_RESET_REQUEST`  | Officer              | Self-service token generated |
| `PASSWORD_RESET_COMPLETE` | Officer              | Password changed via token   |
| `ADMIN_PASSWORD_RESET`    | Admin                | Admin forced a reset         |
| `USER_CREATED`            | Admin                | New user created             |
| `USER_STATUS_CHANGED`     | Admin                | Activated/deactivated        |

```typescript
// lib/audit.ts
export async function writeAuditLog({
  userId,
  action,
  entity,
  entityId,
  req,
  meta,
}: AuditParams) {
  await db.insert(schema.userLog).values({
    user_id: userId,
    action,
    entity,
    entity_id: entityId,
    user_ip: getClientIP(req),
    browser_details: req.headers.get("user-agent")?.slice(0, 250),
    meta,
    logged_on: new Date(),
    outcome: "SUCCESS",
  });
}
```

---

## 10. API ROUTES

| Method | Route                                  | Role           | Description                   |
| ------ | -------------------------------------- | -------------- | ----------------------------- |
| POST   | `/api/auth/[...nextauth]`              | Public         | NextAuth login/logout         |
| POST   | `/api/auth/forgot-password`            | Public         | Generate reset token → SMS    |
| POST   | `/api/auth/reset-password`             | Public         | Validate token + update hash  |
| GET    | `/api/indicators`                      | Officer        | Get own indicators            |
| POST   | `/api/indicators`                      | Officer        | Create indicator              |
| PUT    | `/api/indicators/[id]`                 | Officer        | Update draft indicator        |
| POST   | `/api/indicators/[id]/submit`          | Officer        | Submit for verification       |
| POST   | `/api/upload/[id]`                     | Officer        | Upload photo/video to gallery |
| GET    | `/api/verify/queue`                    | Verif. Officer | Pending indicators            |
| POST   | `/api/verify/[id]/approve`             | Verif. Officer | Approve with verified values  |
| POST   | `/api/verify/[id]/reject`              | Verif. Officer | Reject with remarks           |
| GET    | `/api/admin/users`                     | Admin          | List all users                |
| POST   | `/api/admin/users`                     | Admin          | Create user                   |
| PATCH  | `/api/admin/users/[id]`                | Admin          | Edit user details             |
| POST   | `/api/admin/users/[id]/reset-password` | Admin          | Force password reset          |
| PATCH  | `/api/admin/users/[id]/status`         | Admin          | Activate/deactivate           |
| GET    | `/api/admin/reports`                   | Admin          | Aggregate summary             |
| GET    | `/api/audit`                           | Admin          | Audit log viewer              |
| GET    | `/api/public/dashboard`                | Public         | Published progress (no auth)  |

---

## 11. UI DESIGN SYSTEM

### Palette (Kerala Govt + CMO)

```
Primary Blue    #003580   (Kerala govt primary)
CMO Gold        #C8A951   (accent, headings)
Success Green   #16A34A   (approved, completed)
Warning Amber   #D97706   (pending, in-progress)
Error Red       #DC2626   (rejected, errors)
Neutral         #6B7280
Background      #F8FAFC
Surface White   #FFFFFF
```

### Typography

```
Display / Headers:  Inter 600–700
Body:               Inter 400–500
Data / IDs / %:     JetBrains Mono
Malayalam text:     Noto Sans Malayalam (for project_name_mal fields)
```

### Status Badges (map to indicator state)

```
Not started     → grey    bg-gray-100   text-gray-700
Draft           → slate   bg-slate-100  text-slate-700
Submitted       → blue    bg-blue-100   text-blue-700
Approved        → green   bg-green-100  text-green-700
Rejected        → red     bg-red-100    text-red-700
Completed       → emerald bg-emerald-100 text-emerald-700
```

### 21st.dev Magic Prompt Examples

```
/ui create a Kerala CMO government portal indicator progress form with
financial target, physical target, financial achievement, physical
achievement fields. Include district dropdown and local body multi-select.
Primary color #003580, gold accent #C8A951. ShadCN UI + Tailwind.

/ui build a verification officer review panel showing indicator details
on the left and verified values input form on the right. Include
Approve/Reject buttons with a remarks textarea for rejection.
Kerala govt color scheme.

/ui design a secretary-wise progress dashboard with expandable project
cards showing % achievement bars for financial and physical targets.
Include a gallery grid for uploaded photos. Public-facing, no login UI.

/ui create an admin user management table with columns: name, login,
role badge, secretary, last login, status toggle, reset password button.
Include a "Create User" modal with password strength indicator.
```

---

## 12. IMPLEMENTATION ROADMAP

### Phase 1 — Foundation (Week 1–2)

- [ ] Next.js 15 project scaffold (TypeScript + Tailwind + ShadCN)
- [ ] Drizzle ORM connected to existing `hdp` schema (read existing tables as types)
- [ ] Apply schema alterations: password column expansion, new tables
- [ ] **Migrate all existing passwords** → bcrypt hash (one-time script)
- [ ] NextAuth.js Credentials provider with bcrypt compare
- [ ] Login page + forgot/reset password flows
- [ ] Route guard middleware (role-based)
- [ ] Audit log helper wired to enhanced `user_log`

### Phase 2 — Nodal Officer Module (Week 2–3)

- [ ] Officer dashboard
- [ ] Indicator list (by secretary/project)
- [ ] Indicator progress form (all `hdp.indicators` fields)
- [ ] Submit flow (sets `submitted_by`, `submitted_date`)
- [ ] Photo/video upload → `hdp.gallery`
- [ ] Form validation (RHF + Zod)
- [ ] Retain existing archive triggers (no change needed)

### Phase 3 — Verification Officer Module (Week 3–4)

- [ ] Verification queue dashboard
- [ ] Indicator review page (verified values form)
- [ ] Approve flow (sets `verified_by`, `verified_date`, `verified_percentage`)
- [ ] Reject flow (remarks → back to officer with notification)
- [ ] Gallery verification (approve/reject per media)
- [ ] Secretary-wise reports

### Phase 4 — Admin Module (Week 4–5)

- [ ] User management (CRUD + activate/deactivate)
- [ ] Admin password reset (both flows)
- [ ] Master project management
- [ ] Aggregate reports + CSV export
- [ ] Audit log viewer
- [ ] System health indicators

### Phase 5 — Public Dashboard & Polish (Week 5–6)

- [ ] Public `/` dashboard (no login, uses `at_a_glance` view)
- [ ] District/secretary-wise progress views
- [ ] `indicators_stages` view for public reporting
- [ ] Malayalam label rendering (`project_name_mal`, `secretary_name_mal`)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Responsive design (mobile for field officers)
- [ ] VAPT re-assessment (schedule before go-live)
- [ ] UAT with Nodal Officers and Verification Officers

---

## 13. USING COWORK TO READ LEGACY SCREENS

### Step 1: Open Cowork in Claude Desktop

Click **Cowork** in the left sidebar → New Space → Name it "HDP Rebuild"

### Step 2: Add your screens folder as a trusted path

```
Settings → Trusted Folders → Add:
[your local screens folder path]
e.g. D:\Projects\HDP\legacy-screens\
```

### Step 3: Reference this blueprint as context

Drag `HDP_Platform_Blueprint_v2.md` into the Cowork space.

### Step 4: Ask Claude to map legacy screens to new pages

```
Read all screenshots in [path to screens folder].
For each screen, identify:
  1. The URL or page title visible
  2. All form fields and their labels (including Malayalam labels)
  3. The workflow step it represents
  4. Which user role (Nodal Officer / Verification Officer / Admin) uses it

Map each screen to the corresponding page in HDP_Platform_Blueprint_v2.md
and flag any fields visible in the screens that are NOT in the blueprint.
```

### Step 5: Generate components with 21st.dev Magic

With Magic MCP running in Claude Desktop, use the `/ui` prompts from Section 11
to generate production-ready components for each page.

---

## 14. OPEN ISSUES & ASSUMPTIONS

| #   | Issue                            | Decision Needed                                                                         |
| --- | -------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | **Password migration**           | When to run migration script on prod DB? Needs maintenance window                       |
| 2   | **SMS for password reset**       | Which SMS gateway? (MSG91 / CDAC / Kerala IT)                                           |
| 3   | **Current phase data**           | Which phase is active? Needed to scope Drizzle queries                                  |
| 4   | **`random_password()` function** | Legacy DB function generates 6-char alphanumeric — retire after bcrypt migration        |
| 5   | **`_2` duplicate tables**        | `govt_employee_details_2`, `private_employee_details_2` — clarify if active or archived |
| 6   | **File upload path**             | Retain year-specific uploads directory structure or move to S3-compatible?              |
| 7   | **VAPT reassessment**            | Last done April 2022 — must schedule before go-live                                     |
| 8   | **Malayalam input**              | Officers entering data — keyboard/font support on field devices?                        |
| 9   | **Session timeout**              | 8 hours proposed — confirm with CMO/DUK security policy                                 |
| 10  | **`at_a_glance` view**           | Currently defined as placeholder (all NULLs) — needs real query implementation          |

---

## APPENDIX A — REPORTING ARCHITECTURE

### A.1 Report Types

The HDP portal serves three core report dimensions, each pivoting on the same underlying data but sliced differently:

| Report                          | Primary Axis                          | Key Metrics                                                   | Used By                     |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------- | --------------------------- |
| Department-wise Summary         | Administrative Department (secretary) | Project count, completion %, indicator status, media counts   | CMO, Admin                  |
| Department-wise Project Details | Projects within a department          | Per-project indicator count, images/videos, completion status | Admin, Verification Officer |
| District-based Summary          | Kerala's 14 districts                 | Project distribution, indicator progress by geography         | CMO, Public                 |
| Completed Projects              | Completion status filter              | Project code, cost, nature, priority, completion date         | CMO, Public                 |

---

### A.2 Department-wise Summary Report

**Source:** Legacy CTE query joining `project_perc_based_on_status` view with multiple sub-queries  
**Page:** `/admin/reports/summary` (Admin) + `/public/summary` (Public read-only)

#### Columns (from actual Excel output)

| Column                                 | Source                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| Administrative Department              | `master_secretary.secretary_name`                      |
| Total number of projects               | COUNT from `project_perc` view                         |
| Completed Projects                     | WHERE `perc = 100`                                     |
| 0-25% completed                        | WHERE `perc BETWEEN 0 AND 25`                          |
| 25-50% completed                       | WHERE `perc BETWEEN 25.001 AND 50`                     |
| 50-100% completed                      | WHERE `perc BETWEEN 50.001 AND 99.999`                 |
| 100% completed                         | WHERE `perc = 100`                                     |
| Total projects with images             | COUNT DISTINCT from `gallery` WHERE `gallery_type = 1` |
| Total images                           | COUNT from `gallery` WHERE `gallery_type = 1`          |
| Total projects with videos             | COUNT DISTINCT from `gallery` WHERE `gallery_type = 2` |
| Total videos                           | COUNT from `gallery` WHERE `gallery_type = 2`          |
| No of projects without indicators      | From `projects_without_indicators` view                |
| Total number of indicators             | COUNT from `indicators`                                |
| Indicators fully completed (Dept)      | WHERE `percentage = 100`                               |
| Indicators progress started (Dept)     | WHERE `percentage > 0 AND < 100`                       |
| Indicators not started (Dept)          | Total − completed − started                            |
| Indicators fully completed (Verified)  | WHERE `verified_percentage = 100`                      |
| Indicators progress started (Verified) | WHERE `verified_percentage > 0 AND < 100`              |
| Indicators not started (Verified)      | Total − verified_completed − verified_started          |
| Progress status                        | Derived: "No started" / "Started" / "Completed"        |

#### Dashboard UI for Summary Report

```
┌─────────────────────────────────────────────────────────────┐
│ [Filter Bar]  District ▼ | Status ▼ | Export CSV | Export PDF │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [4 KPI Cards]                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 1070     │ │ 706      │ │ 364      │ │ 47       │       │
│  │ Total    │ │ Completed│ │ Pending  │ │ Depts    │       │
│  │ Projects │ │ Projects │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                             │
│  [Progress Distribution Bar Chart - stacked by bucket]      │
│  ██████████░░░░ 0-25% | 25-50% | 50-100% | 100%            │
│                                                             │
│  [Data Table - sortable, paginated]                         │
│  Dept | Projects | Completed | 0-25% | 25-50% | 50-100%    │
│       | Indicators (Dept) | Indicators (Verified) | Media   │
│                                                             │
│  [Row click → drills down to project detail]                │
└─────────────────────────────────────────────────────────────┘
```

---

### A.3 Department-wise Project Details Report

**Source:** Legacy CTE with `indicator_details`, `cic`, `gall` sub-queries  
**Page:** `/admin/reports/department/[sec_id]` + `/verify/reports/[sec_id]`

#### Columns (from actual legacy query)

| Column                          | Source                                                 |
| ------------------------------- | ------------------------------------------------------ |
| Administrative Department       | `master_secretary.secretary_name`                      |
| Project (Malayalam)             | `master_projects.project_name_mal`                     |
| Total images                    | COUNT from `gallery` WHERE `gallery_type = 1`          |
| Total video                     | COUNT from `gallery` WHERE `gallery_type = 2`          |
| Indicator count                 | COUNT from `indicators` per project                    |
| Completed indicators (Verified) | WHERE `verified_percentage = 100`                      |
| Completed indicators (Dept)     | WHERE `percentage = 100`                               |
| Completion status               | CASE on `is_completed`: 1 = Incompleted, 2 = Completed |

#### UI: Expandable project rows

- Click department → shows all projects under it
- Each project row shows indicator count, media count, status badge
- Financial/physical achievement shown as progress bars

---

### A.4 Completed Projects Report

**Source:** `master_projects WHERE is_completed = 2`  
**Page:** `/admin/reports/completed` + `/public/completed`

#### Columns

| Column                    | Source                            | Notes                                                               |
| ------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Administrative Department | `master_secretary.secretary_name` |                                                                     |
| Project Code              | `master_projects.project_code`    | Auto-generated: `HDP-4-{project_id}`                                |
| Project Name              | `master_projects.project_name`    |                                                                     |
| Project Cost              | `master_projects.project_cost`    | Rs in Lakhs                                                         |
| Nature of Project         | `nature_of_project`               | 1 = ഉപജീവനം (Livelihood), else = പശ്ചാത്തല സൗകര്യം (Infrastructure) |
| Priority                  | `priority`                        | 1 = സംസ്ഥാനതലം, 2 = ജില്ലാതലം, 3 = ഉപജില്ലാതലം                      |
| Completion Date           | `completion_date`                 |                                                                     |

---

### A.5 District-based Report

**Source:** Join `indicators.district_id` → `master_district`  
**Page:** `/admin/reports/district` + `/public/districts/[districtPublicId]` (legacy alias: `/public/district/[id]`)

#### Metrics per District

- Total projects with indicators in that district
- Financial target vs achievement
- Physical target vs achievement
- Indicators completed / in-progress / not started
- Employment generated (direct + indirect, days + persons)

---

### A.6 Required Database Views (Retain or Recreate)

The legacy schema includes several views that the reporting queries depend on. These **must be retained or recreated** in the rebuild:

| View                               | Purpose                                                         | Action                                          |
| ---------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| `hdp.project_perc`                 | Per-project completion % (physical achievement)                 | RETAIN — used by summary queries                |
| `hdp.project_perc_based_on_status` | Department-wise aggregated status with project/indicator totals | RETAIN — primary summary data source            |
| `hdp.projects_without_indicators`  | Projects that have no indicators defined yet                    | RETAIN — gap analysis                           |
| `hdp.indicators_stages`            | Indicator lifecycle stages                                      | RETAIN — stage tracking                         |
| `hdp.at_a_glance`                  | Top-level dashboard view                                        | ⚠️ RECREATE — currently all NULLs (placeholder) |

#### Recommended: Implement `at_a_glance` view properly

```sql
CREATE OR REPLACE VIEW hdp.at_a_glance AS
SELECT
    ms.sec_id,
    ms.secretary_name_mal,
    COUNT(DISTINCT ps.project_id)                                 AS total_no_of_projects,
    COALESCE(SUM(mp.project_cost), 0)                             AS project_cost,
    COALESCE(SUM(i.financial_achievement), 0)                     AS financial_achievement,
    COUNT(DISTINCT ps.project_id)
        FILTER (WHERE mp.is_completed = 2)                        AS completed_projects,
    COUNT(i.indicator_id)                                          AS total_no_of_indicators,
    COUNT(i.indicator_id)
        FILTER (WHERE i.verified_percentage = 100)                AS total_no_of_indicators_fully_completed,
    COUNT(DISTINCT g_img.gallery_id)                               AS total_images,
    COUNT(DISTINCT g_vid.gallery_id)                               AS total_video
FROM hdp.master_secretary ms
LEFT JOIN hdp.project_secretary ps ON ms.sec_id = ps.sec_id
LEFT JOIN hdp.master_projects mp   ON ps.project_id = mp.project_id AND mp.stage = 1
LEFT JOIN hdp.indicators i         ON mp.project_id = i.project_id
LEFT JOIN hdp.gallery g_img        ON i.indicator_id = g_img.indicator_id AND g_img.gallery_type = 1
LEFT JOIN hdp.gallery g_vid        ON i.indicator_id = g_vid.indicator_id AND g_vid.gallery_type = 2
WHERE ms.is_used = TRUE
GROUP BY ms.sec_id;
```

---

### A.7 Drizzle ORM: Report Queries Strategy

For the complex CTE-based reports, use **Drizzle's `sql` raw helper** rather than trying to express 8-way CTE joins in the query builder:

```typescript
// lib/db/reports.ts
import { db } from "./client";
import { sql } from "drizzle-orm";

export async function getDepartmentSummary() {
  // Port the legacy CTE query directly — it's already optimized
  const result = await db.execute(sql`
    WITH a AS (...), b AS (...), c AS (...), ...
    SELECT ... FROM hdp.project_perc_based_on_status ppbos
    LEFT JOIN a ON ... LEFT JOIN b ON ...
    ORDER BY "Administrative Department"
  `);
  return result.rows;
}

export async function getProjectsByDepartment(secId: number) {
  const result = await db.execute(sql`
    WITH indicator_details AS (...), cic AS (...), gall AS (...)
    SELECT ... WHERE ps.sec_id = ${secId}
    ORDER BY project_name_mal
  `);
  return result.rows;
}

export async function getCompletedProjects() {
  const result = await db.execute(sql`
    SELECT mss.secretary_name, mp.project_code, mp.project_name,
           mp.project_cost,
           CASE WHEN nature_of_project = '1' THEN 'ഉപജീവനം'
                ELSE 'പശ്ചാത്തല സൗകര്യം' END AS nature_of_project,
           CASE WHEN priority = '1' THEN 'സംസ്ഥാനതലം'
                WHEN priority = '2' THEN 'ജില്ലാതലം'
                WHEN priority = '3' THEN 'ഉപജില്ലാതലം' END AS priority,
           date(mp.completion_date) as completion_date
    FROM hdp.master_projects mp
    LEFT JOIN hdp.project_secretary ps ON mp.project_id = ps.project_id
    LEFT JOIN hdp.master_secretary mss ON ps.sec_id = mss.sec_id
    WHERE mp.is_completed = 2
    ORDER BY mss.secretary_name
  `);
  return result.rows;
}
```

---

### A.8 Report API Routes (additions to Section 10)

| Method | Route                                | Role          | Report                              |
| ------ | ------------------------------------ | ------------- | ----------------------------------- |
| GET    | `/api/reports/summary`               | Admin, Public | Department-wise summary (all depts) |
| GET    | `/api/reports/summary?district_id=X` | Admin, Public | Filtered by district                |
| GET    | `/api/reports/department/[sec_id]`   | Admin, Verif  | Project details per department      |
| GET    | `/api/reports/completed`             | Admin, Public | Completed projects list             |
| GET    | `/api/reports/district`              | Admin, Public | District-based aggregation          |
| GET    | `/api/reports/district/[id]`         | Admin, Public | Single district detail              |
| GET    | `/api/reports/export/summary`        | Admin         | CSV/Excel export                    |
| GET    | `/api/reports/export/completed`      | Admin         | CSV/Excel export                    |

---

### A.9 Report UI — 21st.dev Magic Prompts

```
/ui create a government project summary dashboard table with these columns:
Department, Total Projects, Completed, 0-25%, 25-50%, 50-100%, 100%,
Images count, Videos count, Indicator status (completed/started/not started).
Include a stacked bar chart showing completion distribution per department.
Sortable columns, row click drills to detail. Kerala govt colors #003580 #C8A951.
Export CSV button in header. Tailwind + ShadCN UI.

/ui build a department detail page showing expandable project cards.
Each card shows: Project name (Malayalam), indicator count, completion badge,
financial/physical progress bars side by side, image/video count icons.
Filter bar with: Status dropdown, District dropdown. Kerala CMO color scheme.

/ui design a completed projects report table with columns: Department,
Project Code, Project Name, Cost (Rs Lakhs), Nature (Livelihood/Infrastructure),
Priority (State/District/Sub-district), Completion Date. Include Malayalam
labels for nature and priority values. Sortable, filterable, exportable.

/ui create a district-based summary view with a Kerala map outline showing
14 districts as clickable regions. Each region shows project count and
completion percentage. Click a district to see detailed project list below.
Color intensity based on completion % (lighter=less, darker=more complete).
```

---

### A.10 Summary Report — First Excel Reference

The Department_wise_Summary_Latest.xlsx also contains an additional structure with **Malayalam column headers** for cost breakdown:

| Column                           | Meaning                                         |
| -------------------------------- | ----------------------------------------------- |
| Department                       | Administrative department name                  |
| No.of Projects                   | Total project count                             |
| Total Project Cost (Rs in Lakhs) | Sum of `project_cost`                           |
| സംസ്ഥാനതലം                       | State-level priority projects (priority = 1)    |
| ജില്ലാതലം                        | District-level priority projects (priority = 2) |
| പദ്ധതി പൂർത്തികരണ                | Projects completed                              |
| നിർമ്മാണ ഉദ്ഘാടനം                | Construction inaugurations                      |

This confirms the public-facing summary needs **bilingual columns** (English + Malayalam) and the UI must properly render Malayalam text using **Noto Sans Malayalam** font.

---

### A.11 Updated Open Issues (Report-Specific)

| #   | Issue                                      | Decision Needed                                                                      |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| 11  | **`project_perc` view definition**         | Binary dump didn't expose the view SQL — need to extract from live DB                |
| 12  | **`project_perc_based_on_status` view**    | Same — need live DB SQL dump with `--schema-only` flag                               |
| 13  | **`is_completed` values**                  | Schema uses 0=Not started, 1=Incompleted(?), 2=Completed — confirm mapping           |
| 14  | **`nature_of_project` / `priority` enums** | Currently stored as integers with CASE in queries — consider lookup table or enum    |
| 15  | **Export format**                          | CSV only? Or Excel with Malayalam headers?                                           |
| 16  | **Public report access**                   | All reports public? Or only summary + completed?                                     |
| 17  | **`project_execution_type`**               | Referenced in `raw_master_projects` — confirm if still relevant                      |
| 18  | **Dual progress tracking**                 | Dept submits `percentage`, Verified as `verified_percentage` — both shown in reports |

---

## APPENDIX B — LEGACY SCREEN MAPPING

### Confirmed Enum Values (from DDL comments)

| Column                   | Value | Malayalam          | English                   |
| ------------------------ | ----- | ------------------ | ------------------------- |
| `is_completed`           | 0     | —                  | Not started               |
| `is_completed`           | 1     | —                  | Started (In Progress)     |
| `is_completed`           | 2     | —                  | Completed                 |
| `nature_of_project`      | 1     | ഉപജീവനം            | Livelihood                |
| `nature_of_project`      | 2     | പശ്ചാത്തല സൗകര്യം  | Infrastructure            |
| `priority`               | 1     | സംസ്ഥാനതലം         | State-level               |
| `priority`               | 2     | ജില്ലാതലം          | District-level            |
| `priority`               | 3     | ഉപജില്ലാതലം        | Sub-district-level        |
| `project_execution_type` | 1     | പദ്ധതി പൂർത്തികരണം | Project Completion        |
| `project_execution_type` | 2     | നിർമ്മാണ ഉദ്ഘാടനം  | Construction Inauguration |

### Confirmed Percentage Logic

```
Project completion %  = (completed_projects × 100) / total_projects
Indicator completion  = indicators_completed / indicators_added_per_project
```

Both are simple integer division ratios — no weighted or financial-based % calculation.

---

### B.1 Screen 1 — Public Home Dashboard (`/`)

**Legacy URL:** `100days.kerala.gov.in` (public, no login)  
**New Route:** `/` (public, no auth)

#### Header

| Legacy Element        | Malayalam Label                  | New Component                      |
| --------------------- | -------------------------------- | ---------------------------------- |
| Kerala emblem + title | കേരള സർക്കാർ \| 100 ദിന പദ്ധതികൾ | `<Header>` with emblem SVG + title |
| OFFICIAL LOGIN button | OFFICIAL LOGIN                   | Link to `/login`                   |
| HOME button           | HOME                             | Link to `/`                        |

#### Hero Banner

- CM photo + programme title in Malayalam
- Phase info: "2ാം പിണറായി സർക്കാർ മൂന്നാം വാർഷികം"
- Date range: "നൂറ്റിന പരിപാടി 2024 ജൂലൈ – ഒക്ടോബർ"
- **New:** Dynamically render phase dates from a config/DB setting

#### Section: 100 ദിന പദ്ധതികൾ (100 Day Programme Stats)

| Legacy Element         | Malayalam                        | Data Source                       | New Component         |
| ---------------------- | -------------------------------- | --------------------------------- | --------------------- |
| Completed days counter | പൂർത്തിയായ ദിനങ്ങൾ               | `CURRENT_DATE - phase_start_date` | Animated counter card |
| Remaining days counter | ബാക്കിയുള്ള ദിനങ്ങൾ              | `phase_end_date - CURRENT_DATE`   | Animated counter card |
| Date range display     | 2026 ജൂലൈ 15 മുതൽ ഒക്ടോബർ 22 വരെ | Phase config                      | Date range badge      |

#### Section: പദ്ധതി പുരോഗതി ഒറ്റ നോട്ടത്തിൽ (Project Progress at a Glance)

| Legacy Element          | Malayalam                    | Data Source                  | New Component         |
| ----------------------- | ---------------------------- | ---------------------------- | --------------------- |
| Total projects          | ആകെ പദ്ധതികൾ                 | COUNT from `master_projects` | Stat with icon        |
| 100% completed projects | 100% പൂർത്തിയാക്കിയ പദ്ധതികൾ | WHERE `is_completed = 2`     | Stat with icon        |
| Donut chart (0%)        | Progress donut               | `(completed / total) × 100`  | Recharts `<PieChart>` |

#### Section: പദ്ധതി ഘടകങ്ങൾ പുരോഗതി (Indicator Progress at a Glance)

| Legacy Element         | Malayalam                                                        | Data Source                               | New Component         |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------- | --------------------- |
| Total indicators       | ആകെ പദ്ധതി ഘടകങ്ങൾ                                               | COUNT from `indicators`                   | Stat row              |
| Completed indicators   | പൂർത്തിയാക്കിയ ഘടകങ്ങൾ                                           | WHERE `verified_percentage = 100`         | Stat row              |
| In-progress indicators | പൂർത്തീകരണം നടക്കുന്ന ഘടകങ്ങൾ                                    | WHERE `verified_percentage > 0 AND < 100` | Stat row              |
| Donut chart (100%)     | Progress donut                                                   | indicator completion ratio                | Recharts `<PieChart>` |
| Label below donut      | "ആവശ്യം : പൂർത്തീകരണം നടക്കുന്ന പദ്ധതിഘടകങ്ങളുടെ ശരാശരി പുരോഗതി" | Derived average                           | Caption text          |

#### Section: പദ്ധതിനിർവ്വഹണ പുരോഗതി (Execution Progress — Right Panel)

| Legacy Element       | Malayalam                      | Color            | Data Source                       |
| -------------------- | ------------------------------ | ---------------- | --------------------------------- |
| Total departments    | ആകെ വകുപ്പുകൾ                  | Blue card        | COUNT DISTINCT `master_secretary` |
| Launched projects    | ആകെ ഒഴുമ്പൊട്ട പദ്ധതികൾ        | Gold/star card   | COUNT from `master_projects`      |
| Completed projects   | പൂർത്തിയാക്കിയ പദ്ധതികൾ        | Green/check card | WHERE `is_completed = 2`          |
| In-progress projects | പൂർത്തീകരണം നടക്കുന്ന പദ്ധതികൾ | Gold/star card   | WHERE `is_completed = 1`          |
| Total indicators     | ആകെ പദ്ധതി ഘടകങ്ങൾ             | Grey/layers card | COUNT from `indicators`           |

**New component:** `<ExecutionProgressPanel>` — vertical stack of colored stat cards with icons

#### Section: വിവിധ തരം പദ്ധതികൾ (Projects by Type)

| Legacy Element                              | Malayalam                | Filter                  | New Component |
| ------------------------------------------- | ------------------------ | ----------------------- | ------------- |
| Infrastructure projects (count + completed) | പശ്ചാത്തല വികസന പദ്ധതികൾ | `nature_of_project = 2` | Two-stat card |
| Livelihood projects (count + completed)     | ഉപജീവനമാർഗ്ഗ പദ്ധതികൾ    | `nature_of_project = 1` | Two-stat card |

#### Section: District-wise Grid

| Legacy Element                                | Malayalam                            | Data Source                                     | New Component             |
| --------------------------------------------- | ------------------------------------ | ----------------------------------------------- | ------------------------- |
| 14 districts in grid                          | ഈർണാട് മേഖല, കൃഷി അനുബന്ധ മേഖല, etc. | JOIN `indicators.district_id → master_district` | Responsive grid cards     |
| Per-district: project count + indicator count | പദ്ധതികൾ / പദ്ധതി ഘടകങ്ങൾ            | Aggregated per `district_id`                    | Pair of counters per card |

#### Bottom Summary Bar

| Legacy Element                                     | Data Source                       |
| -------------------------------------------------- | --------------------------------- |
| ആകെ പദ്ധതികൾ (Total projects)                      | COUNT `master_projects`           |
| ₹ ആകെ പദ്ധതി തുക (Rs in Lakhs)                     | SUM `project_cost`                |
| പൂർത്തീകരിക്കേണ്ട പദ്ധതികൾ (Projects to complete)  | WHERE `is_completed != 2`         |
| പദ്ധതി ഘടകങ്ങൾ (Indicators)                        | COUNT `indicators`                |
| പൂർത്തീകരിക്കേണ്ട ഘടകങ്ങൾ (Indicators to complete) | WHERE `verified_percentage < 100` |

---

### B.2 Screen 2 — Department Project List (`/public/departments/[departmentPublicId]`)

**Legacy URL:** `?action=category&sec_id=X` (public, no login)  
**New Route:** `/public/departments/[departmentPublicId]` (legacy alias: `/public/department/[sec_id]`)

#### Breadcrumb

`ഹോം / ഭരണ വകുപ്പ്` → Home / Administrative Department

#### Info Alerts (Malayalam)

Two alert banners explaining:

1. Physical progress = completed indicators / total indicators per project
2. This phase's date context (100-day cycle details)

**New:** Render these as `<Alert>` components with `variant="info"`

#### Project Card (repeating per project)

| Legacy Element           | Malayalam                               | Data Source                         | New Component         |
| ------------------------ | --------------------------------------- | ----------------------------------- | --------------------- |
| Project name             | —                                       | `master_projects.project_name`      | Card title            |
| Status badge             | "In Progress"                           | Derived from `is_completed`         | `<StatusBadge>`       |
| Nature tags              | ഉപജീവനമാർഗ്ഗം / പശ്ചാത്തല സൗകര്യ വികസനം | `nature_of_project` CASE            | Colored tag pills     |
| Project cost             | ആകെ പദ്ധതി തുക                          | `project_cost` (Lakhs)              | Stat display          |
| Total indicators         | ആകെ പദ്ധതി ഘടകങ്ങൾ                      | COUNT `indicators` per project      | Stat display          |
| "View indicators" button | ഘടകങ്ങൾ കാണുക →                         | Link to indicator detail            | Button/Link           |
| Image count badge        | Green icon with count                   | COUNT from `gallery` WHERE `type=1` | Badge on project name |
| Video count badge        | Red icon with count                     | COUNT from `gallery` WHERE `type=2` | Badge on project name |

#### Progress Sub-section (per project card)

| Legacy Row                         | Malayalam                 | Data Source                                                         |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| **Progress Updated by Department** |                           |                                                                     |
| Completed indicators               | പൂർത്തിയായ പദ്ധതി ഘടകങ്ങൾ | WHERE `percentage = 100`                                            |
| Physical progress %                | ഭൗതിക പുരോഗതി             | `(completed_indicators / total_indicators) × 100`                   |
| Financial progress %               | സാമ്പത്തിക പുരോഗതി        | `(SUM financial_achievement / SUM financial_target) × 100`          |
| **Verified Progress**              |                           |                                                                     |
| Completed indicators (verified)    | പൂർത്തിയായ പദ്ധതി ഘടകങ്ങൾ | WHERE `verified_percentage = 100`                                   |
| Physical progress % (verified)     | ഭൗതിക പുരോഗതി             | Same formula using verified counts                                  |
| Financial progress % (verified)    | സാമ്പത്തിക പുരോഗതി        | `(SUM verified_financial_achievement / SUM financial_target) × 100` |

**New component:** `<ProjectProgressCard>` with two-row layout (Dept vs Verified), progress bars, and badges

#### Controls

| Legacy                           | New                                    |
| -------------------------------- | -------------------------------------- |
| "Show \_\_\_ entries" dropdown   | ShadCN `<Select>` for page size        |
| "Search:" text input             | ShadCN `<Input>` with debounced filter |
| Pagination (Previous / 1 / Next) | ShadCN `<Pagination>`                  |

---

### B.3 Screen 3 — Indicator Detail (`/public/departments/[departmentPublicId]/projects/[projectPublicId]`)

**Legacy URL:** `?action=project_details&project_id=X`  
**New Route:** `/public/departments/[departmentPublicId]/projects/[projectPublicId]` (legacy alias: `/public/department/[sec_id]/project/[project_id]`)

#### Breadcrumb

`ഹോം / ഭരണ വകുപ്പ് / പ്രോജക്ട് വിശദാംശങ്ങൾ`

#### Project Header

| Element                     | Data Source                    |
| --------------------------- | ------------------------------ | -------------------- |
| Project name                | `master_projects.project_name` |
| "View images/videos" button | ചിത്രങ്ങൾ / വീഡിയോകൾ കാണുക →   | Link to gallery page |

#### Indicator Card (repeating per indicator under project)

| Legacy Element        | Malayalam             | Data Source                                         | New Component                |
| --------------------- | --------------------- | --------------------------------------------------- | ---------------------------- |
| Indicator name        | ഘടകം : [name]         | `indicators.indicator_name`                         | Card header                  |
| Videos button + count | വീഡിയോകൾ              | COUNT `gallery` WHERE `type=2, indicator_id`        | Icon button with badge       |
| Images button + count | ചിത്രങ്ങൾ             | COUNT `gallery` WHERE `type=1, indicator_id`        | Icon button with badge       |
| Physical progress     | ഭൗതിക പുരോഗതി         | `physical_achievement`                              | Progress bar + value         |
| Financial progress    | സാമ്പത്തിക പുരോഗതി    | `financial_achievement`                             | Progress bar + value         |
| District card         | District : [name]     | `master_district.district_name` via `district_id`   | Yellow info card             |
| Location card         | Latitude \| Longitude | `latitude`, `longitude`                             | Green info card with map pin |
| Beneficiaries         | ⭐ ഗുണഭോക്താക്കൾ      | `master_beneficiary` via `indicators.beneficiary[]` | Colored tag pills            |

**Beneficiary tags observed:** സ്ത്രീകൾ (Women), കുട്ടികൾ (Children)

**New component:** `<IndicatorDetailCard>` with left panel (progress bars) + right panel (district + location + beneficiaries)

---

### B.4 Screen 4 — Media Gallery (`/public/gallery/projects/[projectPublicId]`)

**Legacy URL:** `?action=gallery&project_id=X`  
**New Route:** `/public/gallery/projects/[projectPublicId]` (legacy alias: `/public/gallery/[project_id]`)

#### Layout

| Legacy Element          | Malayalam                   | Data Source                      | New Component            |
| ----------------------- | --------------------------- | -------------------------------- | ------------------------ |
| Project info header     | PROJECT INFORMATION         | `master_projects.project_name`   | Page header              |
| Status badge            | "In Progress"               | `is_completed`                   | `<StatusBadge>`          |
| Tab: Images             | ചിത്രങ്ങൾ                   | `gallery WHERE gallery_type = 1` | Tab trigger              |
| Tab: Videos             | വീഡിയോകൾ                    | `gallery WHERE gallery_type = 2` | Tab trigger              |
| Accordion per indicator | Indicator name (expandable) | `indicators.indicator_name`      | ShadCN `<Accordion>`     |
| Image thumbnails        | —                           | `gallery.image_path`             | Image grid with lightbox |
| Image description       | "Testing" etc.              | `gallery.description`            | Caption below thumbnail  |
| "BACK TO HOME" button   | —                           | —                                | Navigation link          |

**New component:** `<MediaGallery>` with tab switcher (images/videos) + accordion per indicator + lightbox viewer

---

### B.5 Complete Public Navigation Flow

```
/ (Home Dashboard)
  ├── Stats: days remaining, project/indicator totals, donut charts
  ├── Execution progress cards
  ├── Projects by type (Infrastructure vs Livelihood)
  ├── District-wise grid
  │     └── Click district → /public/districts/[districtPublicId]
  ├── Bottom summary bar
  └── Click department card → /public/departments/[departmentPublicId]
        ├── Project cards with progress (Dept vs Verified)
        │     └── "ഘടകങ്ങൾ കാണുക →" → /public/departments/[departmentPublicId]/projects/[projectPublicId]
        │           ├── Indicator detail cards (progress bars, district, beneficiaries)
        │           └── "ചിത്രങ്ങൾ/വീഡിയോകൾ →" → /public/gallery/projects/[projectPublicId]
        │                 └── Tabbed image/video gallery per indicator
        └── Search + pagination
```

---

### B.6 Updated Route Table (Public Pages)

| Route                                                                 | Page                      | Legacy Equivalent                                                                                         |
| --------------------------------------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                                                   | Public home dashboard     | `index.jsp` / main page                                                                                   |
| `/public/departments/[departmentPublicId]`                            | Department project list   | `?action=category&sec_id=X` (legacy alias: `/public/department/[sec_id]`)                                 |
| `/public/departments/[departmentPublicId]/projects/[projectPublicId]` | Project indicator details | `?action=project_details&project_id=X` (legacy alias: `/public/department/[sec_id]/project/[project_id]`) |
| `/public/gallery/projects/[projectPublicId]`                          | Photo/video gallery       | `?action=gallery&project_id=X` (legacy alias: `/public/gallery/[project_id]`)                             |
| `/public/districts/[districtPublicId]`                                | District-wise view        | New (legacy alias: `/public/district/[district_id]`)                                                      |
| `/public/completed`                                                   | Completed projects report | New (was SQL-only)                                                                                        |
| `/login`                                                              | Official login            | `?action=login`                                                                                           |

---

### B.7 UI Components to Generate with 21st.dev Magic

Based on the legacy screens, these are the exact Magic MCP prompts to recreate each screen:

```
/ui create a Kerala government "100 Days Programme" public home dashboard with:
- Dark green header bar with Kerala emblem, "കേരള സർക്കാർ | 100 ദിന പദ്ധതികൾ" title,
  "OFFICIAL LOGIN" and "HOME" buttons on right
- Hero banner section (placeholder for CM photo)
- Three-column layout below:
  LEFT: Day counter cards (completed days / remaining days) with calendar icons
  CENTER: "Project Progress at a Glance" with two donut charts (Recharts PieChart)
    showing project % and indicator %
  RIGHT: Vertical stack of 5 colored stat cards (departments, launched, completed,
    in-progress, total indicators) with icons
- "Projects by Type" row: Infrastructure vs Livelihood counts
- District-wise responsive grid (14 Kerala districts), each card showing
  project count + indicator count
- Bottom summary bar with totals
Colors: header green #2E7D32, accent gold #C8A951, cards use green/gold/blue.
Malayalam font: Noto Sans Malayalam. Tailwind + ShadCN.

/ui create a government project list page with:
- Green breadcrumb bar showing "ഹോം / ഭരണ വകുപ്പ്"
- Two info alert banners (yellow/info variant)
- Search input + "Show entries" dropdown
- Repeating project cards, each containing:
  - Project name as title + "In Progress"/"Completed" status badge
  - Nature tags as colored pills (ഉപജീവനം green, പശ്ചാത്തല സൗകര്യം blue)
  - Stats row: project cost (Lakhs), total indicators count
  - "ഘടകങ്ങൾ കാണുക →" button
  - Two progress sections stacked:
    "Progress Updated by Department" with completed count + physical % + financial %
    "Verified Progress" (green background) with same metrics
- Pagination at bottom
Kerala govt green header, Noto Sans Malayalam, Tailwind + ShadCN.

/ui create an indicator detail page with:
- Breadcrumb: "ഹോം / ഭരണ വകുപ്പ് / പ്രോജക്ട് വിശദാംശങ്ങൾ"
- Project name header with "View images/videos" button
- Repeating indicator cards containing:
  LEFT panel: progress bars for ഭൗതിക പുരോഗതി (physical) and
    സാമ്പത്തിക പുരോഗതി (financial) with numeric values
  RIGHT panel: District info card (yellow), Location card (green) with
    lat/lng, Beneficiary tag pills (colored: സ്ത്രീകൾ, കുട്ടികൾ etc.)
- Media count buttons (videos + images) with badge counts
Kerala green theme, Noto Sans Malayalam, Tailwind + ShadCN.

/ui create a project media gallery page with:
- Green header "PROJECT INFORMATION" with project name and status badge
- Two tabs: "ചിത്രങ്ങൾ" (Images) and "വീഡിയോകൾ" (Videos)
- Under each tab: accordion sections per indicator name
- Image grid with thumbnails (aspect-ratio preserved) and caption text below
- Lightbox on image click (full-size viewer with prev/next)
- "BACK TO HOME" button in header
Kerala govt styling, Tailwind + ShadCN.
```

---

## APPENDIX C — AUTHENTICATED SCREEN MAPPING (Officer, Verifier, Admin)

### C.1 Nodal Officer — Project List (`/officer/projects`)

**Screen:** `1_Data_entry_Login__1.png`  
**Header:** "Welcome, Nodal Officer, Animal Husbandry ▼"  
**Nav:** Header only (no sidebar) — role name + department in top-right dropdown

| Legacy Element                     | Data Source                                                 | New Component                           |
| ---------------------------------- | ----------------------------------------------------------- | --------------------------------------- |
| "PROJECT DETAILS" heading          | —                                                           | Page title                              |
| Show entries + Search              | —                                                           | `<Select>` + `<Input>`                  |
| Table: Sl. No, Project Name        | `master_projects` filtered by officer's `sec_id`            | ShadCN `<Table>`                        |
| Project name + code                | `project_name` + `project_code` (HDP-4-1134)                | Table cell                              |
| Project Cost (green text)          | `project_cost` in lakhs                                     | Colored subtitle                        |
| Direct Employment card             | `no_days_employed_direct`, `no_persons_employed_direct`     | Dark gold card: DAYS: 100, PERSONS: 50  |
| Indirect Employment card           | `no_days_employed_indirect`, `no_persons_employed_indirect` | Dark gold card: DAYS: 200, PERSONS: 100 |
| "ADD/VIEW/EDIT INDICATOR →" button | Link to indicator details                                   | Primary action button                   |
| Pagination                         | —                                                           | `<Pagination>`                          |

**New Route:** `/officer/projects` → shows only projects linked to officer's `sec_id` via `project_secretary`

---

### C.2 Nodal Officer — Indicator Details Table (`/officer/projects/[project_id]/indicators`)

**Screen:** `2__Data_entry_Login_update_page_.png`  
**Shows:** Project info header + indicator table with action buttons

#### Project Info Header

| Element                                 | Data Source                                        |
| --------------------------------------- | -------------------------------------------------- |
| PROJECT NAME with code + Malayalam name | `project_name`, `project_code`, `project_name_mal` |
| "In Progress" badge                     | `is_completed` → CASE                              |
| Project Cost (green badge)              | `project_cost`                                     |
| Employment stats (4 green badges)       | `no_days/persons_employed_direct/indirect`         |

#### Indicator Table Columns

| Column                                   | Data Source                                       | Type                              |
| ---------------------------------------- | ------------------------------------------------- | --------------------------------- |
| Sl.No                                    | Row number                                        | Display                           |
| Indicator                                | `indicator_name`                                  | Text                              |
| Edit                                     | —                                                 | EDIT button (opens edit form)     |
| Unit of Measurement                      | `unit`                                            | Text ("Percentage")               |
| Implementation in                        | `master_district.district_name` via `district_id` | Text                              |
| Physical Achievement / Physical Target   | `physical_achievement` / `physical_target`        | "0/100 (Unit: Percentage)"        |
| Financial Achievement / Financial Target | `financial_achievement` / `financial_target`      | "0.0/5000.0 (in Lakhs)"           |
| Completed Date                           | `completed_date`                                  | Date or "Not Updated"             |
| Update                                   | —                                                 | "UPDATE PROGRESS →" button        |
| Upload                                   | —                                                 | "UPLOAD IMAGE/DOCUMENTS →" button |
| Embed Video                              | —                                                 | "EMBED VIDEO →" button            |

#### Action Buttons (per indicator row)

| Button                   | Target                      | New Route                           |
| ------------------------ | --------------------------- | ----------------------------------- |
| EDIT                     | Edit indicator metadata     | `/officer/indicators/[id]/edit`     |
| UPDATE PROGRESS →        | Update achievement values   | `/officer/indicators/[id]/progress` |
| UPLOAD IMAGE/DOCUMENTS → | Upload to gallery/documents | `/officer/indicators/[id]/upload`   |
| EMBED VIDEO →            | Paste YouTube/FB embed code | `/officer/indicators/[id]/video`    |

#### Extra

- "ADD NEW INDICATOR" button (top-right of table) → `/officer/indicators/new?project_id=X`
- Success toast: "Indicator details Updated Successfully" (green alert, dismissible)

---

### C.3 Nodal Officer — Update Progress Form (`/officer/indicators/[id]/progress`)

**Screen:** `5_update_indicator_progress.png`  
**Title:** "UPDATE INDICATOR PROGRESS DETAILS"

#### Read-Only Header

| Field            | Data Source                              |
| ---------------- | ---------------------------------------- |
| Project Name     | `master_projects.project_name`           |
| Indicator Name   | `indicators.indicator_name`              |
| Physical Target  | `indicators.physical_target` + `unit`    |
| Financial Target | `indicators.financial_target` (in Lakhs) |

#### Editable Fields (4-column grid layout)

| Field                              | Label                                         | Column                                  | Maps to      |
| ---------------------------------- | --------------------------------------------- | --------------------------------------- | ------------ |
| Physical Achievement               | (in Percentage)                               | `indicators.physical_achievement`       | Number input |
| Percentage of Physical Achievement | (%)                                           | Auto-calculated                         | Read-only    |
| Financial Achievement              | —                                             | `indicators.financial_achievement`      | Number input |
| Completed Date                     | (dd/mm/yyyy) — "100% പൂർത്തീകരണം നടന്ന ദിവസം" | `indicators.completed_date`             | Date picker  |
| Direct (No. of days)               | —                                             | `achieved_no_days_employed_direct`      | Number input |
| Direct (No. of Persons)            | —                                             | `achieved_no_persons_employed_direct`   | Number input |
| In Direct (No. of days)            | —                                             | `achieved_no_days_employed_indirect`    | Number input |
| In Direct (No. of Persons)         | —                                             | `achieved_no_persons_employed_indirect` | Number input |
| Physical Achievement Description   | Textarea                                      | `indicators.physical_description`       | Textarea     |

**Completed Date note:** Malayalam label says "100% പൂർത്തീകരണം നടന്ന ദിവസം" — only to be set when 100% complete.

**Action:** [SUBMIT] button → updates `indicators` row, sets `submitted_by` + `submitted_date`

---

### C.4 Nodal Officer — Upload Gallery (`/officer/indicators/[id]/upload`)

**Screen:** `4_update_gallery.png`

#### Read-Only Header

| Field           | Value                  |
| --------------- | ---------------------- |
| Project Name    | From `master_projects` |
| Indicator Name  | From `indicators`      |
| Physical Target | Target + unit          |

#### Upload Section

| Element              | Detail                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Format instructions  | "Step1: Choose file [Format Supported: .jpg, .jpeg, .png, .pdf] Maximum File Supported: 5MB" |
| "CHOOSE FILE" button | File picker                                                                                  |
| Description textarea | Maps to `gallery.description` or `documents.description`                                     |
| "UPLOAD" button      | POST to upload API                                                                           |

#### Image Gallery (below upload)

- Shows existing uploaded images as thumbnails
- "Images not uploaded!" warning if empty (yellow alert)

#### Document Details (below gallery)

- Shows uploaded documents (from `hdp.documents` table)
- "Documents not uploaded!" warning if empty

**New component:** `<MediaUploadForm>` with drag-drop zone + existing gallery grid + document list

---

### C.5 Nodal Officer — Embed Video (`/officer/indicators/[id]/video`)

**Screen:** `5_update_video_gallery.png`

#### Read-Only Header

Same as upload page (Project Name, Indicator Name, Physical Target)

#### Embed Section

| Element                     | Detail                                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Instructions (Malayalam)    | "നിങ്ങൾ സോഷ്യൽ മീഡിയയിൽ (Facebook / Youtube) അപ്ലോഡ് ചെയ്ത വീഡിയോയുടെ ലിങ്ക് കോപ്പി ചെയ്തിനു ശേഷം ലിങ്ക് ഇവിടെ നൽകേണ്ടതാണ്" |
| "HOW TO EMBED VIDEO" button | Info modal/tooltip with instructions                                                                                        |
| Textarea                    | "Paste embed video code here"                                                                                               |
| "EMBED VIDEO" button        | Saves to `gallery` with `gallery_type = 2`                                                                                  |

#### Video Gallery (below)

- "Video not uploaded!" warning if empty

**Key insight:** Videos are NOT uploaded as files — they're YouTube/Facebook **embed codes**. The `gallery.image_path` stores the embed URL/code for videos.

---

### C.6 Verification Officer — Dashboard/Project List (`/verify/projects`)

**Screen:** `6_Verifier_dashboard.png`  
**Header:** "Welcome, Verification officer, Animal Husbandry ▼"  
**Nav items:** "Verification Dashboard" | "Report ▼" | Welcome dropdown

#### Table Columns

| Column       | Data Source                                        |
| ------------ | -------------------------------------------------- |
| Sl. No       | Row number                                         |
| Project Code | `project_code` (HDP-4-1134)                        |
| Project Name | `project_name` + status badge + verification alert |
| Actions      | "VERIFY PROGRESS →" button                         |

#### Project Row Content

| Element                                    | Detail                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Project name                               | Text                                                                                      |
| "In Progress" badge                        | `is_completed` status                                                                     |
| "Verification is required for 1 indicator" | Red badge — COUNT indicators WHERE `verified_date IS NULL AND submitted_date IS NOT NULL` |
| Direct Employment card (dark gold)         | DAYS: 100, PERSONS: 50                                                                    |
| Indirect Employment card (dark gold)       | DAYS: 200, PERSONS: 100                                                                   |
| "VERIFY PROGRESS →" button                 | Links to indicator verification page                                                      |

---

### C.7 Verification Officer — Indicator Table (`/verify/projects/[project_id]`)

**Screen:** `6_Verifier_for_a_project_png.png`

#### Project Header

- PROJECT NAME with code + "In Progress" badge
- "VERIFY ALL INDICATORS" button (top-right) — bulk verify action

#### Indicator Table Columns

| Column                     | Data Source                                                       |
| -------------------------- | ----------------------------------------------------------------- |
| Sl.No                      | Row number                                                        |
| Indicator                  | `indicator_name`                                                  |
| Unit of Measurement        | `unit`                                                            |
| Physical Target            | `physical_target`                                                 |
| Physical Achievement       | `physical_achievement`                                            |
| Financial Target           | `financial_target`                                                |
| Financial Achievement      | `financial_achievement`                                           |
| Achievement Details        | `physical_description` or detail value                            |
| Implementation District    | `master_district.district_name`                                   |
| Verify & Approve           | "VERIFY & APPROVE" button (green)                                 |
| Verification/Update Status | "Last Updated On [date] Not Verified" / "Last Verified On [date]" |
| Upload                     | "UPLOAD IMAGE/DOCUMENTS →"                                        |
| Embed Video                | "EMBED VIDEO →"                                                   |

**Key:** Verifier can also upload images/documents and embed videos — same as Nodal Officer

---

### C.8 Verification Officer — Verify & Approve Form (`/verify/indicators/[id]`)

**Screen:** `7_Verifier_for_a_project_-_Update.png`  
**This is the most complex form — full indicator detail with editable verification fields**

#### Indicator Table (top — same as C.7, collapsed)

#### VIEW INDICATOR DETAILS (full form below table)

**Read-only fields (Nodal Officer's submitted values):**
| Field | Value shown |
|---|---|
| Indicator Name | "Test" |
| Unit | "Percentage" (dropdown, read-only) |
| Implementation District | "Thiruvananthapuram" (dropdown, read-only) |
| Physical Target | 100 |
| Physical achievement | 24 |
| Financial Target | 5000.0 |
| Financial achievement | 4.0 |

**Editable Verification Fields:**

_Employment Generation - Target (read-only, from project):_
| Field | Value |
|---|---|
| Direct (No. of days) | 23 |
| Direct (No. of persons) | 23 |
| Indirect (No. of days) | 23 |
| Indirect (No. of persons) | 23 |

_Employment Generation - Achievement (editable by verifier):_
| Field | Maps to |
|---|---|
| Direct (No. of days) | `verified_achieved_no_days_employed_direct` |
| Direct (No. of persons) | `verified_achieved_no_persons_employed_direct` |
| Indirect (No. of days) | `verified_achieved_no_days_employed_indirect` |
| Indirect (No. of persons) | `verified_achieved_no_persons_employed_indirect` |

_Other editable:_
| Field | Maps to |
|---|---|
| Physical achievement Description | `verified_physical_description` |
| Completed Date | Verification completion date |

**Action:** [VERIFY & APPROVE] button → sets `verified_by`, `verified_date`, `verified_percentage`, and all `verified_*` fields

#### IMAGE GALLERY (below form)

- Shows uploaded images with "UPLOAD IMAGE/DOCUMENTS →" button
- Verifier can upload additional evidence

#### DOCUMENT DETAILS

- "Documents not uploaded!" if empty

---

### C.9 Verification Officer — Verify All Indicators Modal

**Screen:** `9.png` (confirmation dialog)

| Element        | Detail                                         |
| -------------- | ---------------------------------------------- |
| Modal title    | "Confirm" (with key icon)                      |
| Content        | "Project Name : Test Project Animal Husbandry" |
| Checkbox/label | "✓ Verify All indicators"                      |
| Actions        | [CONFIRM] (blue) + [CLOSE] (red)               |

**Logic:** Bulk-approves all indicators for the project — sets `verified_*` fields to match department-submitted values. Shows updated timestamps after confirm.

**New component:** ShadCN `<AlertDialog>` with confirm/cancel

---

### C.10 Admin — Add/Edit Project Form (`/admin/projects/new` or `/admin/projects/[id]/edit`)

**Screen:** `Add_Project.png`  
**Header:** "Welcome, Administrator ▼" with "Dashboard" nav link

#### Form Fields (all map to `hdp.master_projects`)

| Field                                      | Label                           | Required | Type                                             | Maps to                                 |
| ------------------------------------------ | ------------------------------- | -------- | ------------------------------------------------ | --------------------------------------- |
| Project Name                               | Project Name\*                  | ✅       | Text input                                       | `project_name`                          |
| Description                                | Description\*                   | ✅       | Textarea                                         | `description`                           |
| Project Type                               | Project Type (New/Continuing)\* | ✅       | Dropdown: New / Continuing                       | `is_new`                                |
| Total Project Cost                         | (Rs in Lakhs)                   | ✅       | Number                                           | `project_cost`                          |
| Nature of project                          | Nature of project\*             | ✅       | Dropdown: പശ്ചാത്തല സൗകര്യ വികസനം / ഉപജീവനം      | `nature_of_project`                     |
| Project Impact/Visibility/Area             | \*                              | ✅       | Dropdown: ഉപജില്ലാതലം / ജില്ലാതലം / സംസ്ഥാനതലം   | `priority`                              |
| Employment Opportunity-Direct (Man Days)   |                                 |          | Number                                           | `no_days_employed_direct`               |
| Employment Opportunity-Direct (Persons)    |                                 |          | Number                                           | `no_persons_employed_direct`            |
| Employment Opportunity-Indirect (Man Days) |                                 |          | Number                                           | `no_days_employed_indirect`             |
| Employment Opportunity-Indirect (Persons)  |                                 |          | Number                                           | `no_persons_employed_indirect`          |
| Other benefits                             |                                 |          | Textarea                                         | `other_benefits`                        |
| Linkage with Govt. policy                  |                                 |          | Textarea                                         | `govt_policy_linkage`                   |
| Linkage with Manifesto                     |                                 |          | Textarea                                         | `manifesto_linkage`                     |
| Extra 1 / Extra 2 / Extra 3                |                                 |          | Textarea                                         | `extra_one`, `extra_two`, `extra_three` |
| Project Status                             | Project Status\*                | ✅       | Dropdown: In Progress / Completed / Not Started  | `is_completed` (0/1/2)                  |
| Completed Date                             | (dd/mm/yyyy)                    |          | Date picker                                      | `completion_date`                       |
| Administrative departments                 | \*                              | ✅       | Dropdown: from `master_secretary`                | `sec_id` via `project_secretary`        |
| Sector                                     | Sector\*                        | ✅       | Dropdown: from `master_sector`                   | `sector_id`                             |
| Project execution type                     | \*                              | ✅       | Dropdown: നിർമ്മാണ ഉദ്ഘാടനം / പദ്ധതി പൂർത്തികരണം | `project_execution_type`                |

**Action:** [SUBMIT] → creates/updates `master_projects` + `project_secretary` link  
**Back:** "← BACK TO DEPARTMENT DETAILS"

---

### C.11 Complete Authenticated Navigation Flow

```
LOGIN (/login)
  │
  ├── Nodal Officer (role_id = 2)
  │     └── /officer/projects (project list for my sec_id)
  │           └── /officer/projects/[pid]/indicators (indicator table)
  │                 ├── ADD NEW INDICATOR → /officer/indicators/new
  │                 ├── EDIT → /officer/indicators/[id]/edit
  │                 ├── UPDATE PROGRESS → /officer/indicators/[id]/progress
  │                 ├── UPLOAD IMAGE/DOCUMENTS → /officer/indicators/[id]/upload
  │                 └── EMBED VIDEO → /officer/indicators/[id]/video
  │
  ├── Verification Officer (role_id = 1)
  │     └── /verify/projects (project list with verification alerts)
  │           └── /verify/projects/[pid] (indicator table + verify buttons)
  │                 ├── VERIFY & APPROVE → /verify/indicators/[id] (full form)
  │                 ├── VERIFY ALL INDICATORS → confirmation modal
  │                 ├── UPLOAD IMAGE/DOCUMENTS → /verify/indicators/[id]/upload
  │                 ├── EMBED VIDEO → /verify/indicators/[id]/video
  │                 └── Report ▼ (dropdown in nav)
  │
  └── Admin (role_id = 3)
        └── /admin/dashboard
              ├── /admin/projects (department → project list)
              │     ├── ADD PROJECT → /admin/projects/new
              │     └── EDIT PROJECT → /admin/projects/[id]/edit
              ├── /admin/users (user management + password reset)
              └── /admin/reports (summary, department, completed)
```

---

### C.12 Key Insights from Authenticated Screens

| Finding                                                | Impact on Blueprint                                                                                        |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Videos are embed codes, not file uploads**           | `gallery.image_path` stores YouTube/FB embed URL for `gallery_type = 2` — no video file storage needed     |
| **Verifier can also upload media**                     | Both Officer and Verifier have UPLOAD and EMBED VIDEO buttons — same upload component reused               |
| **"VERIFY ALL INDICATORS" bulk action**                | One-click approval of all indicators in a project — copies dept values to verified fields                  |
| **Employment fields split into Target vs Achievement** | Target = from `master_projects`, Achievement = from `indicators` (dept-submitted then verified)            |
| **Project form has `extra_one/two/three`**             | Free-text fields — carry forward as-is, label as "Additional Information 1/2/3"                            |
| **Project code auto-generated**                        | `HDP-4-{project_id}` via `update_project_code()` trigger — retain trigger                                  |
| **Dropdown options in Malayalam**                      | Nature, Priority, Execution Type dropdowns show Malayalam text — use bilingual labels                      |
| **`is_new` field**                                     | "Project Type: New/Continuing" dropdown — boolean in DB but displayed as dropdown                          |
| **Achievement % auto-calculated**                      | "Percentage of Physical Achievement" shown as read-only = `(physical_achievement / physical_target) × 100` |
| **Completed Date conditional**                         | Only enabled/relevant when indicator is 100% complete                                                      |
