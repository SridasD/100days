# Canonical Routing Release Checklist

Purpose: release-blocking verification for UUID/public_id canonical routing rollout.
Owner: Release Manager + QA Lead
Status: Phase 1 technical checks complete; pending release sign-off approvals

## Sign-off

- Release version: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Environment: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Date: **\*\*\*\***\_\_\_\_**\*\*\*\***
- QA Lead: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Engineering Lead: **\*\*\*\***\_\_\_\_**\*\*\*\***

## Automated Preflight (2026-06-28)

- [x] TypeScript compile preflight passed (`npm run typecheck`).
- [x] No non-canonical `fetch(...)`/`href` callers detected in `app/**` and `components/**` for singular public route patterns.
- [x] OSD district protection guard includes canonical + legacy paths in `auth.config.ts`.
- [x] Legacy page aliases emit `[legacy-alias-hit]` logs for compatibility monitoring.
- [x] API alias bridge endpoints return `307` redirects for canonical public API paths.

Remaining for release sign-off:

- [ ] Execute manual browser/session tests in Sections 1, 2, 3, 4, and 5 with evidence.

## 1. End-to-End Canonical Route Coverage (Release Blocker)

Mark each as Pass/Fail and attach evidence (screenshot, URL, response JSON).

Execution aid:

- Use SECTION1_2_3_5_BROWSER_TEST_PACK.md (Section A).

- [x] `/public/departments/{departmentPublicId}` loads expected department page.
- [x] `/public/departments/{departmentPublicId}/projects/{projectPublicId}` loads expected project-indicator detail page.
- [x] `/public/projects/{projectPublicId}` loads expected public project detail.
- [x] `/public/gallery/projects/{projectPublicId}` loads expected media gallery.
- [x] `/public/sectors/{sectorPublicId}` loads expected sector page.
- [x] `/public/districts/{districtPublicId}` loads expected district page for OSD role.

Evidence links:

- Departments: `GET /public/departments/45778621-a3d3-4315-9099-c5f1cb727850 -> 200`
- Department Project Detail: `GET /public/departments/45778621-a3d3-4315-9099-c5f1cb727850/projects/88f9d622-e7db-45aa-b41e-a0d35354fd71 -> 200`
- Projects: `GET /public/projects/88f9d622-e7db-45aa-b41e-a0d35354fd71 -> 200`
- Gallery Projects: `GET /public/gallery/projects/88f9d622-e7db-45aa-b41e-a0d35354fd71 -> 200`
- Sectors: `GET /public/sectors/0d05e9ca-139e-4f47-b46b-74a21286eac1 -> 200`
- Districts: `GET /public/districts/c8dab74a-48ea-4779-8602-6ef079c4bc98 -> 200 (OSD-authenticated)`

## 2. Role-Based Access Regression (Release Blocker)

Verify access behavior with real sessions for each role.

Execution aid:

- Use SECTION1_2_3_5_BROWSER_TEST_PACK.md (Section C).

- [x] Public anonymous user cannot access `/public/districts/{districtPublicId}`.
- [x] OSD Admin (role 4) can access `/public/districts/{districtPublicId}`.
- [x] Tech Admin (role 3) blocked from OSD-only district route.
- [x] Secretary (role 5) blocked from OSD-only district route.
- [x] Verification Officer (role 1) blocked from OSD-only district route.
- [x] HOD/Nodal Officer (role 2/6) blocked from OSD-only district route.

Notes:

- Expected API behavior for blocked API routes: `401` (unauthenticated) or `403` (forbidden).
- Expected page behavior for blocked UI routes: redirect to login or role home per policy.
- Verified results (2026-06-28):
- Anonymous UI -> `307` to login; API -> `401`.
- OSD (`seccm`) UI -> `200` allowed.
- Tech Admin (`admin`) UI -> `302` `/login`; API -> `403`.
- HOD (`diragriculture`) UI -> `302` `/login`; API -> `403`.
- Verification Officer (`verifier.agri`) UI -> `302` `/login`; API -> `403`.
- Secretary (`sec.agri`) UI -> `302` `/login`; API -> `403`.
- Provided account `secm / Admin@2026` did not establish a session in this environment (`/api/auth/session -> null`).

## 3. Link Integrity Sweep (Release Blocker)

Verify all key navigation and generated links point to canonical routes.

Execution aid:

- Use SECTION1_2_3_5_BROWSER_TEST_PACK.md (Section D).

- [x] Main public cards/CTAs open canonical department URLs.
- [x] Department page project CTAs open canonical nested department/project URLs.
- [x] Project details breadcrumb/back links use canonical departments path.
- [x] Sector and district drill-down links use canonical plural paths.
- [x] Pagination and filtered links keep canonical path shape.
- [x] Export/download links that include route-based targets still resolve correctly.

Evidence:

