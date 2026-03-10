# ADR-018: Testing Strategy (Unit + API Integration)

| Metadata                | Value                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                          |
| **Date**                | 2026-02-04                                                                                        |
| **Decision Makers**     | SCS Technik                                                                                       |
| **Affected Components** | `vitest.config.ts`, `backend/test/`, `backend/src/**/*.test.ts`, `shared/src/**/*.test.ts`, CI/CD |

---

## Context

### Starting Point

Assixx had **no automated tests** until early 2026. API endpoints were manually tested with the Bruno Desktop app. There were:

- No unit tests
- No coverage measurement
- No test gate in CI/CD
- No regression protection during refactoring

### Problem: Manual Testing Does Not Scale

| Problem                    | Impact                                                                         |
| -------------------------- | ------------------------------------------------------------------------------ |
| No regression protection   | Refactoring breaks features that are only noticed in production                |
| Bruno CLI is fragile       | Rate limiting, state dependencies, no parallelizable feedback                  |
| No edge case documentation | `is_active` multi-state (0/1/3/4), password rules, coercion logic undocumented |
| No merge gate              | Broken code can land in `main`                                                 |
| No coverage tracking       | Unclear which code paths are tested                                            |

### Requirements

1. **Unit tests** for pure functions (helpers, schemas, utils) — fast, isolated, without DB/Docker
2. **API integration tests** for HTTP endpoints — against real Docker backend
3. **Unified tool** for both test types — no tool sprawl
4. **ESM-native** — Assixx uses `"type": "module"` throughout
5. **CI/CD integration** as merge gate — no broken features in `main`
6. **Phase-based rollout** — foundation first, expand gradually

---

## Decision Drivers

1. **ESM Compatibility** — Project uses `"type": "module"`, tool must support ESM natively
2. **Single-Tool Strategy** — One test runner for unit + integration, no Jest + Bruno + Supertest mix
3. **Speed** — Unit tests must run in <1s, no DI container overhead
4. **Workspace Support** — Separate projects for unit, permission (security-critical), frontend-unit, and API
5. **NestJS Independence** — Pure function tests don't need a DI container
6. **Reliability** — API tests must be 100% deterministic (no flakiness from rate limiting)

---

## Options Considered

### Option A: Jest + @nestjs/testing + Bruno CLI (keep existing)

**Pros:**

- NestJS documentation recommends Jest + @nestjs/testing
- Bruno CLI already exists (96 requests, 169 tests)
- Large community

**Cons:**

- **ESM Incompatible** — Jest requires `--experimental-vm-modules` flag, unstable with ESM
- **Slow** — @nestjs/testing starts DI container per test suite (~2-5s overhead)
- **Two Tools** — Bruno CLI for API, Jest for unit — different configs, outputs, CI setups
- **Bruno CLI fragile** — State dependencies (`bru.setVar()`), rate limiting breaks tests
- **No Workspace Support** — No native separation of unit vs. integration

**Verdict:** REJECTED — ESM incompatibility is a dealbreaker, two tools increase complexity

### Option B: Vitest + @nestjs/testing (DI Container Tests)

**Pros:**

- Vitest is ESM-native and fast
- @nestjs/testing allows service tests with real DI container

**Cons:**

- **Overhead** — DI container setup per suite (~2-5s), even though we're testing pure functions
- **Complexity** — Mocking providers, module registration, token injection
- **Fragility** — Tests break on DI refactoring (changing module structure = adapting tests)
- **Overkill** — 80% of our testable logic is pure functions (helpers, schemas, utils)

**Verdict:** REJECTED — Too much overhead for pure function tests. For service tests with DB dependency: `vi.mock()` instead of DI container.

### Option C: Vitest + native fetch() — Two-Tier Strategy (RECOMMENDED)

**Pros:**

- **ESM-native** — No workarounds, no `--experimental-vm-modules`
- **Single Tool** — Vitest for unit AND integration (workspace projects)
- **Fast** — 4110 unit tests in ~8s, 374 permission in ~1s, 238 frontend in <1s, 175 API in ~6s
- **Workspace Separation** — `--project unit` (fast, isolated) vs. `--project permission` (security-critical subset) vs. `--project api` (sequential, real HTTP)
- **Pure-Function-First** — No DI container for helpers/schemas/utils
- **fetch()-based** — API tests use native `fetch()`, no abstraction (Bruno CLI, Supertest)
- **Login Caching** — One login request for 175 tests (`isolate: false`)
- **Deterministic** — `flushThrottleKeys()` solves rate limit problem cleanly

