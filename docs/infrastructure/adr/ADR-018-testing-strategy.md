# ADR-018: Testing Strategy (Unit + API Integration + E2E + Load)

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
- **Fast** — 5568 unit tests in ~15s, 430 permission in ~4s, 399 frontend in <14s, 558 API in ~20s
- **Workspace Separation** — `--project unit` (fast, isolated) vs. `--project permission` (security-critical subset) vs. `--project api` (sequential, real HTTP)
- **Pure-Function-First** — No DI container for helpers/schemas/utils
- **fetch()-based** — API tests use native `fetch()`, no abstraction (Bruno CLI, Supertest)
- **Login Caching** — One login request for 558 tests (`isolate: false`)
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
                        ASSIXX TEST PYRAMID
                        ===================

                      ┌──────────────────────┐
                      │  Load / Perf (k6)     │  Tier 4: Performance
                      │  1 file, 10 endpoints │  Regression guard
                      │  pnpm run test:load:  │  Docker k6 image,
                      │  smoke                │  1 VU × 1 min (~65s)
                      └──────────┬───────────┘
                                 │
                      ┌──────────┴───────────┐
                      │   E2E Browser Tests   │  Tier 3: Playwright
                      │   3 files, 20 tests   │  Docker + Dev Server
                      │   pnpm run test:e2e   │  Chromium, ~25s
                      └──────────┬───────────┘
                                 │
                   ┌─────────────┴────────────┐
                   │  API Integration Tests    │  Tier 2: Real HTTP
                   │  43 files, 753 tests      │  against Docker backend
                   │  vitest --project api     │  Sequential, fetch()
                   └─────────────┬─────────────┘
                                 │
          ┌──────────────────────┴──────────────────────┐
          │           Unit Tests                         │  Tier 1: Pure Functions
          │  249 files, 6477 tests                       │  No Docker needed
          │  vitest --project unit                       │  Parallel, <15s
          ├──────────────────────────────────────────────┤
          │  🔴 Permission/Security Tests                │  Tier 1a: CRITICAL subset
          │  19 files, 430 tests                         │  Access control, auth, RBAC
          │  vitest --project permission                 │  Badged: SECURITY:
          ├──────────────────────────────────────────────┤
          │           Frontend Unit Tests                │  Tier 1b: Frontend Utils
          │  23 files, 399 tests                         │  No Docker needed
          │  vitest --project frontend-unit              │  Parallel, <14s
          └──────────────────────────────────────────────┘
