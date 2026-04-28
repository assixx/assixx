# HOW-TO-TEST

> **Single entry point** for every kind of test in Assixx — from <1 s unit tests
> to 8-minute capacity benchmarks.
>
> **Strategy & rationale:** [ADR-018 Testing Strategy](../infrastructure/adr/ADR-018-testing-strategy.md).
> This file is task-oriented: _"Which command, when, and with which prerequisite?"_

---

## TL;DR — which command when?

| Situation                                | Command                                                 | Duration | Tier    |
| ---------------------------------------- | ------------------------------------------------------- | -------- | ------- |
| During TDD on a single module            | `pnpm exec vitest --project unit <file>`                | s–min    | 1       |
| Before every commit                      | `pnpm run validate:all`                                 | ~30 s    | —       |
| Verify a backend code change             | `pnpm run test:api`                                     | ~33 s    | 2       |
| Verify a permission/auth change          | `pnpm run test:permission`                              | ~4 s     | 1a      |
| Frontend util change                     | `pnpm test --project frontend-unit`                     | <14 s    | 1b      |
| Change a UI flow (login, dashboard, nav) | `pnpm run test:e2e`                                     | ~25 s    | 3       |
| Pre-release smoke check                  | `pnpm run test:load:smoke`                              | ~65 s    | 4       |
| Suspected perf regression                | `pnpm run test:load:baseline`                           | ~5 min   | 4       |
| Capacity test (find pool saturation)     | `PROFILE=full LOGINS='[…]' pnpm run test:load:baseline` | ~8 min   | 4       |
| Full pipeline (pre-release tag)          | `pnpm test`                                             | ~3 min   | 1+2+3+4 |

---

## Prerequisites

### Docker (Tier 2, 3, 4)

```bash
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose ps
# All containers must be "healthy"

curl -s http://localhost:3000/health | jq .
# → { "status": "ok", ... }
```

### `assixx` tenant (Tier 2, 3, 4)

Isolated test tenant (id=1, domain=assixx.com):

| Role     | Email               | Password        |
| -------- | ------------------- | --------------- |
| Admin    | info@assixx.com     | `ApiTest12345!` |
| Employee | employee@assixx.com | `ApiTest12345!` |

Setup: [HOW-TO-CREATE-TEST-USER.md](./HOW-TO-CREATE-TEST-USER.md)

### Database setup (one-off after a fresh install)

```sql
-- Activate all addons for the assixx test tenant (otherwise KVP tests = 403)
INSERT INTO tenant_addons (tenant_id, addon_id, status, activated_at)
SELECT 1, id, 'active', NOW() FROM addons WHERE is_active = 1
ON CONFLICT (tenant_id, addon_id) DO UPDATE SET status = 'active';

-- assixx admin as team lead (KVP create requires this)
UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1;
```

### Rate-limit reset (on 429)