**Cons:**

- **Service mocking needed** — For Phase 5+, DB calls must be manually mocked (`vi.mock()`)
- **No DI container validation** — We don't test whether NestJS DI is correctly wired (acceptable risk)
- **Sequential API tests** — `maxWorkers: 1` is slower than parallel execution (but necessary due to shared state)

**Verdict:** ACCEPTED — Best compromise of speed, simplicity, and reliability

---

## Decision

**Two-Tier Testing Strategy with Vitest as single test runner.**

### Architecture Schema

```
                        VITEST TEST PYRAMID
                        ==================

                         ┌─────────────┐
                         │   E2E Tests │  (Future: Playwright)
                         │   Browser   │  not part of this ADR
                         └──────┬──────┘
                                │
                   ┌────────────┴────────────┐
                   │  API Integration Tests   │  Tier 2: Real HTTP
                   │  32 files, 511 tests     │  against Docker backend
                   │  vitest --project api    │  Sequential, fetch()
                   └────────────┬─────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          │           Unit Tests                       │  Tier 1: Pure Functions
          │  223 files, 5363 tests                     │  No Docker needed
          │  vitest --project unit                     │  Parallel, <12s
          ├────────────────────────────────────────────┤
          │  🔴 Permission/Security Tests              │  Tier 1a: CRITICAL subset
          │  17 files, 380 tests                       │  Access control, auth, RBAC
          │  vitest --project permission               │  Badged: SECURITY:
          ├────────────────────────────────────────────┤
          │           Frontend Unit Tests              │  Tier 1b: Frontend Utils
          │  16 files, 330 tests (Phase 7+)            │  No Docker needed
          │  vitest --project frontend-unit            │  Parallel, <1s
          └────────────────────────────────────────────┘
```

### Tier 1: Unit Tests (Pure Functions)

| Aspect    | Decision                                                                     |
| --------- | ---------------------------------------------------------------------------- |
| Tool      | Vitest v4 (`vitest run --project unit`)                                      |
| Scope     | `backend/src/**/*.test.ts` + `shared/src/**/*.test.ts`                       |
| Execution | Parallel, isolated, <1s total duration                                       |
| Mocking   | `vi.mock()` for DB services (Phase 5+), `vi.useFakeTimers()` for dates       |
| Files     | Co-located: `source.ts` next to `source.test.ts`                             |
| Pattern   | AAA (Arrange-Act-Assert), one concept per `it()`, minimal input              |
| Coverage  | v8 Provider, HTML + JSON + Text Reporter                                     |
| Naming    | `describe('FunctionName')` > `describe('when context')` > `it('should ...')` |

**What is unit-tested:**

```
Phase 1: fieldMapper.ts          — dbToApi(), apiToDb()              ✅ 16 Tests
Phase 2: date-helpers.ts         — formatDate(), isToday(), etc.     ✅ 27 Tests
         is-active.ts            — Status constants                  ✅  9 Tests
Phase 3: common.schema.ts        — Zod schemas (ID, Email, PW)      ✅ 63 Tests
Phase 4: shifts.helpers.ts       — parseTime, calculateHours         ✅ 22 Tests
         users.helpers.ts        — mapSortField, buildUpdateFields   ✅ 20 Tests
         kvp.helpers.ts          — isUuid, buildFilterConditions     ✅ 24 Tests
         audit.helpers.ts        — sanitizeData, singularize         ✅ 41 Tests
Phase 5: Service logic (Mocking) — roles, rotation, features, auth   ✅ 86 Tests
Phase 6: Remaining helpers       — blackboard, calendar, chat, etc.  ✅ 27 Tests
Phase 7: Frontend utils          — password-strength, jwt, auth      ✅ 19 Tests
Phase 8: DTO validations         — All modules (13 files)            ✅ 460 Tests
Phase 9: Service coverage push   — 11 services: 47%→99% avg           ✅ ~930 Tests
Phase 10: New modules + coverage — organigram, TPM, vacation, halls    ✅ ~600 Tests
```

**What is NOT unit-tested:**

- `*.module.ts` — NestJS DI wiring (purely declarative)
- `*.controller.ts` — HTTP layer (Tier 2 covers this)
- `main.ts` — Bootstrap
- `index.ts` — Barrel exports
- `types/` — Pure type definitions