```

### Tier 1: Unit Tests (Pure Functions)

| Aspect    | Decision                                                                     |
| --------- | ---------------------------------------------------------------------------- |
| Tool      | Vitest v4.1 (`vitest run --project unit`)                                    |
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
Phase 11: Org Scope + Hierarchy  — scope, hierarchy-permission, leads   ✅ ~150 Tests
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
| Tool          | Vitest v4.1 (`vitest run --project api`)                   |
| Scope         | `backend/test/**/*.api.test.ts`                            |
| Execution     | Sequential (`maxWorkers: 1`, `isolate: false`)             |
| HTTP Client   | Native `fetch()` — no abstraction (no Supertest, no Axios) |
| Auth          | `loginApitest()` — cached, one request for entire suite    |
| Rate Limiting | `flushThrottleKeys()` — flushes Redis `throttle:*` keys    |
| Timeout       | 30s per test, 30s per hook                                 |
| Prerequisite  | Docker backend running (`docker-compose up -d`)            |

**36 Modules, 574 Tests:**

| Module                    | Tests | Specifics                                   |
| ------------------------- | ----- | ------------------------------------------- |
| auth                      | 9     | Login + Refresh + Logout                    |
| auth-password-reset       | 16    | Forgot + Reset + Token reuse + E2E flow     |
| addons                    | 29    | Addon listing + tenant addon CRUD           |
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
| features                  | 1     | Feature flags                               |
| halls                     | 10    | CRUD + area assignment                      |
| logs                      | 24    | Export JSON/CSV/TXT + validation + throttle |
| org-scope                 | —     | Organizational scope queries (ADR-036)      |
| org-scope-manage          | —     | Scope management endpoints (ADR-036)        |
| organigram                | 16    | Tree + hierarchy-labels + positions + RBAC  |
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
      changed: 'main', // Vitest 4.1: only collect coverage for files changed vs. main
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
      thresholds: { lines: 86, functions: 87, branches: 80, statements: 86 },
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
            'backend/src/nest/common/guards/roles.guard.test.ts',
            'backend/src/nest/common/guards/jwt-auth.guard.test.ts',
            'backend/src/nest/common/decorators/require-permission.decorator.test.ts',
            'backend/src/nest/common/permission-registry/**/*.test.ts',
            'backend/src/nest/hierarchy-permission/**/*.test.ts',
            'backend/src/nest/calendar/calendar-permission.service.test.ts',
            'backend/src/nest/blackboard/blackboard-access.service.test.ts',
            'backend/src/nest/surveys/survey-access.service.test.ts',
            'backend/src/nest/documents/document-access.service.test.ts',
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

### Tier 3: E2E Browser Tests (Playwright)

| Aspect        | Decision                                                         |
| ------------- | ---------------------------------------------------------------- |
| Tool          | Playwright 1.59 (`pnpm run test:e2e`)                            |
| Scope         | `e2e/*.spec.ts`                                                  |
| Browser       | Chromium (Desktop Chrome device profile)                         |
| Execution     | Sequential (`workers: 1`), headless                              |
| Auth          | `storageState` pattern — auth.setup.ts logs in once, saves state |
| Dev Server    | Auto-started via `webServer` config (SvelteKit best practice)    |
| Rate Limiting | `globalSetup` flushes Redis `throttle:*` keys before suite       |
| Prerequisite  | Docker backend running (postgres, redis, backend)                |

**3 Files, 20 Tests:**

| File          | Tests | Specifics                                                  |
| ------------- | ----- | ---------------------------------------------------------- |
| auth.setup.ts | 1     | Login + storageState save (setup project, runs first)      |
| login.spec.ts | 7     | Login form, success, error, auth redirect, logout + modal  |
| smoke.spec.ts | 13    | Dashboard stats, sidebar modules, navigation, 6 page loads |

**Setup:**

- `webServer.command: 'pnpm run dev:svelte'` — auto-starts SvelteKit dev server
- `webServer.reuseExistingServer: false` — never reuses; ensures `webServer.env` overrides actually apply (footgun: a parallel `pnpm run dev:svelte` would inject real Turnstile keys, see HOW-TO-CLOUDFLARE-TURNSTILE)
- `webServer.env` — injects Cloudflare official Turnstile test keys (`1x00…AA`) so the invisible challenge auto-resolves in headless Chromium without bypassing the widget
- `globalSetup` — flushes Redis rate-limit keys (same pattern as API tests)
- `e2e/.auth/` — storageState files (gitignored)

**References:**

- [Svelte Testing Docs](https://svelte.dev/docs/svelte/testing)
- [SvelteKit Playwright CLI](https://svelte.dev/docs/cli/playwright)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

### Tier 4: Load & Performance Regression (k6)

Performance tests are a separate axis from functional tests — they measure
**how fast** endpoints respond, not **whether** they respond correctly. Added
2026-04-18 alongside the Tempo + OTel observability work (see ADR-048).
Expanded 2026-04-25 with a **Baseline** suite (mixed read/write, optional
WS-Soak, CI diff) covering ground Smoke cannot — namely write-amplification,
RLS-`set_config` overhead, pool-saturation knees, and persistent-connection
behaviour.

| Aspect        | Decision                                                                                              |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| Tool          | [k6](https://grafana.com/docs/k6/) via Docker (`grafana/k6:latest`)                                   |
| Scope         | `load/tests/*.ts` — `smoke.ts` + `baseline.ts`                                                        |
| Execution     | Smoke: 1 VU × 1 min · Baseline: ramping-vus, 5 VU light or 500 VU full                                |
| HTTP Client   | k6 built-in `k6/http` + `k6/ws` (k6 runs in goja VM, not Node)                                        |
| Auth          | `loginApitest()` in `load/lib/auth.ts` — port of `backend/test/helpers.ts`                            |
| Rate Limiting | Pre-step `test:load:flush` runs `FLUSHDB`; Baseline-Wrapper additionally `--user "$(id -u):$(id -g)"` |
| Thresholds    | Smoke: `p95 < 500 ms` · Baseline per-tag: `read p95 < 100`, `write p95 < 250`, `error rate < 0.1 %`   |
| TypeScript    | k6 ≥ 0.54 supports `.ts` natively — no transpile step; `load/tsconfig.json` for IDE                   |
| Prerequisites | Docker backend healthy, `assixx` tenant seeded, Redis reachable                                       |

#### Smoke: 1 file, 10 endpoints

Pre-release sanity gate. Hot-path endpoints that every user hits:

| #   | Endpoint                                | Why in smoke                    |
| --- | --------------------------------------- | ------------------------------- |
| 1   | `GET /health`                           | Baseline (no auth, no DB)       |
| 2   | `GET /api/v2/users/me/org-scope`        | Hot-path (ADR-035/036/039)      |
| 3   | `GET /api/v2/users?limit=10`            | Paginated list                  |
| 4   | `GET /api/v2/departments`               | Hierarchy read (ADR-034)        |
| 5   | `GET /api/v2/teams`                     | Hierarchy read (ADR-034)        |
| 6   | `GET /api/v2/blackboard/entries`        | RLS-filtered list (ADR-019)     |
| 7   | `GET /api/v2/notifications`             | Sidebar load                    |
| 8   | `GET /api/v2/calendar/events?from=&to=` | Date-range filter (heavy)       |
| 9   | `GET /api/v2/tpm/plans`                 | Paginated list (Addon, ADR-033) |
| 10  | `GET /api/v2/addons`                    | Tenant-addon catalog            |

**Baseline values (2026-04-25):** Smoke p95 ≈ 24 ms, p99 ≈ 39 ms, 0 % failure, 531/531 checks passing.

#### Baseline: 1 file, 70/30 read/write mix + optional WS-Soak

Beyond Smoke. Tagged read/write metrics, profile-driven VU ramps, automatic
cleanup of `LOAD-*`-tagged blackboard entries, snapshot-based regression diff.

**Throttler-Constraint (ADR-001 — non-negotiable):**

Rate limits are tracked PER JWT user-id. `admin` tier = 2000 reqs / 15 min ≈
2.2 req/s sustained per user. Single-tenant @ >5 VU produces 429s, not latency
data. Two profiles encode this reality:

| Profile | VU peak | Pool min          | Wall-time | Goal                                   |
| ------- | ------- | ----------------- | --------- | -------------------------------------- |
| `light` | 5       | 1 (assixx)        | ~5 min    | Regression detection + p95 drift       |
| `full`  | 500     | 5+ (multi-tenant) | ~8 min    | Pool-saturation knee, capacity ceiling |

`setup()` validates pool size and aborts if `PROFILE=full && pool < 5`.

**Per-tag thresholds (`load/tests/baseline.ts`):**

```ts
'http_req_duration{op:read}':       ['p(95)<100', 'p(99)<300']    // 4× Smoke baseline
'http_req_duration{op:write}':      ['p(95)<250', 'p(99)<800']    // RLS write + audit_trail (ADR-009)
'http_req_failed':                  ['rate<0.001']                // 0.1% error budget
'ws_connecting{scenario:ws_soak}':  ['p(95)<500']                 // WS handshake (when WS=1)
```

**Baseline values (2026-04-25, light profile):** read p95 ≈ 28 ms, read p99 ≈ 36 ms, write p95 ≈ 44 ms, write p99 ≈ 51 ms, 0 % failure (981/981 checks). Reproducibility drift between back-to-back runs <3 %.

**Wrapper script (`scripts/run-load-baseline.sh`)** — invoked via `test:load:baseline`:

1. Pre-flight: Postgres + Backend + Redis health check
2. Redis FLUSHDB (throttle reset)
3. `docker run --user "$(id -u):$(id -g)"` — fixes summary-export permission
4. Auto-cleanup of `LOAD-*` blackboard entries via `trap` (runs on pass, fail, Ctrl-C)
5. Snapshot bootstrap: writes `load/baselines/baseline-<profile>.json` if missing
6. CI diff against existing snapshot via `scripts/load-diff.ts`

**CI-Diff (`scripts/load-diff.ts`):**

Compares two k6 `--summary-export` JSON files. Fails if any tracked metric
regressed beyond budget:

| Metric                                | Mode     | Default tolerance      |
| ------------------------------------- | -------- | ---------------------- |
| `http_req_duration` p95/p99           | Relative | +20 % over baseline    |
| `http_req_duration{op:read}` p95/p99  | Relative | +20 %                  |
| `http_req_duration{op:write}` p95/p99 | Relative | +20 %                  |
| `http_req_failed` rate                | Absolute | +0.5 percentage points |

Exit code: 0 pass, 1 regression, 2 usage error. Designed for GitHub
Actions / GitLab CI.

**Tail-sampling cross-link (ADR-048 update 2026-04-25):**

OTel collector slow-trace threshold tightened from 500 ms → 200 ms in the same
PR as the baseline suite. With Smoke p95 = 24 ms and Baseline write p95 = 44 ms,
500 ms only caught 20×-median outliers; 200 ms is ~5× write-p95 = real outlier
territory. See [`docker/otel-collector/collector.yaml`](../../../docker/otel-collector/collector.yaml)
inline rationale.

**Commands:**

```bash
# Smoke (1 VU × 1 min) — pre-release sanity
pnpm run test:load:smoke

# Baseline light (default — single-tenant safe, ~5 min)
pnpm run test:load:baseline

# +WebSocket-Soak (50 persistent /chat-ws connections, parallel)
WS=1 pnpm run test:load:baseline

# Full capacity (~8 min — needs multi-tenant pool ≥ 5)
PROFILE=full LOGINS='[…5+ tenants…]' pnpm run test:load:baseline

# CI regression diff (after snapshot is checked in)
pnpm run test:load:diff -- \
  --baseline=load/baselines/baseline-light.json \
  --current=load/results/baseline-latest.json

# Manual cleanup (Wrapper does this automatically on every run)
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%';"

# Manual throttle flush (debugging)
pnpm run test:load:flush

# Full `pnpm test` includes Vitest + Playwright + k6 smoke (NOT baseline — too slow)
pnpm test
```

**Not in CI (yet):** load tests need Docker backend + Redis + Postgres. Currently
runs locally pre-merge. Scheduled CI against staging is the natural next step,
together with multi-tenant seed automation for `PROFILE=full`.

**References:**

- [load/README.md](../../../load/README.md) — complete setup + troubleshooting
- [`load/tests/baseline.ts`](../../../load/tests/baseline.ts) — file-header is the source-of-truth for baseline behaviour
- [`scripts/run-load-baseline.sh`](../../../scripts/run-load-baseline.sh) — wrapper script (pre-flight, cleanup, bootstrap, diff)
- [`scripts/load-diff.ts`](../../../scripts/load-diff.ts) — CI-grade JSON-summary diff
- [HOW-TO-TEST.md](../../how-to/HOW-TO-TEST.md) — task-oriented guide covering all 4 tiers, including baseline workflows
- [ADR-001 Rate Limiting](./ADR-001-rate-limiting.md) — throttler tiers (the math behind `light` vs `full` profiles)
- [ADR-048 Distributed Tracing with Tempo + OTel](./ADR-048-distributed-tracing-tempo-otel.md) — tail-sampling 200 ms threshold catches every Tier-4 outlier
- [k6 TypeScript Support](https://grafana.com/docs/k6/latest/using-k6/javascript-typescript-compatibility-mode/)

### All Test Commands (Quick Reference)

```bash
# ── All Tests ────────────────────────────────────────────────
pnpm test                                           # Vitest: unit + permission + frontend-unit + api
pnpm test -- --reporter=verbose                     # With details

# ── Backend Unit Tests ────────────────────────────────────────
pnpm test --project unit                            # 6477 tests (~15s, no Docker)
pnpm vitest run --project unit -- backend/src/nest/auth/auth.service.test.ts  # Single file

# ── 🔴 Permission/Security Tests ─────────────────────────────
pnpm run test:permission                            # 430 tests (~4s, CRITICAL subset of unit)

# ── Frontend Unit Tests ───────────────────────────────────────
pnpm test --project frontend-unit                   # 399 tests (<14s, no Docker)

# ── API Integration Tests ────────────────────────────────────
pnpm test --project api                             # 753 tests (~33s, Docker MUST be running!)
pnpm vitest run --project api -- backend/test/calendar.api.test.ts  # Single module

# ── E2E Browser Tests (Playwright) ───────────────────────────
pnpm run test:e2e                                   # 20 tests (~25s, Docker + auto-starts dev server)
pnpm run test:e2e:headed                            # With visible browser window
pnpm exec playwright test e2e/login.spec.ts         # Single spec file
pnpm run test:e2e:report                            # Open HTML report

# ── Load / Performance Tests (k6) ────────────────────────────
pnpm run test:load                                  # Alias for smoke (same command)
pnpm run test:load:smoke                            # 10 endpoints × 1 VU × 1 min (~65s, flushes Redis first)
pnpm run test:load:baseline                         # 70/30 read/write mix, ~5min light, auto-cleanup + snapshot diff
WS=1 pnpm run test:load:baseline                    # +WebSocket-Soak (50 persistent /chat-ws connections)
PROFILE=full LOGINS='[…]' pnpm run test:load:baseline # Capacity test, ~8min, needs multi-tenant pool ≥5
pnpm run test:load:diff -- --baseline=… --current=… # CI regression gate (exit 1 on >20% drift)
pnpm run test:load:flush                            # Flush Redis throttle keys (manual debug)

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
Phase 11: Org Scope + Hierarchy     ✅ DONE  ~150 Tests  (scope, hierarchy-permission, leads, ADR-036)
Phase 12: E2E Browser Tests         ✅ DONE    20 Tests  (Playwright: login, logout, dashboard, navigation, 6 page loads)
──────────────────────────────────────────────────────────────────────
TOTAL: 6477 Unit + 430 Permission (subset) + 399 Frontend + 753 API + 20 E2E = 8079 Tests
──────────────────────────────────────────────────────────────────────
```

### Coverage Thresholds (raised 2026-03-23)

| Metric     | Current (2026-03-23) | Threshold (Floor) | Long-term Goal |
| ---------- | -------------------- | ----------------- | -------------- |
| Lines      | **91.07%**           | **86%**           | 93%            |
| Branches   | **85.56%**           | **80%**           | 88%            |
| Functions  | **92.36%**           | **87%**           | 93%            |
| Statements | **91.35%**           | **86%**           | 93%            |

> **2026-03-23:** Thresholds von 83/76/83/83 auf 86/80/87/86 erhöht (~5% Puffer). Bisherige Long-term Goals (90/85/90/90) erreicht und übertroffen — neue Goals: 93/88/93/93. 6455 Unit+Frontend Tests (255 Dateien).

### Coverage Ignore Comments (v8 Provider)

Für unerreichbaren defensiven Code (z.B. `noUncheckedIndexedAccess` Guards, exhaustive `switch default`) nutzt das Projekt `/* v8 ignore next */`. **Quelle:** [Vitest Coverage Docs](https://vitest.dev/guide/coverage)

```typescript
// Nächsten Code-Knoten ignorieren (if-Block, Funktion, Klasse, switch-case)
/* v8 ignore next -- @preserve Begründung */
if (unreachableGuard) {
  throw new Error('dead code');
}

