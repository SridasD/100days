# Sections 1, 2, 3, 5 Browser Test Pack

Use this after completing Section 4 ID collection.

Prerequisites:

1. One valid UUID + numeric ID each for department, project, sector, district.
2. Test accounts for roles: OSD (4), Tech Admin (3), Secretary (5), Verification (1), HOD/Nodal (2/6).
3. Base URL for test environment.

---

## A. Section 1 - Canonical Route E2E

Run as appropriate authenticated user (or anonymous where expected).

1. Open `/public/departments/{department_uuid}`
   - Expected: department page loads with project list.
2. Open `/public/departments/{department_uuid}/projects/{project_uuid}`
   - Expected: indicator detail page loads.
3. Open `/public/projects/{project_uuid}`
   - Expected: public project detail loads.
4. Open `/public/gallery/projects/{project_uuid}`
   - Expected: media gallery loads.
5. Open `/public/sectors/{sector_uuid}`
   - Expected: sector page loads with departments list.
6. Open `/public/districts/{district_uuid}` as OSD role.
   - Expected: district page loads.

Record evidence for each URL:

- Screenshot link:
- Final URL:
- Timestamp:

---

## B. Section 5 - Legacy Bookmark Compatibility

Use legacy URLs and verify canonical redirect destination.

1. `/public/department/{department_numeric}`
   - Expected redirect: `/public/departments/{department_numeric_or_resolved}`
2. `/public/department/{department_numeric}/project/{project_numeric}`
   - Expected redirect: `/public/departments/{department}/projects/{project}`
3. `/public/gallery/{project_numeric}`
   - Expected redirect: `/public/gallery/projects/{project}`
4. `/public/district/{district_numeric}`
   - Expected redirect: `/public/districts/{district}`

For each:

- Redirect observed (Y/N):
- Destination URL:
- Final page rendered (Y/N):

---

## C. Section 2 - Role-Based Access Regression

Target route: `/public/districts/{district_uuid}`

1. Anonymous
   - Expected: blocked/redirected to login.
2. OSD (4)
   - Expected: allowed.
3. Tech Admin (3)
   - Expected: blocked/redirected.
4. Secretary (5)
   - Expected: blocked/redirected.
5. Verification (1)
   - Expected: blocked/redirected.
6. HOD/Nodal (2/6)
   - Expected: blocked/redirected.

Record for each role:

- Result (Pass/Fail):
- Actual behavior:
- Evidence screenshot:

---

## D. Section 3 - Link Integrity Sweep

Start from canonical pages verified above and click through UI links.

Check each item:

1. Main public cards/CTAs resolve to canonical department URLs.
2. Department project CTAs resolve to canonical nested URLs.
3. Project details breadcrumb/back links resolve to canonical department URL.
4. Sector and district drill-down links resolve to plural canonical URL.
5. Pagination/filter operations keep canonical route shape.
6. Export/download links still resolve and do not downgrade to legacy paths unexpectedly.

Record defects in this template:

- Area:
- Clicked from URL:
- Expected URL pattern:
- Actual URL:
- Screenshot:
- Severity:

---

## E. Checklist Update Map

After execution, update these sections in `CANONICAL_ROUTING_RELEASE_CHECKLIST.md`:

1. Section 1 checkboxes + evidence links.
2. Section 2 checkboxes + notes.
3. Section 3 checkboxes + evidence.
4. Section 5 checkboxes + redirect verification.
5. Section 7 go/no-go with blockers list.
