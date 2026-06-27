# HDP Canonical Routing Plan

## 1) Objective

Define one stable URL contract for each resource/page, reduce route duplication, remove database-ID coupling from public URLs, and introduce long-term enterprise-safe identifiers.

## 2) Design Principles

1. One canonical route per screen/resource.
2. Legacy routes remain redirect-only until decommissioned.
3. Business identifiers are display-level, not security boundary.
4. Public URL identity uses opaque identifiers (UUIDv7/ULID).
5. Authorization is mandatory for every read/write route.
6. Keep API paths versioned (`/api/v1/...`).

## 3) Identifier Strategy

Use dual identifiers per major entity:

1. Internal ID (existing bigint/int)

- Purpose: joins, foreign keys, internal persistence.
- Never trusted for access control.

2. Public ID (new UUIDv7/ULID)

- Purpose: external API and URL identity.
- Immutable once assigned.

3. Business Code (existing project code like `HDP-2026-0001`)

- Purpose: UI labels, reports, government communication.
- Not used as sole security boundary.

## 4) Canonical UI Route Targets

### Public

- `/public/projects/{projectPublicId}`
- `/public/departments/{departmentPublicId}`
- `/public/departments/{departmentPublicId}/projects/{projectPublicId}`
- `/public/sectors/{sectorPublicId}`
- `/public/gallery/projects/{projectPublicId}`

### Officer

- `/officer/projects`
- `/officer/projects/{projectPublicId}/indicators`
- `/officer/indicators/{indicatorPublicId}/edit`
- `/officer/indicators/{indicatorPublicId}/progress`
- `/officer/indicators/{indicatorPublicId}/upload`
- `/officer/indicators/{indicatorPublicId}/video`

### Verification

- `/verify/projects`
- `/verify/projects/{projectPublicId}`
- `/verify/indicators/{indicatorPublicId}`
- `/verify/indicators/{indicatorPublicId}/upload`
- `/verify/indicators/{indicatorPublicId}/video`

### Admin / OSD

- `/admin/projects`
- `/admin/projects/{projectPublicId}/edit`
- `/admin/projects/archive/{projectPublicId}`
- `/admin/users/{userPublicId}`
- `/admin/osd/projects/{projectPublicId}/edit`

## 5) Canonical API Targets

- `GET /api/v1/projects/{projectPublicId}`
- `PATCH /api/v1/projects/{projectPublicId}`
- `GET /api/v1/projects/{projectPublicId}/indicators`
- `POST /api/v1/projects/{projectPublicId}/indicators`
- `GET /api/v1/indicators/{indicatorPublicId}`
- `PATCH /api/v1/indicators/{indicatorPublicId}`
- `DELETE /api/v1/indicators/{indicatorPublicId}`

## 6) Nesting Policy

Use both nested and flat endpoints intentionally:

1. Nested collections for context-constrained listing/creation

- `/projects/{projectPublicId}/indicators`

2. Flat single-resource operations for direct access

- `/indicators/{indicatorPublicId}`

This avoids deep hierarchy coupling while preserving readable domain context.

## 7) Current-to-Target Mapping (Priority)

### High Priority (legacy duplication)

- `/projects/{projectId}/indicators` -> `/officer/projects/{projectPublicId}/indicators`
- `/projects/{projectId}/indicators/{indicatorId}/progress` -> `/officer/indicators/{indicatorPublicId}/progress`
- `/projects/{projectId}/indicators/{indicatorId}/upload` -> `/officer/indicators/{indicatorPublicId}/upload`
- `/projects/{projectId}/indicators/{indicatorId}/video` -> `/officer/indicators/{indicatorPublicId}/video`

### Param normalization

- `[id]`, `[pid]`, `[project_id]`, `[projectId]` -> `[projectPublicId]`
- `[indicatorId]`, `[id]` -> `[indicatorPublicId]`

## 8) Security Requirements

1. Prevent enumeration by using opaque public IDs.
2. Enforce object-level authorization in every handler.
3. Add rate limiting on high-volume read endpoints.
4. Log suspicious 404/403 scans by actor/IP and route pattern.
5. Do not leak internal IDs in response payloads unless required for internal admin tooling.

## 9) Migration Phases

### Phase 0: Contract Definition (Now)

- Freeze canonical naming conventions.
- Publish this plan and align team.

### Phase 1: Data Layer Readiness

- Add `public_id` columns for project, indicator, user, department, sector.
- Backfill for existing records.
- Add unique indexes and not-null constraints.

### Phase 2: Parallel Routes

- Add canonical route handlers using `public_id`.
- Keep existing numeric routes active.

### Phase 3: Redirect and Link Cutover

- Redirect legacy UI routes to canonical routes.
- Update all internal links, emails, exports, and notifications.

### Phase 4: API Versioning and Deprecation

- Introduce `/api/v1` canonical endpoints.
- Mark numeric-ID endpoints as deprecated.
- Remove legacy endpoints after telemetry shows low usage.

## 10) Acceptance Criteria

1. Every screen has one canonical URL.
2. Legacy routes are redirect-only.
3. No new feature is built on legacy routes.
4. Public/bookmarkable URLs do not expose raw DB IDs.
5. Route naming is consistent across UI and API.

## 11) Non-Goals

1. Removing internal numeric IDs from database schema.
2. Using project code as sole security mechanism.
3. Big-bang cutover without backward compatibility.
