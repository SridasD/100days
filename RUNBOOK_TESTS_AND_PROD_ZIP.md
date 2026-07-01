# HDP Runbook: Tests and Production Zip

Date: 2026-07-01
Workspace: HDP-2026

## 1) One-time machine setup

Run from project root:

```bash
npm ci
npx playwright install
```

Why:

- `npm ci` installs exact lockfile versions.
- Playwright browsers must be installed for E2E tests.

## 2) Daily validation flow (recommended)

### Quick local check

```bash
npm run typecheck
npm run lint
npm run test
```

### Full pipeline check

```bash
npm run test:all
```

Expected current baseline:

- typecheck: pass
- lint: pass (warnings may still appear)
- jest: pass
- playwright e2e: pass with scoped skips in baseline mode

## 3) Running E2E later (clear options)

### Baseline E2E (stable default)

```bash
npm run test:e2e
```

### Auth-coupled E2E (only in controlled environment)

Set env vars first, then run E2E:

PowerShell:

```powershell
$env:E2E_ENABLE_AUTH_TESTS = "true"
$env:E2E_LOGIN_NAME = "<valid-officer-login>"
$env:E2E_PASSWORD = "<valid-officer-password>"
npm run test:e2e
```

Notes:

- Use known seeded credentials.
- If login-dependent tests fail, verify DB user status/lockout and seed data.

### Browser-specific runs

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## 4) Create production zip

### Command

```bash
npm run zip:prod
```

### Verified output (example)

- Output folder: `deploy-zips/`
- File pattern: `HDP-2026-prod-source-clean-YYYYMMDD-HHmm.zip`
- Script validates that `app/api/uploads/[...path]/route.ts` exists in the archive.

### What the zip script excludes by design

- build/runtime artifacts (`.next`, `node_modules`, etc.)
- local env files (`.env*`)
- markdown files (`*.md`)
- PowerShell scripts (`*.ps1`)

Operational implication:

- This is a clean source artifact, not a documentation bundle.
- Share deployment docs separately if the receiving team needs them.

## 5) Pre-handoff checklist (before sending zip)

1. `npm run test:all` passes.
2. `npm run zip:prod` creates zip successfully.
3. Confirm zip exists in `deploy-zips/`.
4. Share env key list separately (never include real secret values).
5. Attach deployment/test runbook docs separately.

## 6) Troubleshooting quick reference

### Playwright browser missing

```bash
npx playwright install
```

### Login-dependent E2E failures

- Ensure `E2E_ENABLE_AUTH_TESTS=true` only when credentials are valid.
- Ensure test user exists and is active/unlocked.
- Re-check seeded credentials in DB.

### Lint warnings

- Non-blocking for current baseline unless your release policy requires zero warnings.