// switch default (exhaustive type union)
switch (level) {
  case 'read':
    return true;
  case 'write':
    return false;
  /* v8 ignore next -- @preserve exhaustive switch */
  default:
    return false;
}

// Ganzen Block ignorieren (start/stop)
/* v8 ignore start -- @preserve Begründung */
if (defensiveGuard) {
  throw new Error('dead code');
}
/* v8 ignore stop */

// if-Branch oder else-Branch selektiv ignorieren
/* v8 ignore if -- @preserve Begründung */
if (condition) {
  /* ignoriert */
} else {
  /* gezählt */
}

/* v8 ignore else -- @preserve Begründung */
if (condition) {
  /* gezählt */
} else {
  /* ignoriert */
}
```

**Regeln:**

- `/* v8 ignore next */` ignoriert den **nächsten AST-Knoten** (nicht nur die nächste Zeile!)
- Es gibt **kein** `/* v8 ignore next N */` — die Zahl-Syntax existiert nicht
- `-- @preserve` verhindert, dass Minifier den Kommentar entfernt
- Nur für **beweisbar unerreichbaren** Code — nicht als Ausrede für fehlende Tests

### CI/CD Integration (implemented 2026-02-05)

```yaml
# .github/workflows/code-quality-checks.yml — Job: unit-tests
unit-tests:
  runs-on: ubuntu-latest
  name: Unit Tests (Backend + Shared + Frontend)
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
      with: { version: 10.33.2 }
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