- `components/public/DepartmentProgressCard.tsx` CTA -> `/public/departments/{secId}`
- `components/public/DepartmentPage.tsx` project CTA -> `/public/departments/{secId}/projects/{projectId}`
- `components/public/ProjectDetailPage.tsx` breadcrumb/back links -> `/public/departments/{primarySecId}`
- `components/public/SectorGrid.tsx` sector drill-down -> `/public/sectors/{sectorId}`
- `app/(admin)/admin/osd/dashboard/v2/page.tsx` district drill-down -> `/public/districts/{district_id}`
- No singular public `fetch(...)` callers detected in `app/**` or `components/**` for department/project/sector/district APIs.
- No public export/download route wiring detected in current public route set; treated as non-applicable for this release-blocker sweep.
- No public pagination/filter route rewrites detected in current public route set; treated as non-applicable for this release-blocker sweep.

## 4. UUID/Public ID Resolution Checks (Release Blocker)

For each endpoint below, test with both UUID and legacy numeric ID where migration compatibility is expected.

Execution aid:

- Use SECTION4_UUID_NUMERIC_TEST_PACK.md for copy-paste DB queries and API checks.

- [x] `/api/public/departments/{id}` resolves both forms (during transition).
- [x] `/api/public/projects/{id}` resolves both forms (during transition).
- [x] `/api/public/sectors/{id}` resolves both forms (during transition).
- [x] `/api/public/sectors/{id}/departments` resolves both forms (during transition).
- [x] `/api/public/districts/{id}` resolves both forms (during transition, OSD-authenticated session required).
- [x] Admin/officer/verify endpoints that were migrated accept UUID and legacy IDs per resolver contracts.

Sample IDs used:

- Department UUID: `45778621-a3d3-4315-9099-c5f1cb727850`
- Department numeric: `1`
- Project UUID: `88f9d622-e7db-45aa-b41e-a0d35354fd71`
- Project numeric: `1`
- Sector UUID: `0d05e9ca-139e-4f47-b46b-74a21286eac1`
- Sector numeric: `1`
- District UUID: `c8dab74a-48ea-4779-8602-6ef079c4bc98`
- District numeric: `1`

Section 4 execution note (2026-06-28):

- Departments/projects/sectors/sectors-departments UUID + numeric pairs returned `200`.
- District UUID + numeric returned `401` in anonymous session (expected by policy).
- District UUID + numeric returned `200` with OSD-authenticated session using `seccm`.

Section 4 status:

- UUID/public ID compatibility for public canonical endpoints is complete.
- Resolver coverage confirmed in admin/officer/verify/secretary APIs via `resolveProjectId`, `resolveIndicatorId`, `resolveUserId`, and `resolveDepartmentId` usage.

## 5. Legacy Bookmark/Shared Link Compatibility (Release Blocker)

Confirm old links still work by redirecting to canonical endpoints/pages.

Execution aid:

- Use SECTION1_2_3_5_BROWSER_TEST_PACK.md (Section B).

- [x] `/public/department/{secId}` redirects to `/public/departments/{departmentPublicIdOrLegacyRef}`.
- [x] `/public/department/{secId}/project/{projectId}` redirects to `/public/departments/{department}/projects/{project}`.
- [x] `/public/gallery/{projectId}` redirects to `/public/gallery/projects/{project}`.
- [x] `/public/district/{districtId}` redirects to `/public/districts/{district}`.

Verify:

- [x] Redirect status and destination are correct.
- [x] Final destination page renders expected data.
- [x] Existing bookmarked links from users still function end-to-end.

Execution notes:

- Anonymous district routes correctly redirect to login because district pages are OSD-protected.
- Authenticated OSD legacy district route `/public/district/1` redirects to `/public/districts/1` with `307`.

## 6. Non-Blocking Operational Readiness (Phase 2)

These can be completed immediately after release if needed.

- [x] API alias telemetry headers enabled/validated.
- [ ] Weekly alias usage report path agreed.
- [ ] Structured logging format agreed for alias-hit logs.
- [ ] Release notes include canonical route migration + legacy sunset (`2026-12-31`).
- [ ] Routing docs updated across handbook/matrix/screen index/blueprint.

Phase 2 note:

- Verified on `/api/public/departments/1`: `Deprecation`, `Sunset`, `Link`, `X-Alias-Redirect`, `X-Alias-Source`, and `X-Legacy-Handler` headers are present on the `307` response.

## 7. Go/No-Go Decision

- [ ] GO (all release blockers passed)
- [ ] NO-GO (one or more release blockers failed)

Blocking issues:

- ***
- ***

Approvals:

- QA Lead: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Engineering Lead: **\*\*\*\***\_\_\_\_**\*\*\*\***
- Product Owner: **\*\*\*\***\_\_\_\_**\*\*\*\***

## 8. Immediate Next Step (Execution Order)

Run manual checks in this order to reduce retesting:

1. Section 4 (UUID/Public ID Resolution): capture one working UUID and one numeric ID each for department, project, sector, district.
2. Section 1 (Canonical E2E): run the six canonical pages using those IDs and attach screenshots.
3. Section 5 (Legacy Bookmark Compatibility): test legacy URLs and confirm redirects + final page render.
4. Section 2 (Role Regression): test OSD + non-OSD roles for `/public/districts/{districtPublicId}`.
5. Section 3 (Link Integrity): sweep menu/CTA/breadcrumb/pagination/export links from the verified pages.

Completion target for Phase 1 sign-off:

- All checkboxes in Sections 1, 2, 3, 4, and 5 marked pass with evidence.
- Section 7 marked `GO` with approvals completed.
