# HDP 2026 Screen Index

This index catalogs all current UI screens (`app/**/page.tsx`) by route group, expected user role, and source file.

## 1. Public Screens

| Route                                                                 | Screen                                   | Primary Audience | Source File                                                                                |
| --------------------------------------------------------------------- | ---------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `/`                                                                   | Public Home                              | Public           | `app/(public)/page.tsx`                                                                    |
| `/department/[secId]`                                                 | Department Summary (legacy path)         | Public           | `app/(public)/department/[secId]/page.tsx`                                                 |
| `/public/completed`                                                   | Completed Projects                       | Public           | `app/(public)/public/completed/page.tsx`                                                   |
| `/public/departments/[departmentPublicId]`                            | Department Summary                       | Public           | `app/(public)/public/departments/[departmentPublicId]/page.tsx`                            |
| `/public/department/[sec_id]`                                         | Department Summary (legacy alias)        | Public           | `app/(public)/public/department/[sec_id]/page.tsx`                                         |
| `/public/departments/[departmentPublicId]/projects/[projectPublicId]` | Department Project Detail                | Public           | `app/(public)/public/departments/[departmentPublicId]/projects/[projectPublicId]/page.tsx` |
| `/public/department/[sec_id]/project/[project_id]`                    | Department Project Detail (legacy alias) | Public           | `app/(public)/public/department/[sec_id]/project/[project_id]/page.tsx`                    |
| `/public/districts/[districtPublicId]`                                | District Detail (OSD-protected)          | OSD Admin        | `app/(public)/public/districts/[districtPublicId]/page.tsx`                                |
| `/public/district/[district_id]`                                      | District Detail (legacy alias)           | OSD Admin        | `app/(public)/public/district/[district_id]/page.tsx`                                      |
| `/public/gallery/projects/[projectPublicId]`                          | Project Media Gallery                    | Public           | `app/(public)/public/gallery/projects/[projectPublicId]/page.tsx`                          |
| `/public/gallery/[project_id]`                                        | Project Media Gallery (legacy alias)     | Public           | `app/(public)/public/gallery/[project_id]/page.tsx`                                        |
| `/public/projects/[projectPublicId]`                                  | Public Project Detail                    | Public           | `app/(public)/public/projects/[id]/page.tsx`                                               |
| `/public/sectors/[sectorPublicId]`                                    | Sector Detail                            | Public           | `app/(public)/public/sectors/[sectorId]/page.tsx`                                          |

## 2. Authentication Screens

| Route              | Screen                        | Primary Audience        | Source File                           |
| ------------------ | ----------------------------- | ----------------------- | ------------------------------------- |
| `/login`           | Login                         | All authenticated users | `app/(auth)/login/page.tsx`           |
| `/forgot-password` | Forgot Password               | All authenticated users | `app/(auth)/forgot-password/page.tsx` |
| `/reset-password`  | Reset Password                | All authenticated users | `app/(auth)/reset-password/page.tsx`  |
| `/change-password` | Change Password (global auth) | Logged-in users         | `app/(auth)/change-password/page.tsx` |
| `/profile`         | Unified Profile               | Logged-in users         | `app/(auth)/profile/page.tsx`         |

## 3. Admin Screens