### Tier 2: API Integration Tests (Real HTTP)

| Aspect        | Decision                                                   |
| ------------- | ---------------------------------------------------------- |
| Tool          | Vitest v4 (`vitest run --project api`)                     |
| Scope         | `backend/test/**/*.api.test.ts`                            |
| Execution     | Sequential (`maxWorkers: 1`, `isolate: false`)             |
| HTTP Client   | Native `fetch()` — no abstraction (no Supertest, no Axios) |
| Auth          | `loginApitest()` — cached, one request for entire suite    |
| Rate Limiting | `flushThrottleKeys()` — flushes Redis `throttle:*` keys    |
| Timeout       | 30s per test, 30s per hook                                 |
| Prerequisite  | Docker backend running (`docker-compose up -d`)            |

**32 Modules, 511 Tests:**

| Module                    | Tests | Specifics                                   |
| ------------------------- | ----- | ------------------------------------------- |
| auth                      | 9     | Login + Refresh + Logout                    |
| users                     | 10    | CRUD + ensureTestEmployee                   |
| departments               | 9     | CRUD                                        |
| teams                     | 11    | CRUD + members                              |
| roles                     | 4     | Read-only                                   |
| notifications             | 13    | CRUD + preferences + stats                  |
| blackboard                | 18    | CRUD + comments + confirm + archive         |
| calendar                  | 8     | Events CRUD + dashboard                     |
| kvp                       | 15    | CRUD + categories + comments + dashboard    |
| assets                    | 15    | CRUD + categories + maintenance + stats     |
| surveys                   | 10    | CRUD + templates + statistics               |
| chat                      | 6     | Needs 2nd user (ensureTestEmployee)         |
| chat-e2e-messages         | 17    | E2E message CRUD + read receipts            |
| chat-e2e-roundtrip        | 7     | E2E encryption roundtrip                    |
| documents                 | 4     | Folders + list                              |
| dummy-users               | 18    | CRUD + auth + role restrictions             |
| e2e-keys                  | 9     | E2E encryption key management               |
| features                  | 17    | List + categories + my-features + plans     |
| halls                     | 10    | CRUD + area assignment                      |
| logs                      | 24    | Export JSON/CSV/TXT + validation + throttle |
| organigram                | 12    | Tree + hierarchy-labels + positions         |
| partitions                | 9     | Partition management + status               |
| settings                  | 4     | System + tenant + user + categories         |
| shifts                    | 12    | Rotation generation + week/history deletion |
| tpm-executions            | 63    | Full execution lifecycle + cards + status   |
| tpm-plans                 | 59    | Full plan CRUD + cards + scheduling         |
| tpm-schedule-projection   | 15    | Schedule projection + timeline              |
| user-permissions          | 16    | Permission CRUD + hierarchy                 |
| vacation                  | 36    | Full lifecycle + approval + calendar        |
| work-orders               | 36    | Full lifecycle + status + comments + stats  |
| work-orders-read-tracking | 13    | Read tracking + bulk mark                   |
| areas                     | 3     | List + stats                                |

**Critical Patterns:**

```typescript
// 1. Auth header separation (Fastify rejects Content-Type on body-less requests)
authHeaders(token)  // POST/PUT with body → includes Content-Type
authOnly(token)     // GET/DELETE → only Authorization

// 2. One-Request-per-Describe (prevents rate limiting)
describe('Module: List', () => {
  let res: Response;
  beforeAll(async () => { res = await fetch(...); });
  it('should return 200', () => { expect(res.status).toBe(200); });
});

// 3. Throttle flush for rate-limited endpoints
flushThrottleKeys();  // Redis EVAL deletes throttle:* keys
const res = await fetch(`${BASE_URL}/logs/export?format=json...`);
```

### Common Service Test Patterns

**ActivityLoggerService Mock (required in 48+ service tests):**

Every service that injects `ActivityLoggerService` needs this mock. Fire-and-forget calls (`void this.activityLogger.logCreate(...)`) don't affect test outcomes, but the mock must be provided to satisfy the constructor.

```typescript
// Factory function — reuse in all service tests
function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  } as unknown as ActivityLoggerService;
}

// Usage in test setup
const mockActivityLogger = createMockActivityLogger();
const service = new MyService(mockDb, mockActivityLogger);
```

**Key rules:**

