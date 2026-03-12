# API Integration Testing with Vitest

> **Vitest 4.1** runs as a pnpm dependency — no global install needed!
> 33 modules, 539 assertions, 100% passing.

---

## Isolated Test Tenant: apitest

Tests run in an **isolated tenant** called `apitest`:

- **Tenant**: API Test GmbH (ID: 1)
- **Admin**: admin@apitest.de / ApiTest12345!
- **Employee**: employee@apitest.de / ApiTest12345!
- **Domain**: apitest.de

**Benefits:**

- Test data does NOT pollute the dev tenant
- Reproducible tests
- Easy cleanup (only test tenant affected)

---

## Quick Start

```bash
# Run all API integration tests
pnpm run test:api

# Or directly with vitest CLI
vitest run --project api
```

---

## Prerequisites

### 1. Docker is running and healthy

```bash
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose ps

# Expected output: all containers "healthy"
```

### 2. Backend reachable

```bash
curl -s http://localhost:3000/health | jq .

# Expected output: { "status": "ok", ... }
```

### 3. Database Prerequisites (one-time after DB setup)

Without these, KVP tests will fail:

```sql
-- Enable all addons for apitest tenant
INSERT INTO tenant_addons (tenant_id, addon_id, status, activated_at)
SELECT 1, id, 'active', NOW() FROM addons WHERE is_active = 1
ON CONFLICT (tenant_id, addon_id) DO UPDATE SET status = 'active';

-- Set brunotest user (id=1) as team lead (required for KVP create)
UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1;
```

### 4. Rate Limit Problem?

```bash
# Symptom: 429 Too Many Requests on login

# Solution 1: Flush Redis rate-limit keys (auth tokens remain intact)
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB

# Solution 2: Full Docker restart
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose restart
sleep 20 && doppler run -- docker-compose ps
```

---

## Project Structure

```
backend/test/                              # NestJS convention: integration tests at project level
├── helpers.ts                             # Shared: login, auth headers, retry, throttle flush
├── global-teardown.ts                     # Global teardown (cleanup after all tests)
├── tsconfig.json                          # TS config (moduleResolution: NodeNext)
├── 00-auth.api.test.ts                    # Auth (login + refresh + logout)
├── addons.api.test.ts                     # Addons CRUD
├── areas.api.test.ts                      # Areas CRUD
├── assets.api.test.ts                     # Assets CRUD
├── blackboard.api.test.ts                 # Blackboard CRUD
├── calendar.api.test.ts                   # Calendar Events
├── chat.api.test.ts                       # Chat (requires 2nd user via ensureTestEmployee)
├── chat-e2e-messages.api.test.ts          # Chat E2E encrypted messages
├── chat-e2e-roundtrip.api.test.ts         # Chat E2E key roundtrip
├── departments.api.test.ts                # Departments CRUD
├── documents.api.test.ts                  # Documents
├── dummy-users.api.test.ts                # Dummy Users
├── e2e-keys.api.test.ts                   # E2E encryption keys
├── features.api.test.ts                   # Feature Flags
├── halls.api.test.ts                      # Halls CRUD
├── kvp.api.test.ts                        # KVP (Improvement Proposals)
├── logs.api.test.ts                       # Audit Log Export (JSON/CSV/TXT + Validation)
├── notifications.api.test.ts              # Notifications CRUD + preferences + stats
├── organigram.api.test.ts                 # Organigram
├── partitions.api.test.ts                 # Partitions (pg_partman)
├── roles.api.test.ts                      # Roles
├── settings.api.test.ts                   # Tenant Settings
├── shifts.api.test.ts                     # Shifts + Rotation + Cleanup
├── surveys.api.test.ts                    # Surveys CRUD
├── teams.api.test.ts                      # Teams CRUD
├── tpm-executions.api.test.ts             # TPM Executions
├── tpm-plans.api.test.ts                  # TPM Plans
├── tpm-schedule-projection.api.test.ts    # TPM Schedule Projections
├── user-permissions.api.test.ts           # User Permissions CRUD
├── users.api.test.ts                      # Users CRUD
├── vacation.api.test.ts                   # Vacation Requests
├── work-orders.api.test.ts                # Work Orders CRUD
└── work-orders-read-tracking.api.test.ts  # Work Orders Read Tracking
```

