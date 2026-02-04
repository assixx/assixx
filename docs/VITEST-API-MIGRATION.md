# Vitest API Test Migration

Migrate all 103 Bruno CLI API tests (18 modules) to Vitest integration tests using native `fetch()`.

## Current Status (2026-02-04)

```
Test Files: 18 passed (18)
     Tests: 175 passed (175)
   Passing: 100%
```

ESLint: 0 errors | TypeScript: 0 errors

## Architecture

```text
api-tests/
  vitest/
    helpers.ts                # Shared: login cache, authHeaders, authOnly, fetchWithRetry, flushThrottleKeys
    auth.api.test.ts          # Auth (setup + login + refresh + logout)
    users.api.test.ts         # Users CRUD
    departments.api.test.ts   # Departments CRUD
    teams.api.test.ts         # Teams CRUD
    roles.api.test.ts         # Roles
    notifications.api.test.ts # Notifications CRUD + preferences + stats
    blackboard.api.test.ts    # Blackboard CRUD
    calendar.api.test.ts      # Calendar events
    kvp.api.test.ts           # KVP (continuous improvement)
    machines.api.test.ts      # Machines CRUD
    surveys.api.test.ts       # Surveys CRUD
    chat.api.test.ts          # Chat (needs 2nd user via ensureTestEmployee)
    documents.api.test.ts     # Documents
    shifts.api.test.ts        # Shifts + rotation generation + cleanup
    logs.api.test.ts          # Audit log export (JSON/CSV/TXT + validation)
    settings.api.test.ts      # Tenant settings
    features.api.test.ts      # Feature flags
    areas.api.test.ts         # Areas
  environments/               # Bruno env files (kept for reference)
  auth/, users/, ...          # Bruno .bru files (kept until migration verified)
```

### helpers.ts Exports

| Export                 | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `BASE_URL`             | `http://localhost:3000/api/v2`                                |
| `loginBrunotest()`     | Cached login -- ONE HTTP request for entire suite             |
| `authHeaders(token)`   | `Authorization` + `Content-Type: application/json` (POST/PUT) |
| `authOnly(token)`      | `Authorization` only (GET/DELETE/PUT-without-body)            |
| `fetchWithRetry()`     | Auto-retry on 429 with exponential backoff                    |
| `flushThrottleKeys()`  | Flush Redis throttle keys (for export rate-limit bypass)      |
| `ensureTestEmployee()` | Create or find test employee (for chat tests)                 |
| `AuthState`            | Type: `{ authToken, refreshToken, userId, tenantId }`         |
| `JsonBody`             | Type: `Record<string, any>`                                   |

## How to Run

```bash
pnpm run test:api:vitest    # Run API integration tests (vitest run --project api)
pnpm run validate:all       # ESLint + TypeScript check (includes test files)
```

Requires Docker backend running (`doppler run -- docker-compose up -d`).

Rate limiting is handled automatically: `flushThrottleKeys()` clears Redis throttle keys
between log export requests. Manual flush is only needed if the test suite itself gets
rate-limited mid-run:

```bash
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' --no-auth-warning FLUSHDB
```

### Database Prerequisites (brunotest tenant, id=1)

These must be set once after initial DB setup. Without them, KVP tests fail:

```sql
-- Enable all features for brunotest tenant
INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at)
SELECT 1, id, 1, NOW() FROM features WHERE is_active = 1
ON CONFLICT (tenant_id, feature_id) DO UPDATE SET is_active = 1;

-- Set brunotest user (id=1) as team lead (required for KVP create)
UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1;
```

## Config

- File: `vitest.config.ts` (projects array -- `api` project)
- Pool: `forks`, `maxWorkers: 1`, `isolate: false` (sequential, shared module cache)
- Timeout: 30s per test / 30s per hook
- Include: `api-tests/vitest/**/*.api.test.ts`
- No setup file (no mocking -- real HTTP requests)
- TSConfig: `api-tests/tsconfig.json` (`moduleResolution: NodeNext` -- requires `.js` imports)

## Critical Lessons Learned

### 1. Fastify rejects Content-Type on body-less requests

Fastify returns **400 Bad Request** when `Content-Type: application/json` is sent on
requests WITHOUT a body (GET, DELETE, PUT-without-body). Bruno doesn't send Content-Type
for these, but our initial `authHeaders()` always included it.

**Fix:** Created `authOnly()` that only returns `Authorization` header.

```typescript
// POST/PUT with body → authHeaders (includes Content-Type)
fetch(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({...}) });

// GET/DELETE/PUT-without-body → authOnly (no Content-Type)
fetch(url, { headers: authOnly(token) });
fetch(url, { method: 'DELETE', headers: authOnly(token) });
```