- Always use `as unknown as ActivityLoggerService` — partial mock needs type assertion
- Never assert on `activityLogger` calls in unit tests — logging is a side effect, not business logic
- If a service adds `ActivityLoggerService` to its constructor, the test **must** provide the mock or it will fail with a DI error

### Vitest Config (Workspace Projects)

```typescript
// vitest.config.ts — 4 Projects
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['backend/src/**/*.ts', 'shared/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.module.ts',
        '**/*.controller.ts',
        '**/*.guard.ts',
        '**/main.ts',
        '**/index.ts',
        '**/types/**',
      ],
      thresholds: { lines: 83, functions: 83, branches: 76, statements: 83 },
    },
    projects: [
      // Tier 1: Unit Tests (backend + shared)
      {
        test: {
          name: 'unit',
          include: ['backend/src/**/*.{test,spec}.ts', 'shared/src/**/*.{test,spec}.ts'],
          testTimeout: 10_000,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      // Tier 1a: Permission/Security Tests (CRITICAL subset of unit)
      {
        test: {
          name: 'permission',
          include: [
            'backend/src/nest/admin-permissions/**/*.test.ts',
            'backend/src/nest/user-permissions/**/*.test.ts',
            'backend/src/nest/common/guards/permission.guard.test.ts',
            'backend/src/nest/common/decorators/require-permission.decorator.test.ts',
            'backend/src/nest/common/permission-registry/**/*.test.ts',
            'backend/src/nest/hierarchy-permission/**/*.test.ts',
            'backend/src/nest/calendar/calendar-permission.service.test.ts',
            'backend/src/nest/blackboard/blackboard-access.service.test.ts',
            'backend/src/nest/surveys/survey-access.service.test.ts',
            'backend/src/nest/auth/auth.service.test.ts',
            'backend/src/nest/roles/roles.service.test.ts',
            'backend/src/nest/role-switch/role-switch.service.test.ts',
          ],
          testTimeout: 10_000,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      // Tier 1b: Frontend Unit Tests (pure utils)
      {
        test: {
          name: 'frontend-unit',
          include: ['frontend/src/**/*.{test,spec}.ts'],
          testTimeout: 10_000,
          setupFiles: ['./vitest.frontend-setup.ts'],
        },
      },
      // Tier 2: API Integration Tests (real HTTP against Docker)
      {
        test: {
          name: 'api',
          include: ['backend/test/**/*.api.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          pool: 'forks',
          maxWorkers: 1, // Sequential (shared auth state)
          isolate: false, // Module cache shared (login only 1x)
        },
      },
    ],
  },
});
```

### All Test Commands (Quick Reference)

```bash
# ── All Tests ────────────────────────────────────────────────
pnpm test                                           # All 4 projects (unit + permission + frontend-unit + api)
pnpm test -- --reporter=verbose                     # With details

# ── Backend Unit Tests ────────────────────────────────────────
pnpm test --project unit                            # 5363 tests (~12s, no Docker)
pnpm vitest run --project unit -- backend/src/nest/auth/auth.service.test.ts  # Single file

# ── 🔴 Permission/Security Tests ─────────────────────────────
pnpm run test:permission                            # 380 tests (~1s, CRITICAL subset of unit)

# ── Frontend Unit Tests ───────────────────────────────────────
pnpm test --project frontend-unit                   # 330 tests (<1s, no Docker)

# ── API Integration Tests ────────────────────────────────────
pnpm test --project api                             # 511 tests (~14s, Docker MUST be running!)
pnpm vitest run --project api -- backend/test/calendar.api.test.ts  # Single module

# ── Coverage ──────────────────────────────────────────────────
pnpm test:coverage                                  # All projects with coverage
pnpm vitest run --project unit --project frontend-unit --coverage  # CI-relevant only (without api)

# ── CI Command (identical to GitHub Actions) ──────────────────
cd frontend && pnpm exec svelte-kit sync && cd ..   # Generate SvelteKit types
pnpm vitest run --project unit --project frontend-unit --coverage

# ── Watch Mode (Development) ─────────────────────────────────
pnpm test:watch                                     # All projects in watch mode
pnpm vitest --project unit                          # Watch only unit tests

# ── Browser UI ────────────────────────────────────────────────
pnpm test:ui                                        # Vitest UI at http://localhost:5175

# ── Linting (not Vitest, but relevant) ──────────────────────
docker exec assixx-backend pnpm exec eslint backend/src  # Backend ESLint
cd frontend && pnpm run lint                             # Frontend ESLint
pnpm run validate:all                                    # EVERYTHING at once
```