---

## Vitest Config

Defined in `vitest.config.ts` as the `api` project:

| Setting       | Value                           | Why                                           |
| ------------- | ------------------------------- | --------------------------------------------- |
| `name`        | `api`                           | Project selector: `--project api`             |
| `pool`        | `forks`                         | Process-based (no worker sharing)             |
| `maxWorkers`  | `1`                             | Sequential (tests share auth state)           |
| `isolate`     | `false`                         | Shared module cache (login request only once) |
| `testTimeout` | `30_000`                        | 30s per test (external HTTP calls)            |
| `hookTimeout` | `30_000`                        | 30s per beforeAll/afterAll                    |
| `include`     | `backend/test/**/*.api.test.ts` | Only `.api.test.ts` files                     |
| `globals`     | `true`                          | `describe`, `it`, `expect` without import     |

**No setup file:** No mocks — real HTTP requests against the Docker backend.

---

## npm Scripts

| Script                    | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `pnpm run test:api`       | Run all 33 modules (539 tests) with Vitest          |
| `pnpm run test:unit:leaks` | Unit tests with `--detect-async-leaks` (slow, debug) |

### Useful Vitest CLI Flags

```bash
# Run all tests
pnpm run test:api

# Run a single test file
vitest run --project api backend/test/calendar.api.test.ts

# Run multiple modules
vitest run --project api backend/test/auth.api.test.ts backend/test/users.api.test.ts

# Filter tests by name (--testNamePattern / -t)
vitest run --project api -t "should return 200"

# Verbose output (each test individually)
vitest run --project api --reporter verbose

# Watch mode (re-run on file changes)
vitest --project api

# With Vitest UI (browser dashboard on port 5175)
vitest --project api --ui
```

---

## Test Architecture

### Login Caching

`helpers.ts` caches the login request at module level. With `isolate: false`, only
**ONE** login request is made for the entire test run:

```typescript
// Every test file: same cached token
let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest(); // -> cached after first call
});
```

### One-Request-per-Describe Pattern

Each `describe` block makes **one** HTTP request in `beforeAll`.
The `it()` blocks only synchronously check the stored response:

```typescript
describe('Module: List', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/endpoint`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });
  it('should have data', () => {
    expect(body.data).toBeDefined();
  });
});
```

**Why:** This pattern prevents duplicate HTTP calls and rate-limiting issues.

### Auth Header Pattern

Fastify **rejects** `Content-Type: application/json` on requests WITHOUT a body (400 Bad Request).

```typescript
// POST/PUT with body -> authHeaders (includes Content-Type)
fetch(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({...}) });

// GET/DELETE/PUT-without-body -> authOnly (Authorization only)
fetch(url, { headers: authOnly(token) });
fetch(url, { method: 'DELETE', headers: authOnly(token) });
```

---

## helpers.ts Exports

| Export                 | Type / Signature                                 | Purpose                                                        |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `BASE_URL`             | `string`                                         | `http://localhost:3000/api/v2`                                 |
| `APITEST_EMAIL`        | `string`                                         | `admin@apitest.de`                                             |
| `APITEST_PASSWORD`     | `string`                                         | `ApiTest12345!`                                                |
| `loginApitest()`       | `() => Promise<AuthState>`                       | Cached login — ONE HTTP request for entire suite               |
| `authHeaders(token)`   | `(string) => Record<string, string>`             | `Authorization` + `Content-Type: application/json`             |
| `authOnly(token)`      | `(string) => Record<string, string>`             | `Authorization` only (for GET/DELETE)                          |
| `fetchWithRetry()`     | `(url, options?, retries?) => Promise<Response>` | Auto-retry on 429 with exponential backoff                     |
| `flushThrottleKeys()`  | `() => void`                                     | Flushes `throttle:*` Redis keys (for export rate limit)        |
| `ensureTestEmployee()` | `(token) => Promise<number>`                     | Creates/finds test employee (for chat tests)                   |
| `AuthState`            | `interface`                                      | `{ authToken, refreshToken, userId, tenantId }`                |
| `JsonBody`             | `type`                                           | `Record<string, any>` (integration tests verify via assertion) |