**Important:** API integration tests (`--project api`) and E2E browser tests (`pnpm run test:e2e`) do NOT run in CI — they require Docker with DB/Redis.
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
- **Fast** — 6477 unit tests in ~15s, 430 permission tests in ~4s, 769 API tests in ~33s, 399 frontend tests in <14s, 20 E2E tests in ~25s
- **Deterministic** — `vi.useFakeTimers()` for dates, `flushThrottleKeys()` for rate limiting
- **Workspace Separation** — Unit tests (CI-compatible, no Docker) vs. API tests (Docker required)
- **Bruno CLI eliminated** — 329 npm packages removed, no state management via `bru.setVar()`
- **Tests as Documentation** — Edge cases (is_active multi-state, password NIST rules) become visible through tests
- **Bugs discovered and fixed through tests** — sanitizeData camelCase bug (SENSITIVE_FIELDS lowercase normalization, fixed 2026-02-05), EmailSchema trim order documented
- **Regression Protection** — 8095 automated tests (6477 unit + 430 permission [subset] + 399 frontend + 769 API + 20 E2E)
- **Full-Stack E2E** — Playwright smoke tests verify the entire stack (Nginx → SvelteKit → NestJS → PostgreSQL) through a real browser
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

### 4. Persistent Test-Fixture Users (added 2026-04-26)