### 2. One request per describe block

Bruno makes ONE request per `.bru` file. Each `it()` in Vitest must NOT make its own
`fetch()` -- that doubles HTTP calls and triggers rate limiting.

**Pattern:** Make the request in `beforeAll`, assert in synchronous `it()` blocks:

```typescript
describe('Module: Action', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(...);
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => { expect(res.status).toBe(200); });
  it('should have data', () => { expect(body.data).toBeDefined(); });
});
```

### 3. TypeScript casts for fetch

`res.json()` returns `Promise<unknown>` in Node types. Always cast explicitly:

```typescript
const body = (await res.json()) as JsonBody;  // correct
const body: JsonBody = await res.json();       // TS error
```

### 4. Import extensions required

`moduleResolution: NodeNext` requires `.js` extension on relative imports:

```typescript
import { ... } from './helpers.js';  // correct
import { ... } from './helpers';     // TS error
```

### 5. ResponseInterceptor double-wrapping

NestJS controllers that manually return `{ success: true, data: result }` get
double-wrapped by the global `ResponseInterceptor` into
`{ success: true, data: { success: true, data: {...} }, timestamp }`.

**Fix:** Controllers must return data directly. The interceptor handles wrapping.

```typescript
// WRONG -- double-wrapped
return { success: true, data: result };

// CORRECT -- interceptor wraps automatically
return result;
```

Affected: `rotation.controller.ts`, `shifts.controller.ts` (3 methods fixed,
other methods in both controllers still double-wrap -- fix for consistency).

### 6. ExportThrottle: 1 request per minute

The `ExportThrottle` decorator (see `throttle.decorators.ts`) limits exports to
**1 request per 60 seconds**. Redis keys use prefix `throttle:` (not `throttler:`).

**Fix for tests:** `flushThrottleKeys()` in `helpers.ts` flushes `throttle:*` keys
via `docker exec` + Redis EVAL. Auth tokens live in Node process memory, not Redis.

```typescript
// Before each export request in logs.api.test.ts
flushThrottleKeys();
const res = await fetch(url, { headers });
```

### 7. KVP requires team lead role

`kvp.service.ts` line 334: admin/root users can only create KVP suggestions if they are
a team lead (`orgInfo.teamLeadOf.length > 0`). The brunotest user must be set as
`team_lead_id` on at least one team in the database.

## Pattern Mapping: Bruno to Vitest

| Bruno                               | Vitest                                            |
| ----------------------------------- | ------------------------------------------------- |
| `bru.setVar("key", val)`            | `let key = val` (module-level)                    |
| `{{variable}}`                      | `${variable}` (template literal)                  |
| `res.getStatus()`                   | `res.status`                                      |
| `res.getBody()`                     | `(await res.json()) as JsonBody`                  |
| `assert { res.status: eq 200 }`     | `expect(res.status).toBe(200)`                    |
| `assert { res.body.X: isString }`   | `expect(body.X).toBeTypeOf('string')`             |
| `assert { res.body.X: isNumber }`   | `expect(body.X).toBeTypeOf('number')`             |
| `script:post-response`              | Inline after assertions                           |
| Sequential `.bru` files (meta.seq)  | Sequential `describe()` blocks + `it()` per check |
| `auth:bearer` on GET/DELETE         | `headers: authOnly(auth.authToken)`               |
| `auth:bearer` on POST/PUT with body | `headers: authHeaders(auth.authToken)`            |
| `bru.sendRequest()` (re-login)      | `await loginBrunotest()`                          |

## Test File Template

