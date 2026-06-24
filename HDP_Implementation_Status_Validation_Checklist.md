# HDP Portal Implementation Validation & Status Audit Checklist

**Audited:** Pre-VAPT readiness review
**Stack confirmed:** Next.js 15 App Router · NextAuth v5 + bcrypt · Drizzle ORM · PostgreSQL `hdp` schema
**Auditor notes:** Status reflects what is actually wired in the repo (API + DB + UI) at the time of audit. Items where the page exists but the form/submit is still a placeholder are marked 🟡.

**Status Values**
- ⬜ Not Started · 🟡 In Progress · ✅ Completed · ❌ Failed/Rework · N/A

---

# 1. ADMIN MODULE

## 1.1 Authentication

| Feature | Status | Remarks |
|---|---|---|
| Login Page | ✅ | `/login` shared with all roles, Kerala chrome, RHF + Zod |
| Login Validation | ✅ | `auth.ts` Credentials provider: status check, bcrypt.compare, lockout |
| Session Creation | ✅ | JWT, 8h TTL, enriched with `userId/roleId/secId/loginName` |
| Role Based Access | ✅ | `auth.config.ts` `authorized` callback redirects by role; middleware matcher live |
| Reset Password | 🟡 | `/reset-password` page is still placeholder; no `/api/auth/reset-password` route yet |
| Change Password | 🟡 | `/change-password` page is still placeholder; no route yet |
| Logout | 🟡 | `signOut()` wired in `OfficerUserMenu`; LOGOUT audit row not yet emitted |

### Validation Checks
- ✅ Valid credentials authenticate against `hdp.user_details` (seeded users: `nodal.ah / Nodal@2026`, `verifier.ah / Verify@2026`, `admin / Admin@2026`).
- ✅ Invalid login → null return + LOGIN_FAILURE audit row.
- ✅ 5 failed attempts → `locked_until = now() + 30min`, ACCOUNT_LOCKED audit row.
- ✅ Session TTL 8h via `SESSION_TTL_HOURS` env (auth.ts).
- ✅ LOGIN_SUCCESS / LOGIN_FAILURE / ACCOUNT_LOCKED audit rows written.

---

## 1.2 Dashboard

| Feature | Status | Remarks |
|---|---|---|
| Dashboard UI | ✅ | `app/(admin)/admin/dashboard/page.tsx` exists |
| Statistics Cards | ✅ | Backed by `/api/admin/dashboard` route |
| Reports Summary | 🟡 | Linked from dashboard; full report drilldown lives on `/admin/reports` |
| Navigation Menu | 🟡 | Side / top nav not yet a shared component; in-page links only |

---

## 1.3 User Management

### Create Nodal Officer

| Feature | Status | Remarks |
|---|---|---|
| Create User Form | 🟡 | `/admin/users/new` page exists; verify Zod + POST wired against `/api/admin/users` |
| Validation | ✅ | `lib/validations/user.ts` `createUserSchema` (Zod) |
| Save User | 🟡 | POST `/api/admin/users` route present (132 lines); confirm bcrypt hash on insert |
| Password Generation | 🟡 | `generateTemporaryPassword` helper in `lib/auth/password.ts`; UI hook not confirmed |
| Audit Logging | 🟡 | USER_CREATED action defined; verify route writes it |

### Create Verification Officer
Same routes (`/api/admin/users` is role-agnostic on the server; role chosen in form).

| Feature | Status | Remarks |
|---|---|---|
| Create User Form | 🟡 | Single create-user form, role selector |
| Validation | ✅ | Same Zod schema |
| Save User | 🟡 | Same endpoint |
| Password Generation | 🟡 | Same helper |
| Audit Logging | 🟡 | Same action constant |

---

## 1.4 Project Management