**Problem:** Three tests (`auth-forgot-password`, `security-settings`, `tenant-domains`) require a stable `perm-test-admin@assixx.com` admin user, and the kvp `/options caps users at 50` test asserts strict equality (`expect(users.length).toBe(50)`) which only holds with ≥51 active users in the tenant.

A fresh DB (e.g. after `apitest → assixx` rename migration of 2026-04-26 that hard-deleted 259 timestamped test-leftovers) starts with only 4 users. Vitest does not guarantee alphabetic file order, so a "create-on-demand" inside `admin-permissions.api.test.ts` cannot be relied on as a fixture for files that run before it.

**Fix:** `00-auth.api.test.ts` (file-name `00-` makes it run first under any discovery order) seeds two persistent fixture sets at the end of its run:

- `perm-test-admin@assixx.com` (admin role) — 1 user.
- `kvp-fixture-NNN@assixx.com` (employee role) — 50 users for the LIMIT cap.

Idempotent: emails are stable (no timestamp), so re-runs hit `409 Conflict` which the helper treats as success. Cost: ~19s on a fresh DB, <2s on subsequent runs.

These users are explicitly **not** cleaned by `global-teardown.ts` — see the NOTE in that file. They sit in the same accumulating-bucket as the timestamped throwaways (perm-api-test-{ts}, etc.) but with stable emails to stay idempotent.

