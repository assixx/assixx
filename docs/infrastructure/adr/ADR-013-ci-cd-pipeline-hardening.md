# ADR-013: CI/CD Pipeline Hardening

| Metadata                | Value                                                     |
| ----------------------- | --------------------------------------------------------- |
| **Status**              | Amended                                                   |
| **Date**                | 2026-01-26 (amended 2026-02-05, 2026-03-21)               |
| **Decision Makers**     | SCS Technik                                               |
| **Affected Components** | GitHub Actions, code-quality-checks.yml, docker-build.yml |

---

## Context

An audit of the CI/CD pipeline revealed five weaknesses:

### 1. Frontend is never checked in CI

`code-quality-checks.yml` only ran backend checks (`cd backend && pnpm run typecheck/lint/prettier`). The root ESLint config explicitly ignores `frontend/**`. Neither Svelte Check, nor Frontend ESLint, nor Stylelint ran in CI. A completely broken frontend build could pass the PR.

Locally, `pnpm run validate:all` existed with full coverage -- but that is useless as a gatekeeper.

### 2. Trivy Security Scanner was decorative

The Trivy scan had `continue-on-error: true` on all steps. Discovered vulnerabilities (CRITICAL, HIGH, MEDIUM) were scanned but did not block any PR. The scanner was effectively a no-op.

### 3. GitHub Actions Cache disabled

Docker Build Cache (`cache-from: type=gha`) had been commented out since 2026-01-13 due to temporary GitHub 502/504 errors. After 13 days, the workaround had become a permanent state.

### 4. Bruno API tests only local

96 Bruno API requests with 169 tests exist only locally. No workflow runs them. **Intentionally not addressed** -- the decision whether to use Bruno, OpenAPI, Swagger, or Postman is still pending.

### 5. Outdated documentation "56 TypeScript Test Errors"

`CLAUDE.md` and `BEFORE-STARTING-DEV.md` documented 56 known TypeScript errors in test files. In reality, no test files (`*.test.ts`, `*.spec.ts`) exist in the backend. The documentation was outdated.

---

## Decision

### Fix 1: Frontend-Quality-Job in CI

New parallel job `frontend-quality` in `code-quality-checks.yml`:

| Check        | Command                                | What is checked     |
| ------------ | -------------------------------------- | ------------------- |
| Svelte Check | `cd frontend && pnpm run check`        | TypeScript + Svelte |
| ESLint       | `cd frontend && pnpm run lint`         | Code quality        |
| Prettier     | `cd frontend && pnpm run format:check` | Formatting          |
| Stylelint    | `pnpm run stylelint`                   | CSS/SCSS            |

The existing backend job was renamed to `backend-quality`. Both jobs run in parallel.

### Fix 2: Trivy as a Real Gate

Trivy was split into two steps:

| Step                                                   | Format | Severity     | exit-code | Blocks PR? |
| ------------------------------------------------------ | ------ | ------------ | --------- | ---------- |
| Check for critical vulnerabilities (blocks PR)         | table  | CRITICAL     | 1         | **Yes**    |
| Report HIGH and MEDIUM vulnerabilities (informational) | table  | HIGH, MEDIUM | 0         | No         |

- CRITICAL blocks the PR
- HIGH/MEDIUM are informational in the CI logs but do not block (Docker base images almost always have HIGH findings that are not actionable)
- Both steps use `scanners: "vuln"` -- secret scanning is disabled (Semgrep `p/security-audit` + `p/owasp-top-ten` already covers this)
- GHCR login is required since the Trivy job runs on its own runner and needs to pull the private image

**Amendment 2026-02-05:** SARIF upload and GitHub Security Tab integration removed. GitHub Code Security / Advanced Security is not enabled for the repository (paid feature for private repos). Table format in CI logs is sufficient for the visibility of HIGH/MEDIUM findings. Also removed `sleep 30` workaround -- `needs: build-and-push-image` already guarantees image availability.

### Fix 5: CodeQL workflow removed (Amendment 2026-02-05)

`codeql-analysis.yml` and `codeql-config.yml` were deleted:

- CodeQL SARIF upload requires GitHub Code Security / Advanced Security -- not enabled for this repository
- Semgrep (`p/security-audit`, `p/owasp-top-ten`) and ESLint security plugins (`eslint-plugin-no-unsanitized`) already cover the relevant findings
- CodeQL scan ran successfully (731/731 TS files), but the result could not be uploaded → CI failed

### Fix 6: Codecov Coverage Upload (Amendment 2026-03-21)

`codecov/patch` status check was permanently stuck at "Waiting for status to be reported", blocking PRs for over a week. Three root causes identified and fixed:

| Problem                          | Cause                                                                                                                              | Fix                                                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Token missing                    | `CODECOV_TOKEN` secret not set (Token length: 0)                                                                                   | Secret added to GitHub Actions                                                                                |
| Unusable report (path mismatch)  | `disable_search: false` auto-discovered `coverage-final.json` with absolute CI paths (`/home/runner/work/...`)                     | `disable_search: true` — only upload explicitly specified `lcov.info` (relative paths)                        |
| Unusable report (empty coverage) | `changed: 'main'` in `vitest.config.ts` + shallow clone (depth 1) → `main` branch unavailable → 0 files instrumented → 0% coverage | Removed `changed: 'main'` from config (CI needs full coverage; local devs can pass `--coverage.changed=main`) |