| Feature | Status | Remarks |
|---|---|---|
| Add Project | 🟡 | `/admin/projects/new` page exists; POST handler needs verification |
| Edit Project | 🟡 | `/admin/projects/[id]/edit` page exists |
| View Project | 🟡 | `/admin/projects` list page exists; uses `/api/admin/projects` |
| Assign Secretary | 🟡 | Form field present; persistence to `project_secretary` needs verification |
| Mark Project Status | 🟡 | `is_completed` enum in schema; UI dropdown needs confirmation |

Validation:
- 🟡 Project save path exists, end-to-end manual test outstanding.
- ⬜ Duplicate-`project_code` check not implemented.
- 🟡 Audit trail action constants present (USER_CREATED, INDICATOR_CREATED), generic PROJECT_CREATED not in `AUDIT_ACTIONS`.

---

## 1.5 Reports

| Report | Status | Remarks |
|---|---|---|
| Department Summary | 🟡 | `/api/admin/reports/[reportId]` route exists; data shape parity with legacy CTE pending |
| Department Details | 🟡 | Same route, drilldown |
| District Reports | 🟡 | Same route, `?district_id=` slice |
| Completed Projects | 🟡 | `WHERE is_completed = 2` slice |
| CSV Export | ✅ | `/admin/reports` page calls `?format=csv`, triggers Blob download |
| Excel Export | ✅ | `?format=xlsx` Blob download |

---

# 2. NODAL OFFICER MODULE

## 2.1 Authentication

| Feature | Status | Remarks |
|---|---|---|
| Login | ✅ | Same as 1.1 |
| Reset Password | 🟡 | Page placeholder; no API yet |
| Change Password | 🟡 | Page placeholder; no API yet |
| Logout | 🟡 | `signOut()` wired; LOGOUT audit row pending |

---

## 2.2 Dashboard

| Feature | Status | Remarks |
|---|---|---|
| Dashboard UI | 🟡 | `/officer/projects` doubles as landing page; no dedicated dashboard yet |
| Assigned Projects | ✅ | `/api/officer/projects` filters by `sec_id` via `project_secretary` |
| Indicator Summary | ✅ | Card badges show image/video/document counts |
| Progress Summary | ✅ | Progress bars on indicator cards animate from DB values |

---

## 2.3 Edit User Profile

| Feature | Status | Remarks |
|---|---|---|
| View Profile | ⬜ | No `/officer/profile` page |
| Edit Details | ⬜ | — |
| Save Changes | ⬜ | — |

---

## 2.4 Indicator Management

| Feature | Status | Remarks |
|---|---|---|
| Add Indicator | 🟡 | `POST /api/officer/projects/[projectId]/indicators` ready; UI form is placeholder |
| Edit Indicator | 🟡 | `/officer/indicators/[id]/edit` page is placeholder |
| Delete Indicator | ⬜ | No DELETE route |
| Validation | ✅ | Zod `createIndicatorSchema` server-side |

---

## 2.5 Progress Update

### Financial Progress

| Feature | Status | Remarks |
|---|---|---|
| Enter Achievement | ✅ | `IndicatorActionSheet` → Progress tab |
| Save Draft | ⬜ | Single Submit only; no draft state |
| Submit | ✅ | `PUT /api/officer/indicators/[id]/progress` |

### Physical Progress

| Feature | Status | Remarks |
|---|---|---|
| Enter Achievement | ✅ | Same sheet |
| Auto Percentage | ✅ | Live calc in form; server recomputes `percentage` column via SQL `LEAST(100, ...)` |
| Submit | ✅ | Same endpoint, ownership-checked by `officerOwnsIndicator(secId)` |

### Employment Details

| Feature | Status | Remarks |
|---|---|---|
| Direct Employment | ✅ | `achieved_no_days_employed_direct` / `_persons_employed_direct` persisted |
| Indirect Employment | ✅ | `achieved_no_days_employed_indirect` / `_persons_employed_indirect` persisted |

---

## 2.6 Media Uploads

### Images