---

## Related Documents

- [VITEST-UNIT-TEST-PLAN.md](../../VITEST-UNIT-TEST-PLAN.md) — Detailed phase plan (Phase 0-8)
- [VITEST-API-MIGRATION.md](../../VITEST-API-MIGRATION.md) — Bruno → Vitest migration (103 tests)
- [HOW-TO-TEST.md](../../how-to/HOW-TO-TEST.md) — User guide for API tests
- [HOW-TO-CREATE-TEST-USER.md](../../how-to/HOW-TO-CREATE-TEST-USER.md) — Test-Tenant `assixx` erstellen (Voraussetzung für API Integration Tests)

## Related ADRs

- **ADR-001** — Rate Limiting (ExportThrottle: 1 req/min, relevant for logs tests)
- **ADR-005** — Authentication Strategy (JWT Guard, relevant for login caching)
- **ADR-007** — API Response Standardization (ResponseInterceptor, relevant for double-wrapping fix)
- **ADR-013** — CI/CD Pipeline Hardening (unit tests as future merge gate)
- **ADR-036** — Organizational Scope Access Control (Phase 11: scope + hierarchy-permission tests)
- **ADR-048** — Distributed Tracing with Tempo + OTel (Tier 4 smoke exercises the observability pipeline end-to-end)

---

_Last Updated: 2026-04-25 (v13 - Tier 4 expansion: Baseline suite (`load/tests/baseline.ts`) added alongside smoke. Per-tag thresholds (read p95<100, write p95<250), profile-driven VU ramps (`light` 5 VU / `full` 500 VU), optional WS-Soak scenario (50 persistent /chat-ws connections), wrapper script (`scripts/run-load-baseline.sh`) with pre-flight + auto-cleanup + snapshot bootstrap + CI diff. New CI-grade diff utility (`scripts/load-diff.ts`) with 20% relative / 0.5pp absolute regression budgets. Tail-sampling threshold tightened 500ms → 200ms in `docker/otel-collector/collector.yaml` (cross-ADR-048). Baseline values: read p95≈28ms, write p95≈44ms, 0% failure. ADR title broadened to reflect Tier-3/4 inclusion. Companion HOW-TO renamed `HOW-TO-TEST-WITH-VITEST.md` → `HOW-TO-TEST.md` and expanded into umbrella covering all 4 tiers._

_Previously: 2026-04-18 (v12) — Tier 4 Load & Performance Regression tests with k6 v0.54+ (Docker `grafana/k6:latest`). 1 smoke test, 10 hot-path endpoints, 1 VU × 1 min, thresholds p95<500ms / p99<1000ms / err<1%. Baseline recorded: p95=23.64ms, p99=38.11ms. Integrated into `pnpm test`._