---

## Creating a New Test

### Template for GET (List)

```typescript
import { type AuthState, BASE_URL, type JsonBody, authOnly, loginApitest } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

describe('Module: List', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources`, {
      headers: authOnly(auth.authToken),
    });
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

### Template for POST (Create)

```typescript
import { type AuthState, BASE_URL, type JsonBody, authHeaders, authOnly, loginApitest } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// Shared state (like bru.setVar)
let resourceId: number;

describe('Module: Create', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources`, {
      method: 'POST',
      headers: authHeaders(auth.authToken), // includes Content-Type
      body: JSON.stringify({
        name: `Test ${Date.now()}`,
        description: 'Vitest API Test',
      }),
    });
    body = (await res.json()) as JsonBody;

    // Save state for subsequent describe blocks
    if (body.data?.id) {
      resourceId = body.data.id as number;
    }
  });

  it('should return 201 Created', () => {
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('should return created item with id', () => {
    expect(body.data).toHaveProperty('id');
  });
});

// Subsequent tests use resourceId
describe('Module: Get By ID', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources/${resourceId}`, {
      headers: authOnly(auth.authToken), // no Content-Type for GET
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// Cleanup
describe('Module: Delete', () => {
  it('should return 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/resources/${resourceId}`, {
      method: 'DELETE',
      headers: authOnly(auth.authToken), // no Content-Type for DELETE
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

### Template for Rate-Limited Endpoints (Export)

```typescript
import { type AuthState, BASE_URL, type JsonBody, authOnly, flushThrottleKeys, loginApitest } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

describe('Module: Export JSON', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    flushThrottleKeys(); // Flush Redis throttle:* keys BEFORE each request
    res = await fetch(`${BASE_URL}/logs/export?format=json&dateFrom=2026-01-01&dateTo=2026-01-31`, {
      headers: authOnly(auth.authToken),
    });
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });
});
```

---

## TypeScript Rules for Test Files

### 1. Import Extensions Required

`moduleResolution: NodeNext` in `backend/test/tsconfig.json` requires `.js` extension:

```typescript
import { ... } from './helpers.js';  // correct
import { ... } from './helpers';     // TS error
```

### 2. Cast Response Body

`res.json()` returns `Promise<unknown>` (Node types). Always cast explicitly:

```typescript
const body = (await res.json()) as JsonBody;  // correct
const body: JsonBody = await res.json();       // TS error
```

### 3. Conditional Expects

When assertions only run on existing data, they need `eslint-disable`:

```typescript
if (Array.isArray(body) && body.length > 0) {
  const entry = body[0] as JsonBody;
  // eslint-disable-next-line vitest/no-conditional-expect -- Integration: structure check only when data exists
  expect(entry).toHaveProperty('id');
}
```

### 4. No `any` Without Justification

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Integration: JsonBody = Record<string, any>
export type JsonBody = Record<string, any>;
```

---

## Troubleshooting

| Symptom                     | Cause                            | Solution                                                       |
| --------------------------- | -------------------------------- | -------------------------------------------------------------- |
| `429 Too Many Requests`     | Rate limit (login/export)        | Redis FLUSHDB (see above) or `flushThrottleKeys()`             |
| `401 Unauthorized`          | Token missing/expired            | Check login cache, restart Docker                              |
| `400 Bad Request`           | Content-Type on GET/DELETE       | Use `authOnly()` instead of `authHeaders()`                    |
| `400 Bad Request`           | Validation error                 | Check body format (Zod schema)                                 |
| `403 Forbidden` (KVP)       | User is not team lead            | `UPDATE teams SET team_lead_id = 1 WHERE id = 2`               |
| `403 Forbidden` (Addon)     | Addon not enabled                | `INSERT INTO tenant_addons ...` (see Prerequisites)            |
| `404 Not Found`             | Resource does not exist          | Create describe must come BEFORE Get/Delete                    |
| `500 Internal Server Error` | Backend bug                      | `docker logs assixx-backend`                                   |
| `ECONNREFUSED`              | Backend down                     | `doppler run -- docker-compose up -d`                          |
| `ECONNRESET`                | Backend crashed                  | `doppler run -- docker-compose restart`                        |
| Test timeout (30s)          | hookTimeout too short            | `beforeAll(async () => {...}, 60_000)` as 2nd argument         |
| Double-wrapped response     | Controller + ResponseInterceptor | Controller should return data directly (not `{success, data}`) |

### Debug: View Backend Logs

```bash
# Last 50 lines
docker logs assixx-backend --tail 50

# Live stream
docker logs assixx-backend -f
```

### Debug: Check Redis Rate-Limit Keys

```bash
# Show all throttle keys
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning KEYS 'throttle:*'

# Flush all keys (auth tokens are in Node process, NOT in Redis)
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

### Debug: Manually Test Individual Endpoints

```bash
# Login
curl -s http://localhost:3000/api/v2/auth/login \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF' | jq .
{"email":"admin@apitest.de","password":"ApiTest12345!"}
EOF

# GET with token
curl -s http://localhost:3000/api/v2/departments \
  -H "Authorization: Bearer <TOKEN>" | jq .
```

---

## Known Special Cases

### ResponseInterceptor Double-Wrapping

NestJS `ResponseInterceptor` wraps all responses in `{ success, data, timestamp }`.
Controllers must **NOT** manually wrap — otherwise double-wrapped:

```typescript
// WRONG — becomes { success, data: { success, data: {...} }, timestamp }
return { success: true, data: result };

// CORRECT — Interceptor wraps automatically
return result;
```

### ExportThrottle (1 Request/Minute)

`ExportThrottle` decorator allows only **1 request per 60 seconds** (ADR-001).
In tests: call `flushThrottleKeys()` before each export request.

### KVP Requires Team Lead Role

`kvp.service.ts` checks whether admin/root user is a team lead
(`orgInfo.teamLeadOf.length > 0`). Without team lead assignment -> 403 Forbidden.

---

## Interpreting Test Results

```
✓ backend/test/00-auth.api.test.ts (9 tests)
✓ backend/test/users.api.test.ts (10 tests)
...
✓ backend/test/work-orders.api.test.ts (12 tests)

Test Files  33 passed (33)
     Tests  539 passed (539)
  Start at  ...
  Duration  ...
```

- **Test Files**: Each `.api.test.ts` file = 1 module
- **Tests**: Each `it()` block = 1 test
- **Duration**: Total runtime (typically 10-15s with warm backend)

---

## Workflow: Testing a New Feature

```bash
# 1. Start Docker (if not running)
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose up -d

# 2. Run all API tests
pnpm run test:api

# 3. On failures: debug individual modules (verbose)
vitest run --project api backend/test/calendar.api.test.ts --reporter verbose

# 4. Check backend logs on 500 errors
docker logs assixx-backend --tail 100

# 5. Write new test
# -> Create file: backend/test/{module}.api.test.ts
# -> Pattern: import helpers.js -> beforeAll login -> describe-per-request -> it-per-assertion
# -> ESLint check: cd /home/scs/projects/Assixx && pnpm exec eslint backend/test/
```

---

_Created: 2026-02-04 | Updated: 2026-03-12_