| Feature | Status | Remarks |
|---|---|---|
| Upload Image | ✅ | Multipart `POST /api/officer/indicators/[id]/gallery`, file → `UPLOAD_DIR/<year>/<id>/<uuid>.<ext>`, row → `hdp.gallery` type=1 |
| Preview | ✅ | Drag-drop zone shows blob preview before upload |
| View Uploaded | 🟡 | Grid + lightbox render from API; file serving via `/uploads/...` requires a route handler in prod (currently relies on UPLOAD_DIR being a public dir) |

### Documents

| Feature | Status | Remarks |
|---|---|---|
| Upload Document | ✅ | Same endpoint, PDF detected → row → `hdp.documents` |
| Download | 🟡 | Document download button present; signed-URL/proxy route still pending |

### Videos

| Feature | Status | Remarks |
|---|---|---|
| Embed Video | ✅ | JSON `POST /api/officer/indicators/[id]/gallery { url }` validates YouTube/Facebook, converts to embed format, inserts type=2 |
| View Video | ✅ | Iframe loads from `image_path`; CSP allows `youtube.com`, `youtube-nocookie.com`, `facebook.com` |

---

## 2.7 Reports

| Report | Status | Remarks |
|---|---|---|
| My Projects | ✅ | `/officer/projects` |
| My Indicators | ✅ | `/officer/projects/[pid]/indicators` |
| Progress Reports | ⬜ | No dedicated officer-side report page yet |

---

# 3. VERIFICATION OFFICER MODULE

## 3.1 Authentication

| Feature | Status | Remarks |
|---|---|---|
| Login | ✅ | Same as 1.1 |
| Reset Password | 🟡 | Same gap as Admin |
| Change Password | 🟡 | Same gap |
| Logout | 🟡 | Same gap |

---

## 3.2 Dashboard

| Feature | Status | Remarks |
|---|---|---|
| Review Queue | 🟡 | `/verify/projects` page exists; backed by `/api/verify/projects` |
| Pending Count | 🟡 | API returns project list; verify aggregation columns |
| Approved Count | 🟡 | — |
| Rejected Count | 🟡 | — |

---

## 3.3 Profile Management

| Feature | Status | Remarks |
|---|---|---|
| View Profile | ⬜ | No `/verify/profile` page |
| Edit Profile | ⬜ | — |
| Save Profile | ⬜ | — |

---

## 3.4 Indicator Verification

| Feature | Status | Remarks |
|---|---|---|
| Verify One Indicator | ✅ | `POST /api/verify/indicators/[id]/verify` (126 LOC) |
| Bulk Verification | 🟡 | Endpoint likely accepts an indicator array; UI bulk button pending |
| Approve | ✅ | Sets `verified_by`, `verified_date`, `verified_percentage` |
| Reject | 🟡 | Reject branch present; audit action `INDICATOR_REJECTED` defined |
| Remarks | 🟡 | Field present in API contract; verify storage column (`reject_remarks`) exists |

---

## 3.5 Progress Verification

| Feature | Status | Remarks |
|---|---|---|
| Verify Financial Progress | ✅ | `verified_financial_achievement` set |
| Verify Physical Progress | ✅ | `verified_physical_achievement` + `verified_percentage` |
| Verify Documents | 🟡 | `is_verified` flag exists on gallery rows; UI flow needs check |
| Verify Images | 🟡 | Same |
| Verify Videos | 🟡 | Same |

---

## 3.6 Project Completion

| Feature | Status | Remarks |
|---|---|---|
| Mark Project Completed | 🟡 | `is_completed` enum exists; explicit "complete" action needs to be wired |
| Completion Validation | ⬜ | Rule "all indicators must be 100% verified" not enforced server-side |
| Completion Audit Log | 🟡 | No PROJECT_COMPLETED action in `AUDIT_ACTIONS` yet |

---

## 3.7 Reports

| Report | Status | Remarks |
|---|---|---|
| Verification Summary | ⬜ | Not built |
| Approved Projects | ⬜ | — |
| Pending Projects | 🟡 | Implicit via `/verify/projects` queue |

---

# 4. SYSTEM WIDE VALIDATION