```bash
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

---

## Tier 1 — Unit Tests (Pure Functions)

**What:** `vitest --project unit` → 6477 tests in ~15 s. No Docker dependency.

**Where:** co-located next to the source files (`source.ts` + `source.test.ts`) in `backend/src/**` and `shared/src/**`.

**When to run:** during TDD, before every commit (indirectly part of `pnpm run validate:all` — type check + lint).

```bash
# All unit tests
pnpm run test:unit

# Single file (TDD workflow)
pnpm exec vitest --project unit backend/src/nest/auth/auth.service.test.ts

# Watch mode
pnpm exec vitest --project unit

# With coverage (locally)
pnpm run test:coverage
```

### Mocking pattern for services with a DB dependency

```ts
import { vi } from 'vitest';

// vi.mock() instead of @nestjs/testing — no DI container overhead.
// 80% of testable logic is pure functions that don't need DI at all.
const mockDb = { query: vi.fn(), tenantQuery: vi.fn() };
const service = new MyService(mockDb as never);
```

### `ActivityLoggerService` mock factory

Every service that injects `ActivityLoggerService` needs this mock.
Logging is a side effect — don't assert it, just provide it.

```ts
function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn(),
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  } as unknown as ActivityLoggerService;
}
```

### Coverage thresholds (CI gate)

| Metric     | Floor | Current |
| ---------- | ----- | ------- |
| Lines      | 86%   | 91.07%  |
| Branches   | 80%   | 85.56%  |
| Functions  | 87%   | 92.36%  |
| Statements | 86%   | 91.35%  |

`vitest.config.ts` aborts when these are not met.

---

## Tier 1a — Permission Tests (Security-Critical Subset)

**What:** curated subset of unit tests around auth, RBAC, RLS paths.
430 tests in ~4 s. Own Vitest project so the security gate stays visible
even during large refactors.

```bash
pnpm run test:permission
```

**Which files:** see `vitest.config.ts` → `projects.permission.include` —
covers `*-permission*.test.ts`, `auth.service.test.ts`, `roles.service.test.ts`,
`*permission.guard.test.ts`, `jwt-auth.guard.test.ts`, `*-access.service.test.ts`.

**When to run:** on every permission/guard/auth change BEFORE the PR.

---

## Tier 1b — Frontend Unit Tests

**What:** `vitest --project frontend-unit` → 399 tests in <14 s. Pure frontend utils
(password strength, JWT decode, URL helpers, session-expired logic).
No Docker dependency, no browser engine.

```bash
pnpm test --project frontend-unit
```

**When to run:** on changes in `frontend/src/lib/utils/**` or `$lib` helpers.

---

## Tier 2 — API Integration Tests (Real HTTP)

**What:** 753 tests in ~33 s against the running Docker backend (no mock).
Native `fetch()`, logged-in `assixx` admin, sequential execution.

### Quick start

```bash
pnpm run test:api

# Single module
pnpm exec vitest run --project api backend/test/calendar.api.test.ts

# Multiple modules
pnpm exec vitest run --project api backend/test/auth.api.test.ts backend/test/users.api.test.ts

# Filter by test name
pnpm exec vitest run --project api -t "should return 200"

# Verbose
pnpm exec vitest run --project api --reporter verbose

# Watch mode
pnpm exec vitest --project api

# Vitest UI (browser dashboard on :5175)
pnpm exec vitest --project api --ui
```

### Project structure

```
backend/test/
├── helpers.ts                     # login cache, authHeaders/authOnly, fetchWithRetry, flushThrottleKeys
├── global-teardown.ts             # cleanup after all tests
├── tsconfig.json                  # NodeNext resolution
├── 00-auth.api.test.ts            # auth (login + refresh + logout)
├── addons.api.test.ts             # addons CRUD
├── areas.api.test.ts              # areas CRUD
├── assets.api.test.ts             # assets CRUD
├── blackboard.api.test.ts         # blackboard CRUD
├── calendar.api.test.ts           # calendar events
├── chat.api.test.ts               # chat (needs a 2nd user via ensureTestEmployee)
├── chat-e2e-messages.api.test.ts  # E2E-encrypted messages
├── chat-e2e-roundtrip.api.test.ts # E2E key roundtrip
├── departments.api.test.ts        # departments CRUD
├── documents.api.test.ts          # documents
├── dummy-users.api.test.ts        # dummy users
├── e2e-keys.api.test.ts           # E2E encryption keys
├── features.api.test.ts           # feature flags
├── halls.api.test.ts              # halls CRUD
├── kvp.api.test.ts                # KVP (improvement proposals)
├── logs.api.test.ts               # audit log export (JSON/CSV/TXT)
├── notifications.api.test.ts      # notifications + preferences + stats
├── organigram.api.test.ts         # org chart
├── partitions.api.test.ts         # pg_partman partitions
├── roles.api.test.ts              # roles
├── settings.api.test.ts           # tenant settings
├── shifts.api.test.ts             # shifts + rotation + cleanup
├── surveys.api.test.ts            # surveys CRUD
├── teams.api.test.ts              # teams CRUD
├── tpm-executions.api.test.ts     # TPM executions
├── tpm-plans.api.test.ts          # TPM plans
├── tpm-schedule-projection.api.test.ts # TPM schedule
├── user-permissions.api.test.ts   # user permissions CRUD
├── users.api.test.ts              # users CRUD
├── vacation.api.test.ts           # vacation requests
├── work-orders.api.test.ts        # work orders CRUD
└── work-orders-read-tracking.api.test.ts # read tracking
```

### Vitest config (project `api`)

| Setting       | Value                           | Why                                   |
| ------------- | ------------------------------- | ------------------------------------- |
| `name`        | `api`                           | Project selector: `--project api`     |
| `pool`        | `forks`                         | Process-based (no worker sharing)     |
| `maxWorkers`  | `1`                             | Sequential (tests share auth state)   |
| `isolate`     | `false`                         | Module cache shared (login only once) |
| `testTimeout` | `30_000`                        | 30 s/test (external HTTP calls)       |
| `hookTimeout` | `30_000`                        | 30 s/hook                             |
| `include`     | `backend/test/**/*.api.test.ts` | Only `.api.test.ts` files             |
| `globals`     | `true`                          | `describe`, `it`, `expect` w/o import |

**No setup file:** no mocks — real HTTP requests against the Docker backend.

### `helpers.ts` — exports

| Export                 | Signature                                        | Purpose                                            |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------- |
| `BASE_URL`             | `string`                                         | `http://localhost:3000/api/v2`                     |
| `APITEST_EMAIL`        | `string`                                         | `info@assixx.com`                                  |
| `APITEST_PASSWORD`     | `string`                                         | `ApiTest12345!`                                    |
| `loginApitest()`       | `() => Promise<AuthState>`                       | Cached login — 1 HTTP request for the whole suite  |
| `authHeaders(token)`   | `(string) => Record<string, string>`             | `Authorization` + `Content-Type: application/json` |
| `authOnly(token)`      | `(string) => Record<string, string>`             | `Authorization` only (for GET/DELETE)              |
| `fetchWithRetry()`     | `(url, options?, retries?) => Promise<Response>` | Auto-retry on 429 with exponential backoff         |
| `flushThrottleKeys()`  | `() => void`                                     | Flushes `throttle:*` Redis keys (export limits)    |
| `ensureTestEmployee()` | `(token) => Promise<number>`                     | Creates/finds test employee (chat tests)           |
| `AuthState`            | `interface`                                      | `{ authToken, refreshToken, userId, tenantId }`    |
| `JsonBody`             | `type`                                           | `Record<string, any>`                              |

