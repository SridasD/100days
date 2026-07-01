# HDP PORTAL 2.0 — CRITICAL BUG MANIFEST

**Report Date:** 2026-07-01  
**Total Bugs Identified:** 15 unique issues  
**Critical Blockers:** 2  
**High Priority:** 7  
**Medium Priority:** 6  

---

## PASSWORD MANAGEMENT STATUS

✅ **Change Password** — FULLY IMPLEMENTED  
Users can successfully change passwords across all roles (Officer, Verify, Admin, Secretary).

✅ **Password Management** — OUT OF SCOPE (Official Design Decision)  
- Forgot Password: Not required per product design
- Reset Password: Not required per product design
- Account recovery: Via IT support desk / OSD Admin manual reset

---

## BUG CATALOG BY PRIORITY

### 🔴 CRITICAL BUGS (DEPLOYMENT BLOCKERS)

#### BUG-C001: Logout Does Not Emit Audit Log

| Field | Value |
|-------|-------|
| **ID** | BUG-C004 |
| **Title** | Logout event not recorded in audit trail |
| **Severity** | CRITICAL |
| **Location** | `components/layout/OfficerUserMenu.tsx` + `auth.ts` |
| **Status** | Not Started |
| **User Impact** | Incomplete audit trail (compliance violation) |
| **Fix Effort** | 2-4 hours |
| **Fix Owner** | Backend Engineer |
| **Dependencies** | None |

**Description:**  
The logout button calls `signOut()`, which clears the JWT cookie but does NOT write a `LOGOUT` audit row to `hdp.user_log`.

**Current Behavior:**
```typescript
// OfficerUserMenu.tsx
<DropdownMenuItem onClick={() => signOut()}>
  <LogOut className="h-4 w-4" />
  Logout
</DropdownMenuItem>
```

Result: User is logged out, but no audit trail entry.

**Expected Behavior:**
1. Logout button click → server action (not client-side `signOut()`)
2. Server action writes audit log first
3. Then calls `signOut()` to clear JWT

**What's Missing:**
1. Server action: `'use server'; async function logoutWithAudit() { writeAudit(...); signOut(); }`
2. Audit action: `LOGOUT` constant (already defined in schema but never written)
3. Audit fields: user_id, action, outcome, loggedOn, user_ip, user_agent

**Compliance Impact:**  
Government systems require complete audit trails. Missing logout events = audit non-compliance.

**Recommendation:**  
Priority: **MUST FIX BEFORE GO-LIVE**  
Acceptance Criteria:
- [ ] Create server action `logoutWithAudit()`
- [ ] Write LOGOUT audit row before signOut()
- [ ] Include user IP + user-agent in audit
- [ ] Verify audit row created in database after logout

---

#### BUG-C002: CSP Header Allows unsafe-eval and unsafe-inline Scripts

| Field | Value |
|-------|-------|
| **ID** | BUG-C002 |
| **Title** | Content Security Policy too permissive |
| **Severity** | CRITICAL |
| **Location** | `next.config.mjs` (lines 4-7) |
| **Status** | Not Started |
| **User Impact** | XSS protection completely disabled |
| **Fix Effort** | 1-2 hours |
| **Fix Owner** | DevOps / Frontend Lead |
| **Dependencies** | None |

**Description:**  
The CSP header allows both `unsafe-eval` and `unsafe-inline` in script-src, which defeats the purpose of CSP.

**Current CSP:**
```
script-src 'self' 'unsafe-eval' 'unsafe-inline'
```

**Problem:**
- `unsafe-eval`: Allows `eval()`, `Function()`, `setTimeout(code)`, etc.
- `unsafe-inline`: Allows inline `<script>` tags
- Together: Attackers can inject arbitrary JavaScript anywhere

**Attack Scenario:**
1. User input stored in database (even escaped)
2. If displayed in inline script context: `<script>var user = '${escaped_input}';</script>`
3. Attacker escapes the string context: `'; alert('xss'); //`
4. CSP doesn't block because of `unsafe-inline`

**Expected CSP:**
```
script-src 'self'
style-src 'self' https://fonts.googleapis.com
```

If inline styles required: use nonce strategy
```
style-src 'self' https://fonts.googleapis.com 'nonce-{cryptoRandom}'
```

**Recommendation:**  
Priority: **MUST FIX BEFORE GO-LIVE**  
Acceptance Criteria:
- [ ] Remove `unsafe-eval` from script-src
- [ ] Remove `unsafe-inline` from script-src (or use nonce)
- [ ] Verify CSP doesn't break any styles/scripts
- [ ] Test in production-like environment
- [ ] Document any necessary exceptions

---

### 🟠 HIGH-PRIORITY BUGS

#### BUG-H001: Dashboard Queries Use N+1 Pattern (Performance)

**Severity:** HIGH  
**Location:** `/api/secretary/dashboard/route.ts` (lines 45-130)  
**Impact:** Dashboard load time = 11x single query  
**Fix Effort:** 6-8 hours  

**Description:**  
Secretary dashboard executes 11 separate database queries in sequence instead of consolidating into fewer JOINs.

**Query Pattern:**
```sql
-- Query 1: Get summary counts
SELECT COUNT(*) FROM hdp.master_projects;

-- Queries 2-11: For each department
FOR EACH dept IN departments:
  SELECT ... FROM hdp.master_projects WHERE dept_id = dept;
```

**Performance Impact:**
- 11 round-trips to database
- On high-latency network (satellite, mobile): 11 × 200ms = 2.2 seconds added delay
- Each query: ~50-100ms, totaling 500ms-1s (removable overhead)

**Expected Behavior:**
Single CTE-based query with aggregations.

**Recommendation:**  
Refactor to use `GROUP BY` aggregations. Add caching for 5-minute TTL.

