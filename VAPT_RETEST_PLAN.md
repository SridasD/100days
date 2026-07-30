# VAPT Re-test Plan for Main Branch

## Objective

Re-run the earlier VAPT work from the audit/v2.0-pre-release branch against the current main branch, but keep the work isolated in a dedicated branch so that the main branch remains stable.

## Recommended branch strategy

- Keep audit/v2.0-pre-release as a reference branch for historical findings and prior fixes.
- Create a fresh working branch from main for the re-test effort.
- Do all VAPT follow-up work on that branch first.
- Merge to main only after validation and review.

## Working branch

Current working branch:

- vapt/main-retest

## Previous VAPT themes to re-check

The older audit branch already covered several important areas:

1. Authentication and session security
   - logout audit logging
   - role-based access behavior
   - change-password flow
   - JWT/session handling

2. Security headers and CSP
   - CSP policy strength
   - header configuration
   - risky script/style allowances

3. UX and responsiveness
   - empty states
   - typography breakpoints
   - layout stability on smaller screens

4. Testing and regression protection
   - unit tests
   - integration/API tests
   - E2E smoke coverage

5. Operational readiness
   - audit trail completeness
   - deployment and rollback readiness
   - environment/config validation

## Suggested execution flow

1. Reproduce the prior audit findings against the current main branch.
2. Validate whether each issue still exists or has already been fixed.
3. For each remaining issue, create a focused fix on vapt/main-retest.
4. Add or update tests where appropriate.
5. Re-run relevant checks before proposing a merge back to main.

## Suggested starting checks

- auth/logout and audit logging
- role-based page access and redirects
- CSP/security headers
- change-password and password handling
- basic public/admin/officer/verify flows
- core regression tests

## Outcome

The goal is not to restart from scratch, but to revalidate the earlier VAPT findings on the newer main branch and carry forward only the fixes that are still relevant.