### Phase-Based Rollout

```
Phase 0: Config & Infrastructure    ✅ DONE     6/6 Checks
Phase 1: Proof of Concept          ✅ DONE    16 Tests   (fieldMapper)
Phase 2: Shared Package            ✅ DONE    36 Tests   (date-helpers, is-active)
Phase 3: Zod Schemas               ✅ DONE    63 Tests   (common.schema)
Phase 4: Backend Helpers            ✅ DONE   107 Tests   (shifts, users, kvp, audit)
Phase 5: Services (Mocking)         ✅ DONE    86 Tests   (roles, rotation, features, auth)
Phase 6: Remaining Helpers          ✅ DONE    27 Tests   (blackboard, calendar, chat, etc.)
Phase 7: Frontend Utils             ✅ DONE   238 Tests   (password-strength, auth, jwt, utils)
Phase 8: DTO Validations            ✅ DONE   460 Tests   (13 modules, 13 files)
Phase 9: Service Coverage Push      ✅ DONE   ~930 Tests  (11 services: 47%→99% avg)
Phase 10: New Modules + Coverage    ✅ DONE  ~600 Tests  (organigram, tpm, vacation, halls, etc.)
──────────────────────────────────────────────────────────────────────
TOTAL: 5363 Unit + 380 Permission (subset) + 330 Frontend + 511 API = 6204 Tests
──────────────────────────────────────────────────────────────────────
```

### Coverage Thresholds (raised 2026-03-10 after Phase 10)

| Metric     | Current (Phase 10) | Threshold (Floor) | Long-term Goal |
| ---------- | ------------------ | ----------------- | -------------- |
| Lines      | **87.57%**         | **83%**           | 90%            |
| Branches   | **81.45%**         | **76%**           | 85%            |
| Functions  | **88.89%**         | **83%**           | 90%            |
| Statements | **87.52%**         | **83%**           | 90%            |

> **Phase 10 added organigram, TPM, vacation, halls, dummy-users, and other modules.** Coverage rose from ~85% to ~88% across all metrics. Thresholds remain at 83%/76% (floor).

### CI/CD Integration (implemented 2026-02-05)

```yaml
# .github/workflows/code-quality-checks.yml — Job: unit-tests
unit-tests:
  runs-on: ubuntu-latest
  name: Unit Tests (Backend + Shared + Frontend)
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
      with: { version: 10.32.0 }
    - uses: actions/setup-node@v5
      with: { node-version: '24', cache: 'pnpm' }
    - run: pnpm install --frozen-lockfile
    - run: cd frontend && pnpm exec svelte-kit sync # SvelteKit Types!
    - run: pnpm vitest run --project unit --project frontend-unit --coverage
    - uses: actions/upload-artifact@v7
      if: always()
      with: { name: coverage-report, path: coverage/, retention-days: 30 }
```

**CI Learnings:**

- `svelte-kit sync` is **mandatory** — `frontend/tsconfig.json` extends `.svelte-kit/tsconfig.json`
- `*.guard.ts` excluded from coverage — Rollup cannot parse TypeScript decorators
- `*.test.ts` removed from `.prettierignore` — otherwise `validate:all` doesn't format test files, but CI checks them

**Important:** API integration tests (`--project api`) do NOT run in CI — they require Docker with DB/Redis.
Unit + frontend tests (`--project unit --project frontend-unit`) run in CI — they only need Node.js.

### Branch Protection (GitHub, configured)

```
Settings → Branches → main:
  ✅ Require status checks to pass
    ✅ Unit Tests (Backend + Shared + Frontend)
    ✅ Backend & Shared (TypeScript, ESLint, Prettier)
    ✅ Frontend (Svelte Check, ESLint, Prettier, Stylelint)
  ✅ Require branches to be up to date
```

> Requires GitHub Team Plan ($4/user/month) for private repos.

---

## Consequences

### Positive