---

#### BUG-H002: Missing Empty States in Data Tables

**Severity:** HIGH  
**Location:** Multiple components  
**Impact:** Poor UX when no data  
**Fix Effort:** 2-3 hours  

**Description:**  
When data lists are empty, users see blank screens with no message or call-to-action.

**Affected Components:**
- `ProjectTable.tsx` — blank when no projects
- `DepartmentPage.tsx` — grid disappears
- `SectorGrid.tsx` — no "no sectors" state

**Expected Behavior:**
Show empty state card with icon, title, description, and next step.

---

#### BUG-H003: Authorization Boundary Leak - OSD Admin Access

**Severity:** HIGH  
**Location:** `auth.config.ts` (lines 115-125)  
**Impact:** Role isolation violation  
**Fix Effort:** 1-2 hours  

**Description:**  
OSD Admin (role 4) can access `/admin/projects` route, which should be restricted to Tech Admin (role 3) only.

**Expected Fix:**
```typescript
if (role === 4 && !pathname.startsWith("/admin/osd")) {
  return Response.redirect(new URL("/admin/osd/dashboard", nextUrl));
}
```

---

#### BUG-H004: Browser Back Button Data Leak

**Severity:** HIGH  
**Location:** All protected routes  
**Impact:** Sensitive data visible after logout  
**Fix Effort:** 1-2 hours  

**Description:**  
Protected pages are cached by browser. After logout, users can use back button to see cached data.

**Expected Fix:**
Add `Cache-Control` headers in protected route layouts:
```typescript
export const headers = {
  'Cache-Control': 'no-store, must-revalidate, max-age=0',
};
```

---

#### BUG-H005: Client-Side Fetching Without Caching

**Severity:** HIGH  
**Location:** `OfficerUserMenu.tsx`, `ProfilePage.tsx`  
**Impact:** Redundant API calls on navigation  
**Fix Effort:** 3-4 hours  

**Description:**  
OfficerUserMenu fetches `/api/me` on every page mount without any caching.

**Expected Fix:**
Use SWR or React Query with 5-minute cache.

---

#### BUG-H006: Typography Responsive Jumps

**Severity:** HIGH  
**Location:** Public pages (ProjectDetailPage, DepartmentPage)  
**Impact:** Mobile readability poor  
**Fix Effort:** 2-3 hours  

**Description:**  
Heading sizes jump from default (~16px) to `md:text-4xl` (36px) with no intermediate sizes.

**Expected Fix:**
```tsx
<h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl">...</h1>
```

---

#### BUG-H007: JWT Not Blocklisted on Logout (Session Fixation)

**Severity:** HIGH  
**Location:** `sessionBlocklist` table (unused)  
**Impact:** Tokens valid 8 hours after logout  
**Fix Effort:** 4-6 hours  

**Description:**  
The application has a `sessionBlocklist` table but never uses it. Existing JWT tokens remain valid until expiration (8 hours).

**Expected Fix:**
- On logout: add JWT to blocklist
- On every request: check if JWT is blocklisted
- Cache blocklist in-memory

---

### 🟡 MEDIUM-PRIORITY BUGS

#### BUG-M001: Password Complexity Not Enforced in Login

**Severity:** MEDIUM  
**Location:** `lib/validations/login.ts`  
**Impact:** Weak password validation  
**Fix Effort:** 1-2 hours  

---

#### BUG-M002: Duplicate Sector Metadata Definition

**Severity:** MEDIUM  
**Location:** Two component files  
**Impact:** Maintenance burden  
**Fix Effort:** 1 hour  

---

#### BUG-M003: Generic Error Messages Hide Debug Info

**Severity:** MEDIUM  
**Location:** 45+ API routes  
**Impact:** Poor supportability  
**Fix Effort:** 4-6 hours  

---

#### BUG-M004: Console.error Statements Exposed

**Severity:** MEDIUM  
**Location:** All API routes  
**Impact:** Information disclosure in dev mode  
**Fix Effort:** 1-2 hours  

---

#### BUG-M005: Missing Department Assignment Validation

**Severity:** MEDIUM  
**Location:** `/api/admin/projects` route  
**Impact:** Authorization violation  
**Fix Effort:** 1-2 hours  

---

#### BUG-M006: Rate Limiting Uses In-Memory Map

**Severity:** MEDIUM  
**Location:** `/api/auth/change-password/route.ts`  
**Impact:** Weak protection (lost on restart)  
**Fix Effort:** 3-4 hours  

---

---

## BUG TRIAGE & SCHEDULING

### Critical Path (Must Do First)

1. **Week 1, Day 1:** BUG-C001 (Logout Audit Logging)
2. **Week 1, Day 2:** BUG-C002 (CSP Header Fix)

### High Priority (Week 1-2)

1. BUG-H001 (Dashboard N+1 queries)
2. BUG-H002 (Empty states)
3. BUG-H003 (Authorization leak)
4. BUG-H004 (Back button cache)
5. BUG-H007 (JWT blocklist)

### Medium Priority (Week 2-3)

All M-level bugs + BUG-H005 (Client caching), BUG-H006 (Typography)

---

## REGRESSION TEST MATRIX

After each fix, regression test:

| Bug ID | Test Case | Expected Result |
|--------|-----------|-----------------|
| C001-C004 | Login → Change password → Logout | No errors, audit created |
| C005 | Run CSP validator | No unsafe-* directives |
| H001 | Load dashboard, measure network tab | < 1 second, < 5 DB queries |
| H002 | Filter projects to empty set | Empty state appears |
| H003 | OSD admin accesses /admin/users | Redirects to /admin/osd/dashboard |
| H004 | Logout, browser back | Static content only |

---

**END OF BUG MANIFEST**