Additionally, `codecov.yml` status checks set to `informational: true` (project + patch) to prevent future blocking when workflows are skipped (e.g. docs-only PRs via `paths-ignore`).

### Fix 7: GitHub Actions Node.js 24 Migration (Amendment 2026-03-21)

GitHub deprecated Node.js 20 for Actions runners (forced Node.js 24 starting June 2, 2026). Updated across all workflows:

| Action                       | Old | New |
| ---------------------------- | --- | --- |
| `actions/checkout`           | v4  | v5  |
| `pnpm/action-setup`          | v2  | v4  |
| `docker/setup-buildx-action` | v3  | v4  |
| `docker/login-action`        | v3  | v4  |

### Fix 3: Cache re-enabled

`cache-from: type=gha` and `cache-to: type=gha,mode=max` uncommented again. GitHub cache issues from 2026-01-13 have long been resolved.

### Fix 4: Outdated documentation cleaned up

Three occurrences removed:

- `CLAUDE.md:245` -- "TypeScript Test Errors (56 errors)" line deleted
- `BEFORE-STARTING-DEV.md:26` -- "except for the 56 test errors" removed
- `BEFORE-STARTING-DEV.md:48` -- "except for the 56 known test errors" removed

---

## Alternatives Considered

### Frontend Checks: One Job vs. Two Jobs

| Option                           | Pros                            | Cons                  |
| -------------------------------- | ------------------------------- | --------------------- |
| **One job (Backend + Frontend)** | Fewer `pnpm install` runs       | Sequential, slower    |
| **Two parallel jobs (chosen)**   | Faster, clear error attribution | Double `pnpm install` |

Chosen: Two jobs. pnpm cache via `actions/setup-node` makes the install fast. Parallel execution reduces overall CI time.

### Trivy: CRITICAL-only vs. CRITICAL+HIGH as Gate

| Option                     | Pros                | Cons                                        |
| -------------------------- | ------------------- | ------------------------------------------- |
| **CRITICAL only (chosen)** | Few false positives | HIGH vulns do not block                     |
| CRITICAL + HIGH            | Stricter security   | Base image findings often block incorrectly |

Chosen: CRITICAL only as gate. HIGH is informational in the CI logs but does not block. Can be tightened to CRITICAL+HIGH if needed.

### Trivy: SARIF Upload vs. Table Output (Amendment 2026-02-05)

| Option                        | Pros                                  | Cons                                   |
| ----------------------------- | ------------------------------------- | -------------------------------------- |
| SARIF + Security Tab          | GitHub-native presentation            | Requires Code Security (paid feature)  |
| **Table in CI logs (chosen)** | No additional cost, directly readable | No central dashboard, only in run logs |

Chosen: Table format. Code Security is not enabled and not justified for current needs. When Code Security is activated, SARIF can be added back.

### API + E2E Tests in CI

API integration tests (Vitest, 753 tests) and E2E browser tests (Playwright, 20 tests) both require Docker services (Backend, PostgreSQL, Redis). The current CI runners use standard `ubuntu-latest` without Docker Compose.

**Options to enable in CI (not yet implemented):**

| Option                         | Pros                      | Cons                                     |
| ------------------------------ | ------------------------- | ---------------------------------------- |
| Docker Compose in CI           | Same env as local         | Slow startup (~60s), complex setup       |
| `services:` in GitHub Actions  | Native, no Compose needed | Limited to single containers per service |
| Self-hosted runner with Docker | Full control, fast        | Maintenance overhead                     |

**Current state:** Both test suites run locally only. Unit + frontend tests (no Docker) run in CI as merge gate. This is a deliberate trade-off — CI covers 7306 tests (unit + permission + frontend), local adds 773 (API + E2E).

---

## Consequences

### Positive

- Frontend errors now block PRs -- no more broken builds on main
- CRITICAL vulnerabilities in Docker images are actually blocked
- Docker builds are faster again thanks to cache
- Documentation reflects the actual state
- CI pipeline matches the local `pnpm run validate:all`

### Negative

- Two parallel jobs mean double `pnpm install` (mitigated by cache)
- CRITICAL-only gate could be too permissive (deliberate trade-off decision)
- CI runtime slightly increases due to second Trivy scan (~30s)
- No GitHub Security Tab for Trivy findings (Code Security not enabled) -- findings only visible in CI logs
- No CodeQL -- ESLint plugins are less comprehensive but sufficient for our stack

---

## References

- [GitHub Actions Cache Documentation](https://docs.github.com/en/actions/using-workflows/caching-dependencies-to-speed-up-workflows)
- [Trivy Action](https://github.com/aquasecurity/trivy-action)
- [adr.github.io](https://adr.github.io/)
- Audit result from 2026-01-26
