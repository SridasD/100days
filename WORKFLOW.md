# HDP 2026 Development Workflow

This document defines the standard workflow for day-to-day development in this repository.

## 1. Branching Model

- Base branch: `main`
- Feature and fix branches: create from latest `main`
- Recommended branch naming:
  - `feature/<area>-<short-topic>`
  - `fix/<area>-<short-topic>`
  - `hotfix/<area>-<short-topic>`
  - `safety/<topic>-<yyyymmdd>` (used for guarded follow-up changes)

Examples:

- `feature/profile-role-routing`
- `fix/officer-project-filter`
- `safety/level2-followup-20260626`

## 2. Start Work

1. Sync local repo:
   - `git checkout main`
   - `git pull --ff-only origin main`
2. Create a new branch from `main`:
   - `git checkout -b feature/<area>-<short-topic>`
3. Implement changes in small, reviewable increments.

## 3. Local Quality Gates

Before committing, run:

- `npm install` (if dependencies changed)
- `npm run typecheck`
- `npm run lint` (if configured)
- `npm run dev` and validate affected screens/routes manually

For DB-related changes:

- Add migration SQL under `lib/db/migrations/`
- Validate against the `hdp` schema rules from project docs

## 4. Commit Standards

- Commit only related changes together.
- Use clear commit messages in imperative style.

Suggested format:

- `<scope>: <what changed>`

Examples:

- `auth: add role-aware profile home redirect`
- `officer: allow secretary role to load scoped projects`

## 5. Push and PR Flow

1. Push branch:
   - `git push -u origin <branch-name>`
2. Open PR to `main`.
3. Include in PR description:
   - Problem statement
   - Scope of change
   - API or DB impact
   - Test evidence (typecheck, screenshots, manual checks)

## 6. Merge Policy

- Preferred: merge via Pull Request.
- If direct local merge is required:
  1. `git checkout main`
  2. `git pull --ff-only origin main`
  3. `git merge --no-ff <branch-name>`
  4. `git push origin main`

Always verify after merge:

- `git status --short --branch`
- `git rev-list --left-right --count "@{u}...HEAD"`

Expected synced output for final command: `0 0`.

## 7. Conflict Resolution

- Resolve conflicts in branch first, not directly in an unrelated working tree.
- Keep conflict resolution focused; avoid opportunistic refactors.
- Re-run quality gates after conflicts are resolved.

## 8. Deployment Handoff Checklist

Before production handoff:

- `main` is clean and synced with `origin/main`
- Required migrations are committed
- Role-based access paths are manually validated
- API responses for changed endpoints are verified
- Any archive/restore behavior is validated for admin flows

## 9. Reference Docs

- `README.md`
- `HDP_Platform_Blueprint_v2.md`
- `PROJECT_ARCHIVE_WORKFLOW_SPEC.md`
- `PRODUCTION_DEPLOYMENT_STEPS.md`