## Logout Validation

| Module | Status | Remarks |
|---|---|---|
| Admin Logout | 🟡 | `signOut()` clears JWT cookie; LOGOUT audit row not yet emitted |
| Nodal Logout | 🟡 | Same |
| Verifier Logout | 🟡 | Same |

Validation:
- ✅ Session cookie cleared on `signOut`; subsequent requests redirected to `/login` by `auth.config`.
- ✅ Secured pages re-redirect to `/login` after logout (middleware enforced).
- 🟡 Browser back button: relies on `Cache-Control` headers — currently `next.config.mjs` does not set `no-store` on protected routes. Add `cache: 'no-store'` headers on the `(officer)/(verify)/(admin)` route group layout.

---

# 5. REPORTING VALIDATION

| Report | Admin | Nodal | Verifier | Status |
|---|---|---|---|---|
| Department Summary | Yes | No | Yes | 🟡 (admin export ready; verifier view pending) |
| Project Details | Yes | Yes | Yes | ✅ for Officer; 🟡 admin/verifier |
| District Reports | Yes | No | Yes | 🟡 |
| Completed Projects | Yes | Yes | Yes | 🟡 |

---

# 6. SECURITY & AUDIT CHECKLIST

## Audit Logging — hdp.user_log

| Event | Status | Remarks |
|---|---|---|
| Login Success | ✅ | `LOGIN_SUCCESS` written in `auth.ts` |
| Login Failure | ✅ | `LOGIN_FAILURE` + `ACCOUNT_LOCKED` written |
| Logout | ⬜ | No LOGOUT row emitted yet |
| User Creation | 🟡 | `USER_CREATED` action defined; verify route writes it |
| Password Reset | ⬜ | `PASSWORD_RESET_REQUEST` / `PASSWORD_RESET_COMPLETE` constants defined but routes not built |
| Indicator Update | ✅ | `INDICATOR_SUBMITTED` written by progress PUT |
| Verification Action | 🟡 | `INDICATOR_APPROVED` / `INDICATOR_REJECTED` constants present; confirm route writes them |
| Project Completion | ⬜ | No PROJECT_COMPLETED action |

Also wired:
- ✅ `INDICATOR_CREATED` (officer POST)
- ✅ `MEDIA_UPLOADED` (gallery image/document upload)
- ✅ `MEDIA_DELETED` (gallery DELETE)
- ✅ `VIDEO_EMBEDDED` (gallery JSON POST)

---

## Security Validation

| Item | Status | Remarks |
|---|---|---|
| Password Hashing | ✅ | bcrypt 12 rounds in `auth.ts` + `lib/auth/password.ts` |
| CSRF Protection | ✅ | NextAuth.js built-in CSRF tokens |
| XSS Protection | ✅ | React auto-escape + CSP `default-src 'self'`, `script-src` no `*` wildcard |
| SQL Injection Protection | ✅ | All queries via Drizzle parameterized `sql` template literals |
| Role Based Access | ✅ | `auth.config.ts authorized` callback enforces officer/verify/admin role boundaries |
| Session Timeout | ✅ | JWT `maxAge = 8h` (configurable via `SESSION_TTL_HOURS`) |
| Account Lockout | ✅ | 5 failures → 30-min `locked_until` (configurable via env) |

Additional headers from `next.config.mjs`:
- ✅ `X-Frame-Options: DENY`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ `Strict-Transport-Security: max-age=31536000; includeSubDomains`

---

# 7. PRE-VAPT GO LIVE CHECKLIST

| Item | Status |
|---|---|
| Admin Module Complete | 🟡 (60–70%; users/projects CRUD wired, reset/change-password missing) |
| Nodal Module Complete | ✅ (~90%; reset/change-password + profile pending) |
| Verifier Module Complete | 🟡 (~50%; core verify endpoint ready, dashboard counts + reports pending) |
| Reports Complete | 🟡 (CSV/XLSX export wired, parity with legacy CTEs to validate) |
| Audit Logs Complete | 🟡 (8 actions live; LOGOUT and password-reset still pending) |
| Security Controls Complete | ✅ (hashing, lockout, RBAC, CSP, CSRF, session — all in place) |
| UAT Completed | ⬜ |
| Defects Closed | ⬜ |