```typescript
import { type AuthState, BASE_URL, type JsonBody, authHeaders, authOnly, loginBrunotest } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginBrunotest();
});

// GET -- use authOnly (no Content-Type)
describe('Module: List', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/endpoint`, {
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// POST -- use authHeaders (includes Content-Type)
describe('Module: Create', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/endpoint`, {
      method: 'POST',
      headers: authHeaders(auth.authToken),
      body: JSON.stringify({ name: 'Test' }),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return created item', () => {
    expect(body.data).toHaveProperty('id');
  });
});

// DELETE -- use authOnly (no body)
describe('Module: Delete', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/endpoint/${id}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken),
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

## Definition of Done -- Per Module

- [x] All `.bru` files migrated to a single `{module}.api.test.ts`
- [x] Every `assert` block covered by `expect()` assertions
- [x] Every `tests` block test case represented as `it()` block
- [x] Every `script:post-response` state update handled via module-level variables
- [x] `beforeAll` handles login via `loginBrunotest()`
- [x] Prerequisite resources created in `beforeAll` (self-contained)
- [x] Test passes with `pnpm run test:api:vitest` (all 175 tests green)
- [x] No `any` without eslint-disable + justification comment
- [x] `body` typed as `JsonBody` via `as` cast
- [x] Unused variables prefixed with `_`
- [x] GET/DELETE use `authOnly()`, POST/PUT-with-body use `authHeaders()`
- [x] Conditional expects have `eslint-disable` with justification comment
- [x] Request consolidation: one `fetch()` per `describe` in `beforeAll`

## Definition of Done -- Overall Migration

- [x] All 18 modules migrated (code written)
- [x] `pnpm run test:api:vitest` -- all 175 tests green (100% passing)
- [x] No Vitest deprecation warnings
- [x] `helpers.ts` provides shared utilities (DRY)
- [x] Each test file self-contained (creates own prerequisites in beforeAll)
- [x] Conditional expects have eslint-disable with justification
- [x] ESLint: 0 errors across all test files
- [x] TypeScript: 0 errors across all test files
- [x] This document updated with final status

## Migration Status

| Module        | .bru Files | Status | Tests  | Pass   | Fail | Notes                                 |
| ------------- | ---------- | ------ | ------ | ------ | ---- | ------------------------------------- |
| auth (+setup) | 9          | DONE   | 9      | 9      | 0    |                                       |
| users         | 3          | DONE   | 10     | 10     | 0    |                                       |
| departments   | 5          | DONE   | 9      | 9      | 0    |                                       |
| teams         | 6          | DONE   | 11     | 11     | 0    |                                       |
| roles         | 3          | DONE   | 4      | 4      | 0    |                                       |
| notifications | 8          | DONE   | 9      | 9      | 0    |                                       |
| blackboard    | 11         | DONE   | 18     | 18     | 0    |                                       |
| calendar      | 6          | DONE   | 8      | 8      | 0    |                                       |
| kvp           | 9          | DONE   | 15     | 15     | 0    | Fixed: team lead + features enabled   |
| machines      | 9          | DONE   | 15     | 15     | 0    |                                       |
| surveys       | 7          | DONE   | 10     | 10     | 0    |                                       |
| chat          | 3          | DONE   | 6      | 6      | 0    |                                       |
| documents     | 2          | DONE   | 4      | 4      | 0    |                                       |
| shifts        | 6          | DONE   | 12     | 12     | 0    | Fixed: controller double-wrap removed |
| logs          | 6          | DONE   | 24     | 24     | 0    | Fixed: throttle key flush per request |
| settings      | 4          | DONE   | 4      | 4      | 0    |                                       |
| features      | 3          | DONE   | 4      | 4      | 0    |                                       |
| areas         | 2          | DONE   | 3      | 3      | 0    |                                       |
| **TOTAL**     | **103**    |**DONE**|**175** |**175** |**0** | **100% passing**                      |

## Resolved Failures (previously 20 tests, 3 modules)

### Logs -- 16 failures (RESOLVED)

**Root cause:** `ExportThrottle` allows 1 request per minute (see ADR-001). Six export
requests in sequence all got 429 after the first.

**Fix:** Added `flushThrottleKeys()` to `helpers.ts` which flushes `throttle:*` Redis keys
between requests. Auth tokens are cached in-process (not Redis), so this is safe.
All 6 requests are consolidated into a single top-level `beforeAll`.

### Shifts -- 3 failures (RESOLVED)

**Root cause:** Controllers in `rotation.controller.ts` and `shifts.controller.ts` manually
wrapped responses in `{ success: true, data: result }`, but the global `ResponseInterceptor`
ALSO wraps in `{ success: true, data: ..., timestamp }` -- causing double-wrapping.
Tests expected `body.data.shiftsCreated` but actual was `body.data.data.shiftsCreated`.

**Fix:** Removed manual `{ success, data }` wrapping from 3 controller methods:
- `generateRotationFromConfig()` in `rotation.controller.ts`
- `deleteRotationHistory()` in `rotation.controller.ts`
- `deleteShiftsByWeek()` in `shifts.controller.ts`

Controllers now return data directly; the ResponseInterceptor handles wrapping.

**Note:** Other methods in both shift controllers still double-wrap. They don't have
failing tests currently, but should be fixed for consistency.

### KVP -- 1 failure (RESOLVED)

**Root cause:** Two issues:
1. The brunotest user (root role) was NOT a team lead for any team. `kvp.service.ts`
   line 334-340 requires admin/root users to be team leads to create KVP suggestions.
2. No features were enabled for tenant 1 (tenant_features table was empty).

**Fix:**
1. Set brunotest user as team lead: `UPDATE teams SET team_lead_id = 1 WHERE id = 2`
2. Enabled all features: `INSERT INTO tenant_features ... SELECT 1, id, 1, NOW() FROM features`