### Critical patterns

```ts
// 1. Header separation (Fastify rejects Content-Type for body-less requests)
authHeaders(token)  // POST/PUT with body → incl. Content-Type
authOnly(token)     // GET/DELETE → Authorization only

// 2. One request per describe (prevents rate limiting)
describe('Module: List', () => {
  let res: Response;
  beforeAll(async () => { res = await fetch(...); });
  it('should return 200', () => { expect(res.status).toBe(200); });
});

// 3. Throttle flush before rate-limited endpoints
flushThrottleKeys();  // Redis EVAL deletes throttle:* keys
const res = await fetch(`${BASE_URL}/logs/export?format=json...`);
```

### Templates

#### GET (list)

```ts
import { type AuthState, BASE_URL, type JsonBody, authOnly, loginApitest } from './helpers.js';

let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest();
});

describe('Module: List', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources`, { headers: authOnly(auth.authToken) });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });
  it('should return success true', () => {
    expect(body.success).toBe(true);
  });
  it('should return array', () => {
    expect(Array.isArray(body.data)).toBe(true);
  });
});
```

#### POST (create) + GET-by-ID + DELETE

```ts
import { type AuthState, BASE_URL, type JsonBody, authHeaders, authOnly, loginApitest } from './helpers.js';

let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest();
});

let resourceId: number;

describe('Module: Create', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ name: `Test ${Date.now()}`, description: 'Vitest API Test' }),
    });
    body = (await res.json()) as JsonBody;
    if (body.data?.id) resourceId = body.data.id as number;
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });
  it('should return created item with id', () => {
    expect(body.data).toHaveProperty('id');
  });
});

describe('Module: Get By ID', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources/${resourceId}`, { headers: authOnly(auth.authToken) });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe('Module: Delete', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/resources/${resourceId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

#### Rate-limited endpoint (export)

```ts
import { type AuthState, BASE_URL, type JsonBody, authOnly, flushThrottleKeys, loginApitest } from './helpers.js';

let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest();
});