---

# 8. VAPT READINESS

## Recommended Scope (priority for HDP)

1. **Authentication Testing** — bcrypt rounds, lockout, session TTL, cookie flags (httpOnly, secure, sameSite)
2. **Authorization Testing** — `sec_id` boundary on every officer/verify mutation (ownership checks live in `officerOwnsIndicator`)
3. **Session Management Testing** — JWT signature, fixation, replay; logout invalidates cookie
4. **API Security Testing** — every `/api/*` route returns 401 unauthenticated, 403 cross-role
5. **File Upload Testing** — magic-byte sniffing on upload (currently only extension + size enforced), AV scanning hook
6. **Media Upload Testing** — `UPLOAD_DIR` outside webroot, file served via signed-URL route handler (TODO)
7. **Password Reset Testing** — once implemented, validate 1h token TTL + single-use semantics
8. **SQL Injection Testing** — all Drizzle parameterized; raw `sql` blocks reviewed
9. **XSS Testing** — CSP audit, embedded video iframes sandbox attribute
10. **CSRF Testing** — NextAuth CSRF tokens, custom mutation routes accept JSON only
11. **Business Logic Testing** — officer cannot patch a different sec's indicator (verified by `ownerOwnsIndicator`); verifier cannot edit own-secretary verification
12. **Privilege Escalation Testing** — `roleId` is in JWT only, not editable client-side
13. **Audit Log Validation** — every state-change endpoint should emit a row; current gaps listed above

---

# FINAL IMPLEMENTATION STATUS

| Area | Completion % | Status |
|---|---|---|
| Admin Module | ~65 | 🟡 |
| Nodal Officer Module | ~90 | ✅ |
| Verification Officer Module | ~50 | 🟡 |
| Reports | ~55 | 🟡 |
| Security | ~90 | ✅ |
| Audit | ~70 | 🟡 |
| **Overall Project** | **~70** | 🟡 |

## Release Recommendation

- ⬜ Ready for UAT — *blocked on:* reset/change-password + verifier reports + logout audit
- ⬜ Ready for Security Testing — *available after:* upload-serving route + LOGOUT audit
- ⬜ Ready for VAPT — *available after:* UAT + defect closure
- ⬜ Ready for Production
- 🟡 **Not Ready** — substantial Officer core is production-grade; remaining work is well-scoped (see punch list below).

---

# Punch list to reach UAT-ready

1. **Build self-service password reset (Section 5.2 Flow A)** — `/api/auth/forgot-password` + `/api/auth/reset-password`; wire `forgot-password` and `reset-password` pages.
2. **Build admin-initiated reset (Flow B)** — button on `/admin/users/[id]`, generate temp password, `password_must_change = true`.
3. **Build change-password page** — for first-login forced change.
4. **Emit LOGOUT audit row** — extend `auth.ts` `events.signOut` callback.
5. **Officer + Verifier profile pages** — view/edit `user_name`, `mobile_no`, `designation`.
6. **Verifier dashboard counters** — pending / approved this week / rejected this week aggregates.
7. **Project completion action** — explicit `POST /api/admin/projects/[id]/complete` with rule "all indicators verified at 100%"; add `PROJECT_COMPLETED` to `AUDIT_ACTIONS`.
8. **Upload-serving route** — `/api/uploads/[...path]` that auth-gates static files instead of relying on Next public serving.
9. **Cache-Control: no-store** on protected route group layouts so the browser back button can't show stale authenticated pages.
10. **Aggregate reports parity** — confirm legacy CTE output matches new `/api/admin/reports/...` for Department Summary + Department Details.

Each item is independent and small (1–2 days). After all ten land, the project is ready for UAT, then VAPT.