| Route                                 | Screen                 | Primary Audience                    | Source File                                               |
| ------------------------------------- | ---------------------- | ----------------------------------- | --------------------------------------------------------- |
| `/admin/dashboard`                    | Admin Dashboard        | Admin (3)                           | `app/(admin)/admin/dashboard/page.tsx`                    |
| `/admin/audit`                        | Audit Logs             | Admin (3)                           | `app/(admin)/admin/audit/page.tsx`                        |
| `/admin/reports`                      | Reports                | Admin (3)                           | `app/(admin)/admin/reports/page.tsx`                      |
| `/admin/settings/change-password`     | Admin Change Password  | Admin (3)                           | `app/(admin)/admin/settings/change-password/page.tsx`     |
| `/admin/projects`                     | Projects List          | Admin (3), OSD (4)                  | `app/(admin)/admin/projects/page.tsx`                     |
| `/admin/projects/new`                 | New Project            | Admin (3), OSD (4)                  | `app/(admin)/admin/projects/new/page.tsx`                 |
| `/admin/projects/[id]/edit`           | Edit Project           | Admin (3), OSD (4)                  | `app/(admin)/admin/projects/[id]/edit/page.tsx`           |
| `/admin/projects/archive`             | Archived Projects List | Admin (3), OSD (4) if route allowed | `app/(admin)/admin/projects/archive/page.tsx`             |
| `/admin/projects/archive/[projectId]` | Archive Detail         | Admin (3), OSD (4) if route allowed | `app/(admin)/admin/projects/archive/[projectId]/page.tsx` |
| `/admin/users`                        | Users List             | Admin (3)                           | `app/(admin)/admin/users/page.tsx`                        |
| `/admin/users/new`                    | New User               | Admin (3)                           | `app/(admin)/admin/users/new/page.tsx`                    |
| `/admin/users/[id]`                   | User Detail/Edit       | Admin (3)                           | `app/(admin)/admin/users/[id]/page.tsx`                   |

## 4. OSD Screens

| Route                           | Screen           | Primary Audience | Source File                                         |
| ------------------------------- | ---------------- | ---------------- | --------------------------------------------------- |
| `/admin/osd/dashboard`          | OSD Dashboard    | OSD Admin (4)    | `app/(admin)/admin/osd/dashboard/page.tsx`          |
| `/admin/osd/dashboard/v2`       | OSD Dashboard V2 | OSD Admin (4)    | `app/(admin)/admin/osd/dashboard/v2/page.tsx`       |
| `/admin/osd/projects`           | OSD Project List | OSD Admin (4)    | `app/(admin)/admin/osd/projects/page.tsx`           |
| `/admin/osd/projects/new`       | OSD New Project  | OSD Admin (4)    | `app/(admin)/admin/osd/projects/new/page.tsx`       |
| `/admin/osd/projects/[id]/edit` | OSD Edit Project | OSD Admin (4)    | `app/(admin)/admin/osd/projects/[id]/edit/page.tsx` |
| `/admin/osd/reports`            | OSD Reports      | OSD Admin (4)    | `app/(admin)/admin/osd/reports/page.tsx`            |

## 5. Officer Screens