describe('Module: Export JSON', () => {
  let res: Response;

  beforeAll(async () => {
    flushThrottleKeys();
    res = await fetch(`${BASE_URL}/logs/export?format=json&dateFrom=2026-01-01&dateTo=2026-01-31`, {
      headers: authOnly(auth.authToken),
    });
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });
});
```

### Architecture background

- **Login caching:** `helpers.ts` caches the login response at module level.
  With `isolate: false` you get **ONE** login for the entire test run.
- **One request per describe:** every `describe` block makes ONE HTTP call
  in `beforeAll`, and all `it()` blocks check the stored result synchronously.
  Avoids duplicates + rate-limit problems.

### Known special cases

#### ResponseInterceptor double-wrapping

NestJS `ResponseInterceptor` wraps every response in `{ success, data, timestamp }`.
Controllers must NOT wrap manually — otherwise it's wrapped twice:

```ts
// WRONG — becomes { success, data: { success, data: {...} }, timestamp }
return { success: true, data: result };

// RIGHT — interceptor wraps automatically
return result;
```

#### `ExportThrottle` (1 request/minute)

`@ExportThrottle()` only allows **1 request per 60 s** ([ADR-001](../infrastructure/adr/ADR-001-rate-limiting.md)).
In tests: `flushThrottleKeys()` before every export request.

#### KVP needs the team-lead role

`kvp.service.ts` checks whether an admin/root user is a team lead (`orgInfo.teamLeadOf.length > 0`).
Without a team-lead assignment → 403. See setup in Prerequisites.

---

## Tier 3 — E2E Browser Tests (Playwright)

**What:** 20 tests in ~25 s. Full stack: Nginx → SvelteKit → NestJS → Postgres.
Headless Chromium via Docker + automatic SvelteKit dev-server start.

```bash
pnpm run test:e2e                                  # all 20 tests
pnpm run test:e2e:headed                           # with a visible browser
pnpm exec playwright test e2e/login.spec.ts        # single spec
pnpm run test:e2e:report                           # open the HTML report
```

### Structure

```
e2e/
├── auth.setup.ts   # login + storageState save (setup project, runs first)
├── login.spec.ts   # 7 tests: login form, auth redirect, logout modal
├── smoke.spec.ts   # 13 tests: dashboard, sidebar, navigation, 6 page loads
└── .auth/          # storageState files (gitignored)
```

### Architecture

- **`webServer`** in `playwright.config.ts` starts `pnpm run dev:svelte` automatically.
- **`reuseExistingServer: false`** — important, otherwise parallel dev servers
  inject real Turnstile keys instead of the test keys.
- **`webServer.env`** injects Cloudflare's official Turnstile test keys
  (`1x00…AA`) → invisible challenge resolves automatically in headless Chromium.
- **`globalSetup`** flushes Redis rate-limit keys (same approach as Tier 2).
- **`storageState`** — `auth.setup.ts` logs in once, all other tests reuse.

**More:** [Playwright Best Practices](https://playwright.dev/docs/best-practices) ·
[Svelte Testing Docs](https://svelte.dev/docs/svelte/testing) ·
[Cloudflare Turnstile Setup](./HOW-TO-CLOUDFLARE-TURNSTILE.md)

---

## Tier 4 — Load & Performance Tests (k6)

**What:** performance regression detection. Measures _how fast_ endpoints
respond — Tier 1–3 measure _whether_ they respond correctly.

Docker-based (`grafana/k6:latest`) — no local k6 install needed.
TypeScript native via k6 ≥0.54.

**Strategy & tail-sampling integration:** [ADR-018 Tier 4](../infrastructure/adr/ADR-018-testing-strategy.md) +
[ADR-048 Distributed Tracing](../infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md).

### Smoke test (1 VU × 1 min)

Pre-release sanity check. 10 hot-path endpoints, 1 VU, 60 s, threshold p95<500 ms.

```bash
pnpm run test:load:smoke
```

Expected values (as of 2026-04-25): p95 ≈ 24 ms, p99 ≈ 39 ms, 0 % errors.

**When:** before every release tag, or when hot-path code has changed.

### Baseline test (5 VU light / 500 VU full + WS soak)

Mixed read+write load + optional WebSocket soak. **Per-tag thresholds**
(read p95<100, write p95<250). Auto cleanup. CI diff against the checked-in snapshot.

```bash
# Light (default — single-tenant safe, ~5 min)
pnpm run test:load:baseline

