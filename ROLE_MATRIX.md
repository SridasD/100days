# HDP 2026 Role Matrix

This document defines role IDs, intended responsibilities, route access, and key capabilities in the HDP portal.

## 1. Role IDs

| Role ID | Role Name                          | Primary Area                                     |
| ------- | ---------------------------------- | ------------------------------------------------ |
| 1       | Verification Officer               | `/verify/*`                                      |
| 2       | Nodal Officer                      | `/officer/*`                                     |
| 3       | Admin (Tech Admin)                 | `/admin/*` (except OSD-only pages)               |
| 4       | OSD Admin                          | `/admin/osd/*` and selected admin project routes |
| 5       | Secretary                          | `/secretary/*`                                   |
| 6       | Officer Variant (treated as Nodal) | `/officer/*`                                     |

## 2. Route Access Matrix

Legend:

- Allowed: role can access route family
- Redirected: role is redirected away by auth callback rules
- Blocked: role cannot access

| Route Family                                    | Public         | 1 Verify                         | 2 Officer                         | 3 Admin                          | 4 OSD                                                           | 5 Secretary                          | 6 Officer Variant                 |
| ----------------------------------------------- | -------------- | -------------------------------- | --------------------------------- | -------------------------------- | --------------------------------------------------------------- | ------------------------------------ | --------------------------------- |
| `/` and `/public/*`                             | Allowed        | Allowed                          | Allowed                           | Allowed                          | Allowed                                                         | Allowed                              | Allowed                           |
| `/public/district/*`                            | Blocked        | Blocked                          | Blocked                           | Blocked                          | Allowed                                                         | Blocked                              | Blocked                           |
| `/login`, `/forgot-password`, `/reset-password` | Allowed        | Allowed                          | Allowed                           | Allowed                          | Allowed                                                         | Allowed                              | Allowed                           |
| `/change-password` (auth route group)           | Requires login | Requires login                   | Requires login                    | Requires login                   | Requires login                                                  | Requires login                       | Requires login                    |
| `/officer/*`                                    | Blocked        | Redirected to `/verify/projects` | Allowed                           | Allowed (if route exists)        | Allowed (if route exists)                                       | Redirected to `/secretary/dashboard` | Allowed                           |
| `/verify/*`                                     | Blocked        | Allowed                          | Redirected to `/officer/projects` | Allowed (if route exists)        | Allowed (if route exists)                                       | Redirected to `/secretary/dashboard` | Redirected to `/officer/projects` |
| `/secretary/*`                                  | Blocked        | Blocked                          | Blocked                           | Blocked                          | Blocked                                                         | Allowed                              | Blocked                           |
| `/admin/osd/*`                                  | Blocked        | Blocked                          | Blocked                           | Redirected to `/admin/dashboard` | Allowed                                                         | Redirected to `/secretary/dashboard` | Blocked                           |
| `/admin/*` (general)                            | Blocked        | Blocked                          | Blocked                           | Allowed                          | Redirected to `/admin/osd/dashboard` for most non-project pages | Redirected to `/secretary/dashboard` | Blocked                           |

## 3. Capability Matrix

| Capability                      | Public | Verify (1) | Officer (2/6) | Admin (3) | OSD (4)                           | Secretary (5) |
| ------------------------------- | ------ | ---------- | ------------- | --------- | --------------------------------- | ------------- |
| View public dashboards          | Yes    | Yes        | Yes           | Yes       | Yes                               | Yes           |
| Login and authenticated session | No     | Yes        | Yes           | Yes       | Yes                               | Yes           |
| Create/update projects          | No     | No         | No            | Yes       | Yes (OSD project pages available) | No            |
| Create/update users             | No     | No         | No            | Yes       | No                                | No            |
| View audit data                 | No     | No         | No            | Yes       | No                                | No            |
| Submit progress/evidence        | No     | No         | Yes           | No        | No                                | No            |
| Verify/reject submissions       | No     | Yes        | No            | No        | No                                | No            |
| Access executive KPI dashboard  | No     | No         | No            | No        | Yes                               | No            |
| Access secretary dashboard      | No     | No         | No            | No        | No                                | Yes           |

## 4. Enforcement Source

Authorization behavior is enforced in:

- `auth.config.ts` (NextAuth `authorized` callback)
- `middleware.ts` (delegates to edge-safe auth config)

Session role payload and token mapping are also handled in `auth.config.ts` and full credential validation in `auth.ts`.

## 5. Operational Notes

- Role 6 is explicitly treated as Officer for verify route redirection.
- `/public/district/*` is an OSD-only protected exception even though it sits under public URL space.
- OSD Admin can enter selected admin project routes while most other `/admin/*` pages redirect to OSD dashboard.
- Secretary role is isolated to `/secretary/*` and redirected away from officer, verify, and admin areas.

## 6. Change Control

When role rules are changed, update all of the following together:

1. `auth.config.ts`
2. `USER_MANUAL.md`
3. `SCREEN_INDEX.md`
4. Relevant API authorization guards under `app/api/**/route.ts`