| Route                                                       | Screen                           | Primary Audience | Source File                                                                       |
| ----------------------------------------------------------- | -------------------------------- | ---------------- | --------------------------------------------------------------------------------- |
| `/projects`                                                 | Officer Projects (legacy path)   | Officer (2/6)    | `app/(officer)/projects/page.tsx`                                                 |
| `/projects/[projectId]/indicators`                          | Project Indicators (legacy path) | Officer (2/6)    | `app/(officer)/projects/[projectId]/indicators/page.tsx`                          |
| `/projects/[projectId]/indicators/[indicatorId]/progress`   | Indicator Progress (legacy path) | Officer (2/6)    | `app/(officer)/projects/[projectId]/indicators/[indicatorId]/progress/page.tsx`   |
| `/projects/[projectId]/indicators/[indicatorId]/upload`     | Indicator Upload (legacy path)   | Officer (2/6)    | `app/(officer)/projects/[projectId]/indicators/[indicatorId]/upload/page.tsx`     |
| `/projects/[projectId]/indicators/[indicatorId]/video`      | Indicator Video (legacy path)    | Officer (2/6)    | `app/(officer)/projects/[projectId]/indicators/[indicatorId]/video/page.tsx`      |
| `/officer/projects`                                         | Officer Projects                 | Officer (2/6)    | `app/(officer)/officer/projects/page.tsx`                                         |
| `/officer/projects/[projectPublicId]/indicators`            | Officer Project Indicators       | Officer (2/6)    | `app/(officer)/officer/projects/[pid]/indicators/page.tsx`                        |
| `/officer/projects/[pid]/indicators/[indicatorId]/progress` | Officer Indicator Progress       | Officer (2/6)    | `app/(officer)/officer/projects/[pid]/indicators/[indicatorId]/progress/page.tsx` |
| `/officer/projects/[pid]/indicators/[indicatorId]/upload`   | Officer Indicator Upload         | Officer (2/6)    | `app/(officer)/officer/projects/[pid]/indicators/[indicatorId]/upload/page.tsx`   |
| `/officer/projects/[pid]/indicators/[indicatorId]/video`    | Officer Indicator Video          | Officer (2/6)    | `app/(officer)/officer/projects/[pid]/indicators/[indicatorId]/video/page.tsx`    |
| `/officer/indicators/new`                                   | New Indicator                    | Officer (2/6)    | `app/(officer)/officer/indicators/new/page.tsx`                                   |
| `/officer/indicators/[id]/edit`                             | Edit Indicator                   | Officer (2/6)    | `app/(officer)/officer/indicators/[id]/edit/page.tsx`                             |
| `/officer/indicators/[id]/progress`                         | Indicator Progress (direct)      | Officer (2/6)    | `app/(officer)/officer/indicators/[id]/progress/page.tsx`                         |
| `/officer/indicators/[id]/upload`                           | Indicator Upload (direct)        | Officer (2/6)    | `app/(officer)/officer/indicators/[id]/upload/page.tsx`                           |
| `/officer/indicators/[id]/video`                            | Indicator Video (direct)         | Officer (2/6)    | `app/(officer)/officer/indicators/[id]/video/page.tsx`                            |
| `/officer/settings/change-password`                         | Officer Change Password          | Officer (2/6)    | `app/(officer)/officer/settings/change-password/page.tsx`                         |

## 6. Verification Screens

| Route                                | Screen                         | Primary Audience         | Source File                                             |
| ------------------------------------ | ------------------------------ | ------------------------ | ------------------------------------------------------- |
| `/verify/projects`                   | Verification Projects          | Verification Officer (1) | `app/(verify)/verify/projects/page.tsx`                 |
| `/verify/projects/[projectPublicId]` | Verification Project Detail    | Verification Officer (1) | `app/(verify)/verify/projects/[pid]/page.tsx`           |
| `/verify/indicators/[id]`            | Verify Indicator               | Verification Officer (1) | `app/(verify)/verify/indicators/[id]/page.tsx`          |
| `/verify/indicators/[id]/upload`     | Verify Indicator Upload Review | Verification Officer (1) | `app/(verify)/verify/indicators/[id]/upload/page.tsx`   |
| `/verify/indicators/[id]/video`      | Verify Indicator Video Review  | Verification Officer (1) | `app/(verify)/verify/indicators/[id]/video/page.tsx`    |
| `/verify/settings/change-password`   | Verify Change Password         | Verification Officer (1) | `app/(verify)/verify/settings/change-password/page.tsx` |

## 7. Secretary Screens

| Route                                 | Screen                    | Primary Audience | Source File                                                   |
| ------------------------------------- | ------------------------- | ---------------- | ------------------------------------------------------------- |
| `/secretary/dashboard`                | Secretary Dashboard       | Secretary (5)    | `app/(secretary)/secretary/dashboard/page.tsx`                |
| `/secretary/settings/change-password` | Secretary Change Password | Secretary (5)    | `app/(secretary)/secretary/settings/change-password/page.tsx` |

## 8. Layout Files

| Scope                     | Source File                    |
| ------------------------- | ------------------------------ |
| Global application layout | `app/layout.tsx`               |
| Admin route-group layout  | `app/(admin)/admin/layout.tsx` |

## 9. Notes

- This file indexes pages currently present in `app/**/page.tsx`.
- Access decisions are enforced by auth callbacks and session role logic; see `ROLE_MATRIX.md`.
- Some route families include both legacy and canonical officer paths to maintain compatibility.
- Canonical URL policy and migration path are defined in `ROUTING_CANONICALIZATION_PLAN.md`.