# +WebSocket soak (50 persistent /chat-ws connections)
WS=1 pnpm run test:load:baseline

# Full capacity (~8 min, requires multi-tenant pool)
PROFILE=full LOGINS='[
  {"email":"info@assixx.com","password":"ApiTest12345!"},
  {"email":"admin@tenant2.de","password":"…"},
  {"email":"admin@tenant3.de","password":"…"},
  {"email":"admin@tenant4.de","password":"…"},
  {"email":"admin@tenant5.de","password":"…"}
]' pnpm run test:load:baseline
```

#### Throttler constraint (ADR-001 — non-negotiable)

Rate limits are tracked PER JWT user ID:

| Tier    | Limit         | Sustained req/s/user |
| ------- | ------------- | -------------------- |
| `user`  | 1000 / 15 min | ~1.1                 |
| `admin` | 2000 / 15 min | ~2.2                 |

**Single tenant @ >5 VU = 429 storm** instead of latency data.

| Profile | VU peak | Min pool   | Wall time | Goal                                |
| ------- | ------- | ---------- | --------- | ----------------------------------- |
| `light` | 5       | 1 (assixx) | ~5 min    | Regression detection + p95 drift    |
| `full`  | 500     | 5+         | ~8 min    | Find pool-saturation breaking point |

`setup()` validates pool size and aborts when `PROFILE=full && pool<5`.

#### Per-tag thresholds

```ts
'http_req_duration{op:read}':  ['p(95)<100', 'p(99)<300']
'http_req_duration{op:write}': ['p(95)<250', 'p(99)<800']
'http_req_failed':             ['rate<0.001']
'ws_connecting{scenario:ws_soak}': ['p(95)<500']
```

Tighter than smoke (500/1000 ms) — catches real regressions, not just disasters.

#### Auto cleanup (built into the wrapper script)

`scripts/run-load-baseline.sh` does automatically:

1. Pre-flight (Postgres + backend + Redis reachable?)
2. Redis FLUSHDB (throttle reset)
3. k6 run with the correct user mapping (`--user "$(id -u):$(id -g)"`)
4. **Auto cleanup** of `LOAD-*` blackboard entries via `trap` (also on fail/Ctrl-C)
5. Snapshot bootstrap: creates `load/baselines/baseline-<profile>.json` if missing
6. Diff against the existing snapshot if one is checked in

**Manual git commit required** — the script must not touch git, but prints out
the exact command.

#### CI diff (regression gate)

```bash
# First bootstrap iteration: check in the snapshot (after an approved run)
git add load/baselines/baseline-light.json
git commit -m "perf: bootstrap baseline-light snapshot (read p95=Xms, write p95=Yms)"

# In CI on every PR (or locally):
pnpm run test:load:baseline
pnpm run test:load:diff -- \
  --baseline=load/baselines/baseline-light.json \
  --current=load/results/baseline-latest.json
# Exit 1 when p95/p99 regress by >20% or error rate rises by >0.5pp
```

#### Manual cleanup alternative (if the script was not used)

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%';"
```

#### Baseline harvest (manual, optional after a run)

```bash
# Top 10 slowest queries during the test run
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT left(query,80), calls, round(mean_exec_time::numeric,2) AS avg_ms \
   FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%' \
   ORDER BY total_exec_time DESC LIMIT 10;"

# Connection-pool saturation
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='assixx';"

# Slow traces (>200 ms) from Tempo since test start (tail-sampling threshold = 200 ms — ADR-048)
curl -s 'http://localhost:3200/api/search?minDuration=200ms&limit=20' | jq
```

**When:** on a DB migration, RLS policy change, connection-pool config, hot-path code,
major updates to `pg`/`pino`/`@nestjs/throttler`/`nestjs-cls`. Not on every PR.

---

## TypeScript rules for test files

### 1. Import extensions required

`moduleResolution: NodeNext` in `backend/test/tsconfig.json` requires the `.js` extension:

```ts
import { ... } from './helpers.js';   // correct
import { ... } from './helpers';      // TS error
```