- **Single Tool** — Vitest for unit + integration, no tool fragmentation
- **ESM-native** — No workarounds, no `--experimental-vm-modules` flags
- **Fast** — 5363 unit tests in ~12s, 380 permission tests in ~1s, 511 API tests in ~14s, 330 frontend tests in <1s
- **Deterministic** — `vi.useFakeTimers()` for dates, `flushThrottleKeys()` for rate limiting
- **Workspace Separation** — Unit tests (CI-compatible, no Docker) vs. API tests (Docker required)
- **Bruno CLI eliminated** — 329 npm packages removed, no state management via `bru.setVar()`
- **Tests as Documentation** — Edge cases (is_active multi-state, password NIST rules) become visible through tests
- **Bugs discovered and fixed through tests** — sanitizeData camelCase bug (SENSITIVE_FIELDS lowercase normalization, fixed 2026-02-05), EmailSchema trim order documented
- **Regression Protection** — 6204 automated tests (5363 unit + 380 permission [subset] + 330 frontend + 511 API)
- **CI as Merge Gate** — Unit tests + coverage thresholds block merge on failure
- **Coverage Floor** — Thresholds prevent coverage from gradually declining

### Negative

- **No DI Container Testing** — We don't test whether NestJS modules are correctly wired (acceptable risk — API tests cover this indirectly)
- **API Tests Need Docker** — Cannot run in standard CI, only locally or in Docker CI
- **Sequential API Tests** — `maxWorkers: 1` is slower than parallel (but necessary due to shared state)
- **Phase-based = Slow** — Full coverage expansion takes multiple phases
- **Service Mocking Overhead** — From Phase 5: `vi.mock()` for DB services must be maintained manually

### Neutral

- Bruno `.bru` files removed (were only used for CLI, desktop app is not used)
- `@usebruno/cli` dependency removed (-329 packages)
- `test:api` script redirected to Vitest (was previously Bruno CLI)
- Existing `vitest.setup.ts` retained (clearAllMocks, resetModules, test ENV vars)

---

## Resolved Issues (discovered through testing migration)

### 1. ResponseInterceptor Double-Wrapping (Shifts)

**Problem:** Controllers manually wrapped in `{ success, data }`, but the global `ResponseInterceptor` ALSO wraps — double wrapping.

**Fix:** 3 controller methods cleaned up (`rotation.controller.ts`, `shifts.controller.ts`). Controllers now return data directly.

**Affected Files:** `rotation.controller.ts:270-283`, `rotation.controller.ts:323-349`, `shifts.controller.ts:476-494`

### 2. ExportThrottle Rate Limiting (Logs)

**Problem:** `ExportThrottle` allows 1 request/minute. 6 sequential export requests in tests triggered 429 errors.

**Fix:** `flushThrottleKeys()` in `helpers.ts` — flushes Redis `throttle:*` keys via `docker exec` + EVAL. Auth tokens are cached in the Node process (not Redis), therefore safe.

### 3. KVP Team Lead Requirement

**Problem:** `kvp.service.ts` requires that admin/root user is a team leader (`orgInfo.teamLeadOf.length > 0`), otherwise 403.

**Fix:** DB setup: `UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1`

---

## Related Documents

- [VITEST-UNIT-TEST-PLAN.md](../../VITEST-UNIT-TEST-PLAN.md) — Detailed phase plan (Phase 0-8)
- [VITEST-API-MIGRATION.md](../../VITEST-API-MIGRATION.md) — Bruno → Vitest migration (103 tests)
- [HOW-TO-TEST-WITH-VITEST.md](../../HOW-TO-TEST-WITH-VITEST.md) — User guide for API tests
- [HOW-TO-CREATE-TEST-USER.md](../../HOW-TO-CREATE-TEST-USER.md) — Test-Tenant `apitest` erstellen (Voraussetzung für API Integration Tests)

## Related ADRs

- **ADR-001** — Rate Limiting (ExportThrottle: 1 req/min, relevant for logs tests)
- **ADR-005** — Authentication Strategy (JWT Guard, relevant for login caching)
- **ADR-007** — API Response Standardization (ResponseInterceptor, relevant for double-wrapping fix)
- **ADR-013** — CI/CD Pipeline Hardening (unit tests as future merge gate)

---

_Last Updated: 2026-03-10 (v7 - Full sync: 32 API modules (511 tests), 5363 unit tests, 330 frontend tests, 380 permission tests. Added organigram, TPM (executions/plans/schedule), vacation, halls, dummy-users, e2e-keys, chat-e2e, user-permissions, partitions, work-orders-read-tracking. Coverage: 87.5%/81.5%/88.9%/87.5%. Total: 6204 tests)_