### 2. Cast the response body

`res.json()` returns `Promise<unknown>` (Node types). Always cast explicitly:

```ts
const body = (await res.json()) as JsonBody;   // correct
const body: JsonBody = await res.json();       // TS error
```

### 3. Conditional expects

When assertions only run on existing data:

```ts
if (Array.isArray(body) && body.length > 0) {
  const entry = body[0] as JsonBody;
  // eslint-disable-next-line vitest/no-conditional-expect -- Integration: structure check only when data exists
  expect(entry).toHaveProperty('id');
}
```

### 4. No `any` without justification

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Integration: JsonBody = Record<string, any>
export type JsonBody = Record<string, any>;
```

---

## Coverage ignore comments (v8 provider)

For provably unreachable code (`noUncheckedIndexedAccess` guards, exhaustive `switch default`):

```ts
// Ignore the next code node (if block, function, switch case)
/* v8 ignore next -- @preserve reason */
if (unreachableGuard) {
  throw new Error('dead code');
}

// switch default
switch (level) {
  case 'read':
    return true;
  case 'write':
    return false;
  /* v8 ignore next -- @preserve exhaustive switch */
  default:
    return false;
}

// Ignore a block range
/* v8 ignore start -- @preserve reason */
// ... unreachable code ...
/* v8 ignore stop */

// Selectively ignore the if or else branch
/* v8 ignore if -- @preserve */
/* v8 ignore else -- @preserve */
```

**Important:** `/* v8 ignore next N */` (with a number) does **not** exist. `next` always
ignores the next AST node.

Full reference: [Vitest Coverage Docs](https://vitest.dev/guide/coverage)

---

## Troubleshooting

| Symptom                                | Tier  | Cause                              | Fix                                                                                      |
| -------------------------------------- | ----- | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `429 Too Many Requests` on login       | 2     | Rate limit (login/export)          | `flushThrottleKeys()` or `pnpm run test:load:flush`                                      |
| `401 Unauthorized`                     | 2     | Token missing/expired              | Check the login cache, restart Docker                                                    |
| `400 Bad Request`                      | 2     | Content-Type on GET/DELETE         | Use `authOnly()` instead of `authHeaders()`                                              |
| `400 Bad Request`                      | 2     | Validation error                   | Check the body format against the Zod schema                                             |
| `403 Forbidden` (KVP)                  | 2     | User is not a team lead            | `UPDATE teams SET team_lead_id = 1 WHERE id = 2` (see Prerequisites)                     |
| KVP `users.length === 50` fails        | 2     | <51 users in DB → cap untestable   | Run `00-auth.api.test.ts` once — it seeds 50 `kvp-fixture-NNN@assixx.com`                |
| Login `perm-test-admin@assixx.com` 401 | 2     | Fixture setup is needed once       | As above — `00-auth.api.test.ts` creates the user idempotently                           |
| `403 Forbidden` (addon)                | 2     | Addon not activated                | `INSERT INTO tenant_addons …` (see Prerequisites)                                        |
| `404 Not Found`                        | 2     | Resource does not exist            | Create `describe` must come BEFORE Get/Delete                                            |
| `500 Internal Server Error`            | 2     | Backend bug                        | `docker logs assixx-backend --tail 100`                                                  |
| `ECONNREFUSED`                         | 2/3/4 | Backend down                       | `cd docker && doppler run -- docker-compose up -d`                                       |
| `ECONNRESET`                           | 2     | Backend crashed                    | `doppler run -- docker-compose restart`                                                  |
| Test timeout (30 s)                    | 2     | hookTimeout too short              | `beforeAll(async () => {...}, 60_000)` as the second argument                            |
| Double-wrapped response                | 2     | Controller + ResponseInterceptor   | Controller should return `data` directly (not `{success, data}`)                         |
| Playwright `webServer.command failed`  | 3     | Port :5173 in use                  | `./scripts/free-port.sh 5173`                                                            |
| Turnstile challenge persists           | 3     | Real Turnstile key instead of test | Kill any parallel `pnpm run dev:svelte`, run only the Playwright-managed instance        |
| k6 `permission denied` on summary      | 4     | Docker user mismatch               | The wrapper script uses `--user "$(id -u):$(id -g)"` (in `scripts/run-load-baseline.sh`) |
| k6 `429` storm @ >5 VU single-tenant   | 4     | ADR-001 admin throttle 2000/15 min | Use `PROFILE=full LOGINS='[…5+ tenants…]'`                                               |
| Baseline `failed: refuses to start`    | 4     | `PROFILE=full` + pool < 5          | Extend the pool to 5+ logins or stay on `PROFILE=light`                                  |

### Debug — backend logs

```bash
docker logs assixx-backend --tail 50    # last 50 lines
docker logs assixx-backend -f           # live stream
```

### Debug — Redis rate-limit keys

```bash
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning KEYS 'throttle:*'

docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

### Debug — test individual endpoints manually

```bash
# Login
curl -s http://localhost:3000/api/v2/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"info@assixx.com","password":"ApiTest12345!"}' | jq .

# GET with token
curl -s http://localhost:3000/api/v2/departments \
  -H "Authorization: Bearer <TOKEN>" | jq .
```

---

## Interpreting test results

```
✓ backend/test/00-auth.api.test.ts (9 tests)
✓ backend/test/users.api.test.ts (10 tests)
...
✓ backend/test/work-orders.api.test.ts (12 tests)

Test Files  33 passed (33)
     Tests  539 passed (539)
  Duration  ...
```

- **Test Files:** every `.api.test.ts` = 1 module
- **Tests:** every `it()` block = 1 test
- **Duration:** total runtime (typically 10–15 s with a warm backend)

---

## Workflow: testing a new feature

```bash
# 1. Start Docker (if not running)
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose up -d

# 2. Before every commit
pnpm run validate:all

# 3. Backend logic changed
pnpm run test:unit                    # pure functions
pnpm run test:api                     # HTTP integration
# On failure: single module verbose
pnpm exec vitest run --project api backend/test/<module>.api.test.ts --reporter verbose
docker logs assixx-backend --tail 100 # on 500s

# 4. Permission/auth code changed
pnpm run test:permission

# 5. Frontend util changed
pnpm test --project frontend-unit
cd frontend && pnpm run check && pnpm run lint

# 6. UI flow changed
pnpm run test:e2e

# 7. Hot path / DB / connection pool changed
pnpm run test:load:baseline           # light, ~5 min
pnpm run test:load:diff -- \
  --baseline=load/baselines/baseline-light.json \
  --current=load/results/baseline-latest.json

# 8. Before a release tag
pnpm test                             # Vitest + Playwright + k6 smoke (~3 min)
```

### Writing a new Tier-2 test

1. Create the file: `backend/test/<module>.api.test.ts`
2. Pattern: `import helpers.js` → `beforeAll login` → `describe`-per-request → `it`-per-assertion
3. Lint check: `cd /home/scs/projects/Assixx && pnpm exec eslint backend/test/`
4. Run: `pnpm exec vitest run --project api backend/test/<module>.api.test.ts`

---

## Related documents

- [ADR-018 Testing Strategy](../infrastructure/adr/ADR-018-testing-strategy.md) — pyramid, tooling decisions, phase plan
- [ADR-001 Rate Limiting](../infrastructure/adr/ADR-001-rate-limiting.md) — throttler tiers (relevant for Tier 4 profiles)
- [ADR-048 Distributed Tracing](../infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md) — tail-sampling threshold (200 ms) catches Tier 4 outliers
- [HOW-TO-CREATE-TEST-USER.md](./HOW-TO-CREATE-TEST-USER.md) — assixx test-tenant setup
- [HOW-TO-CLOUDFLARE-TURNSTILE.md](./HOW-TO-CLOUDFLARE-TURNSTILE.md) — Tier 3 Turnstile test keys
- [load/README.md](../../load/README.md) — Tier 4 detailed configuration + next steps
- [`backend/test/helpers.ts`](../../backend/test/helpers.ts) — Tier 2 helpers, source of truth

---

_Last updated: 2026-04-25 — renamed from HOW-TO-TEST-WITH-VITEST.md, expanded to cover all 4 tiers (unit + permission + frontend-unit + API + E2E + load incl. baseline)._
