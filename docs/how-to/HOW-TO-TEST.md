# HOW-TO-TEST

> **Single entry point** für jede Art von Test in Assixx — vom <1s-Unit-Test
> bis zum 8-Minuten-Capacity-Benchmark.
>
> **Strategie & Begründungen:** [ADR-018 Testing Strategy](../infrastructure/adr/ADR-018-testing-strategy.md).
> Diese Datei ist task-orientiert: _„Welcher Befehl, wann, mit welcher Voraussetzung?"_

---

## TL;DR — welcher Befehl wann?

| Situation                                     | Befehl                                                  | Dauer  | Tier    |
| --------------------------------------------- | ------------------------------------------------------- | ------ | ------- |
| Während TDD am einzelnen Modul                | `pnpm exec vitest --project unit <file>`                | s–min  | 1       |
| Vor jedem Commit                              | `pnpm run validate:all`                                 | ~30 s  | —       |
| Backend-Code-Änderung verifizieren            | `pnpm run test:api`                                     | ~33 s  | 2       |
| Permission-/Auth-Änderung verifizieren        | `pnpm run test:permission`                              | ~4 s   | 1a      |
| Frontend-Util-Änderung                        | `pnpm test --project frontend-unit`                     | <14 s  | 1b      |
| UI-Flow ändern (Login, Dashboard, Navigation) | `pnpm run test:e2e`                                     | ~25 s  | 3       |
| Pre-Release Smoke-Sicherheit                  | `pnpm run test:load:smoke`                              | ~65 s  | 4       |
| Verdacht auf Perf-Regression                  | `pnpm run test:load:baseline`                           | ~5 min | 4       |
| Capacity-Test (Pool-Saturation finden)        | `PROFILE=full LOGINS='[…]' pnpm run test:load:baseline` | ~8 min | 4       |
| Vollständige Pipeline (Pre-Release-Tag)       | `pnpm test`                                             | ~3 min | 1+2+3+4 |

---

## Prerequisites

### Docker (Tier 2, 3, 4)

```bash
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose ps
# Alle Container müssen "healthy" sein

curl -s http://localhost:3000/health | jq .
# → { "status": "ok", ... }
```

### `apitest`-Tenant (Tier 2, 3, 4)

Isolierter Test-Tenant (id=1, domain=apitest.de):

| Rolle    | Email               | Passwort        |
| -------- | ------------------- | --------------- |
| Admin    | admin@apitest.de    | `ApiTest12345!` |
| Employee | employee@apitest.de | `ApiTest12345!` |

Erstellung: [HOW-TO-CREATE-TEST-USER.md](./HOW-TO-CREATE-TEST-USER.md)

### Datenbank-Setup (einmalig nach Fresh-Install)

```sql
-- Alle Addons für apitest aktivieren (sonst KVP-Tests = 403)
INSERT INTO tenant_addons (tenant_id, addon_id, status, activated_at)
SELECT 1, id, 'active', NOW() FROM addons WHERE is_active = 1
ON CONFLICT (tenant_id, addon_id) DO UPDATE SET status = 'active';

-- apitest admin als team-lead (KVP-Create benötigt das)
UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1;
```

### Rate-Limit-Reset (bei 429)

```bash
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

---

## Tier 1 — Unit Tests (Pure Functions)

**Was:** `vitest --project unit` → 6477 Tests in ~15 s. Keine Docker-Abhängigkeit.

**Wo:** Co-located neben den Source-Files (`source.ts` + `source.test.ts`) in `backend/src/**` und `shared/src/**`.

**Wann ausführen:** Während TDD, vor jedem Commit (Teil von `pnpm run validate:all` indirekt — Type-Check + Lint).

```bash
# Alle Unit-Tests
pnpm run test:unit

# Einzelnes File (TDD-Workflow)
pnpm exec vitest --project unit backend/src/nest/auth/auth.service.test.ts

# Watch-Mode
pnpm exec vitest --project unit

# Mit Coverage (lokal)
pnpm run test:coverage
```

### Mocking-Pattern für Services mit DB-Abhängigkeit

```ts
import { vi } from 'vitest';

// vi.mock() statt @nestjs/testing — keine DI-Container-Overhead.
// 80% der testbaren Logik sind pure Functions, die DI gar nicht brauchen.
const mockDb = { query: vi.fn(), tenantQuery: vi.fn() };
const service = new MyService(mockDb as never);
```

### `ActivityLoggerService`-Mock-Factory

Jeder Service mit `ActivityLoggerService`-Injection braucht diesen Mock.
Logging ist Side-Effect — nicht assertieren, nur bereitstellen.

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

### Coverage-Schwellwerte (CI-Gate)

| Metrik     | Floor | Aktuell |
| ---------- | ----- | ------- |
| Lines      | 86%   | 91.07%  |
| Branches   | 80%   | 85.56%  |
| Functions  | 87%   | 92.36%  |
| Statements | 86%   | 91.35%  |

`vitest.config.ts` bricht ab, wenn unterschritten.

---

## Tier 1a — Permission Tests (Security-Critical Subset)

**Was:** Kuratierte Untermenge der Unit-Tests rund um Auth, RBAC, RLS-Pfade.
430 Tests in ~4 s. Eigenes Vitest-Project, damit der Security-Gate auch bei
großen Refactorings sichtbar bleibt.

```bash
pnpm run test:permission
```

**Welche Files:** Siehe `vitest.config.ts` → `projects.permission.include` —
deckt `*-permission*.test.ts`, `auth.service.test.ts`, `roles.service.test.ts`,
`*permission.guard.test.ts`, `jwt-auth.guard.test.ts`, `*-access.service.test.ts`.

**Wann ausführen:** Bei jeder Permission-/Guard-/Auth-Änderung VOR dem PR.

---

## Tier 1b — Frontend Unit Tests

**Was:** `vitest --project frontend-unit` → 399 Tests in <14 s. Reine Frontend-Utils
(Password-Strength, JWT-Decode, URL-Helpers, Session-Expired-Logic).
Keine Docker-Abhängigkeit, keine Browser-Engine.

```bash
pnpm test --project frontend-unit
```

**Wann ausführen:** Bei Änderungen in `frontend/src/lib/utils/**` oder `$lib`-Helpers.

---

## Tier 2 — API Integration Tests (Real HTTP)

**Was:** 753 Tests in ~33 s gegen den laufenden Docker-Backend (kein Mock).
Native `fetch()`, eingeloggter `apitest`-Admin, sequentielle Ausführung.

### Quick Start

```bash
pnpm run test:api

# Einzelnes Modul
pnpm exec vitest run --project api backend/test/calendar.api.test.ts

# Mehrere Module
pnpm exec vitest run --project api backend/test/auth.api.test.ts backend/test/users.api.test.ts

# Filter nach Test-Name
pnpm exec vitest run --project api -t "should return 200"

# Verbose
pnpm exec vitest run --project api --reporter verbose

# Watch-Mode
pnpm exec vitest --project api

# Vitest UI (Browser-Dashboard auf :5175)
pnpm exec vitest --project api --ui
```

### Project-Struktur

```
backend/test/
├── helpers.ts                     # Login-Cache, authHeaders/authOnly, fetchWithRetry, flushThrottleKeys
├── global-teardown.ts             # Cleanup nach allen Tests
├── tsconfig.json                  # NodeNext-Resolution
├── 00-auth.api.test.ts            # Auth (login + refresh + logout)
├── addons.api.test.ts             # Addons CRUD
├── areas.api.test.ts              # Areas CRUD
├── assets.api.test.ts             # Assets CRUD
├── blackboard.api.test.ts         # Blackboard CRUD
├── calendar.api.test.ts           # Calendar Events
├── chat.api.test.ts               # Chat (benötigt 2. User via ensureTestEmployee)
├── chat-e2e-messages.api.test.ts  # E2E-encrypted messages
├── chat-e2e-roundtrip.api.test.ts # E2E key roundtrip
├── departments.api.test.ts        # Departments CRUD
├── documents.api.test.ts          # Documents
├── dummy-users.api.test.ts        # Dummy Users
├── e2e-keys.api.test.ts           # E2E encryption keys
├── features.api.test.ts           # Feature Flags
├── halls.api.test.ts              # Halls CRUD
├── kvp.api.test.ts                # KVP (Improvement Proposals)
├── logs.api.test.ts               # Audit-Log-Export (JSON/CSV/TXT)
├── notifications.api.test.ts      # Notifications + Preferences + Stats
├── organigram.api.test.ts         # Organigram
├── partitions.api.test.ts         # pg_partman Partitions
├── roles.api.test.ts              # Roles
├── settings.api.test.ts           # Tenant Settings
├── shifts.api.test.ts             # Shifts + Rotation + Cleanup
├── surveys.api.test.ts            # Surveys CRUD
├── teams.api.test.ts              # Teams CRUD
├── tpm-executions.api.test.ts     # TPM Executions
├── tpm-plans.api.test.ts          # TPM Plans
├── tpm-schedule-projection.api.test.ts # TPM Schedule
├── user-permissions.api.test.ts   # User Permissions CRUD
├── users.api.test.ts              # Users CRUD
├── vacation.api.test.ts           # Vacation Requests
├── work-orders.api.test.ts        # Work Orders CRUD
└── work-orders-read-tracking.api.test.ts # Read Tracking
```

### Vitest-Config (Project `api`)

| Setting       | Wert                            | Warum                                  |
| ------------- | ------------------------------- | -------------------------------------- |
| `name`        | `api`                           | Project-Selektor: `--project api`      |
| `pool`        | `forks`                         | Process-basiert (kein Worker-Sharing)  |
| `maxWorkers`  | `1`                             | Sequentiell (Tests teilen Auth-State)  |
| `isolate`     | `false`                         | Module-Cache geteilt (Login nur 1×)    |
| `testTimeout` | `30_000`                        | 30 s/Test (externe HTTP-Calls)         |
| `hookTimeout` | `30_000`                        | 30 s/Hook                              |
| `include`     | `backend/test/**/*.api.test.ts` | Nur `.api.test.ts`-Files               |
| `globals`     | `true`                          | `describe`, `it`, `expect` ohne Import |

**Kein Setup-File:** Keine Mocks — echte HTTP-Requests gegen Docker-Backend.

### `helpers.ts` — Exports

| Export                 | Signatur                                         | Zweck                                              |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------- |
| `BASE_URL`             | `string`                                         | `http://localhost:3000/api/v2`                     |
| `APITEST_EMAIL`        | `string`                                         | `admin@apitest.de`                                 |
| `APITEST_PASSWORD`     | `string`                                         | `ApiTest12345!`                                    |
| `loginApitest()`       | `() => Promise<AuthState>`                       | Cached Login — 1 HTTP-Request für komplette Suite  |
| `authHeaders(token)`   | `(string) => Record<string, string>`             | `Authorization` + `Content-Type: application/json` |
| `authOnly(token)`      | `(string) => Record<string, string>`             | `Authorization` only (für GET/DELETE)              |
| `fetchWithRetry()`     | `(url, options?, retries?) => Promise<Response>` | Auto-Retry bei 429 mit exponential backoff         |
| `flushThrottleKeys()`  | `() => void`                                     | Flushed `throttle:*` Redis-Keys (Export-Limits)    |
| `ensureTestEmployee()` | `(token) => Promise<number>`                     | Erstellt/findet Test-Employee (Chat-Tests)         |
| `AuthState`            | `interface`                                      | `{ authToken, refreshToken, userId, tenantId }`    |
| `JsonBody`             | `type`                                           | `Record<string, any>`                              |

### Critical Patterns

```ts
// 1. Header-Trennung (Fastify rejects Content-Type bei body-less requests)
authHeaders(token)  // POST/PUT mit body → inkl. Content-Type
authOnly(token)     // GET/DELETE → nur Authorization

// 2. One-Request-per-Describe (verhindert Rate-Limiting)
describe('Module: List', () => {
  let res: Response;
  beforeAll(async () => { res = await fetch(...); });
  it('should return 200', () => { expect(res.status).toBe(200); });
});

// 3. Throttle-Flush vor rate-limited Endpoints
flushThrottleKeys();  // Redis EVAL löscht throttle:* Keys
const res = await fetch(`${BASE_URL}/logs/export?format=json...`);
```

### Templates

#### GET (List)

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

#### POST (Create) + GET-by-ID + DELETE

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

#### Rate-limited Endpoint (Export)

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

### Architektur-Hintergrund

- **Login-Caching:** `helpers.ts` cached die Login-Response auf Modul-Ebene.
  Mit `isolate: false` erfolgt **EIN** Login für die ganze Test-Run.
- **One-Request-per-Describe:** Jeder `describe`-Block macht EINEN HTTP-Call
  in `beforeAll`, alle `it()`-Blöcke prüfen synchron das gespeicherte Result.
  Verhindert Duplikate + Rate-Limit-Probleme.

### Known Special Cases

#### ResponseInterceptor Double-Wrapping

NestJS `ResponseInterceptor` wickelt jede Response in `{ success, data, timestamp }`.
Controller dürfen NICHT manuell wrappen — sonst doppelt:

```ts
// FALSCH — wird zu { success, data: { success, data: {...} }, timestamp }
return { success: true, data: result };

// RICHTIG — Interceptor wrapped automatisch
return result;
```

#### `ExportThrottle` (1 Request/Minute)

`@ExportThrottle()` erlaubt nur **1 Request/60 s** ([ADR-001](../infrastructure/adr/ADR-001-rate-limiting.md)).
In Tests: `flushThrottleKeys()` vor jedem Export-Request.

#### KVP benötigt Team-Lead-Rolle

`kvp.service.ts` prüft, ob admin/root-User Team-Lead ist (`orgInfo.teamLeadOf.length > 0`).
Ohne Team-Lead-Assignment → 403. Setup siehe Prerequisites.

---

## Tier 3 — E2E Browser Tests (Playwright)

**Was:** 20 Tests in ~25 s. Vollständiger Stack: Nginx → SvelteKit → NestJS → Postgres.
Headless Chromium via Docker + automatischer SvelteKit-Dev-Server-Start.

```bash
pnpm run test:e2e                                  # alle 20 Tests
pnpm run test:e2e:headed                           # mit sichtbarem Browser
pnpm exec playwright test e2e/login.spec.ts        # einzelnes Spec
pnpm run test:e2e:report                           # HTML-Report öffnen
```

### Struktur

```
e2e/
├── auth.setup.ts   # Login + storageState save (Setup-Project, läuft zuerst)
├── login.spec.ts   # 7 Tests: Login-Form, Auth-Redirect, Logout-Modal
├── smoke.spec.ts   # 13 Tests: Dashboard, Sidebar, Navigation, 6 Page-Loads
└── .auth/          # storageState Files (gitignored)
```

### Architektur

- **`webServer`** in `playwright.config.ts` startet `pnpm run dev:svelte` automatisch.
- **`reuseExistingServer: false`** — wichtig, sonst injizieren parallele Dev-Server
  echte Turnstile-Keys statt der Test-Keys.
- **`webServer.env`** injiziert Cloudflare offizielle Turnstile-Test-Keys
  (`1x00…AA`) → invisible challenge resolves auto in headless Chromium.
- **`globalSetup`** flushed Redis Rate-Limit-Keys (gleicher Ansatz wie Tier 2).
- **`storageState`** — `auth.setup.ts` loggt einmal ein, alle anderen Tests reuse.

**Mehr:** [Playwright Best Practices](https://playwright.dev/docs/best-practices) ·
[Svelte Testing Docs](https://svelte.dev/docs/svelte/testing) ·
[Cloudflare Turnstile Setup](./HOW-TO-CLOUDFLARE-TURNSTILE.md)

---

## Tier 4 — Load & Performance Tests (k6)

**Was:** Performance-Regression-Detection. Misst _wie schnell_ Endpoints
antworten — Tier 1-3 messen _ob_ sie korrekt antworten.

Docker-basiert (`grafana/k6:latest`) — kein lokaler k6-Install nötig.
TypeScript nativ via k6 ≥0.54.

**Strategie & Tail-Sampling-Integration:** [ADR-018 Tier 4](../infrastructure/adr/ADR-018-testing-strategy.md) +
[ADR-048 Distributed Tracing](../infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md).

### Smoke-Test (1 VU × 1 min)

Pre-Release-Sanity-Check. 10 Hot-Path-Endpoints, 1 VU, 60 s, Threshold p95<500ms.

```bash
pnpm run test:load:smoke
```

Erwartete Werte (Stand 2026-04-25): p95 ≈ 24 ms, p99 ≈ 39 ms, 0 % Errors.

**Wann:** Vor jedem Release-Tag, oder wenn ein Hot-Path-Code geändert wurde.

### Baseline-Test (5 VU light / 500 VU full + WS-Soak)

Gemischte Read+Write-Last + optionaler WebSocket-Soak. **Per-Tag-Thresholds**
(read p95<100, write p95<250). Auto-Cleanup. CI-Diff gegen eingecheckten Snapshot.

```bash
# Light (Default — single-tenant safe, ~5 min)
pnpm run test:load:baseline

# +WebSocket-Soak (50 persistente /chat-ws Verbindungen)
WS=1 pnpm run test:load:baseline

# Full Capacity (~8 min, benötigt Multi-Tenant-Pool)
PROFILE=full LOGINS='[
  {"email":"admin@apitest.de","password":"ApiTest12345!"},
  {"email":"admin@tenant2.de","password":"…"},
  {"email":"admin@tenant3.de","password":"…"},
  {"email":"admin@tenant4.de","password":"…"},
  {"email":"admin@tenant5.de","password":"…"}
]' pnpm run test:load:baseline
```

#### Throttler-Constraint (ADR-001 — non-negotiable)

Rate-Limits werden PRO JWT-User-ID getrackt:

| Tier    | Limit         | Sustained req/s/User |
| ------- | ------------- | -------------------- |
| `user`  | 1000 / 15 min | ~1.1                 |
| `admin` | 2000 / 15 min | ~2.2                 |

**Single-Tenant @ >5 VU = 429-Storm** statt Latency-Daten.

| Profil  | VU-Peak | Pool-Mindest | Wall-Time | Ziel                              |
| ------- | ------- | ------------ | --------- | --------------------------------- |
| `light` | 5       | 1 (apitest)  | ~5 min    | Regression-Detection + p95-Drift  |
| `full`  | 500     | 5+           | ~8 min    | Pool-Saturation-Bruchpunkt finden |

`setup()` validiert Pool-Größe und bricht ab, wenn `PROFILE=full && pool<5`.

#### Per-Tag-Thresholds

```ts
'http_req_duration{op:read}':  ['p(95)<100', 'p(99)<300']
'http_req_duration{op:write}': ['p(95)<250', 'p(99)<800']
'http_req_failed':             ['rate<0.001']
'ws_connecting{scenario:ws_soak}': ['p(95)<500']
```

Tighter als Smoke (500/1000 ms) — fängt echte Regressions, nicht erst Katastrophen.

#### Auto-Cleanup (eingebaut im Wrapper-Script)

`scripts/run-load-baseline.sh` macht automatisch:

1. Pre-flight (Postgres + Backend + Redis erreichbar?)
2. Redis-FLUSHDB (Throttle-Reset)
3. k6-Run mit korrektem User-Mapping (`--user "$(id -u):$(id -g)"`)
4. **Auto-Cleanup** der `LOAD-*` Blackboard-Entries via `trap` (auch bei Fail/Strg-C)
5. Snapshot-Bootstrap: legt `load/baselines/baseline-<profile>.json` an, wenn fehlt
6. Diff gegen vorhandenen Snapshot, wenn schon eingecheckt

**Manueller git-commit nötig** — das Skript darf kein git anfassen, gibt aber den
exakten Befehl aus.

#### CI-Diff (Regression-Gate)

```bash
# Erste Bootstrap-Iteration: Snapshot eincheken (nach Approved-Run)
git add load/baselines/baseline-light.json
git commit -m "perf: bootstrap baseline-light snapshot (read p95=Xms, write p95=Yms)"

# In CI bei jedem PR (oder lokal):
pnpm run test:load:baseline
pnpm run test:load:diff -- \
  --baseline=load/baselines/baseline-light.json \
  --current=load/results/baseline-latest.json
# Exit 1 wenn p95/p99 um >20% regressed oder error-rate um >0.5pp gestiegen
```

#### Manuelle Cleanup-Alternative (falls Skript nicht verwendet wurde)

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "DELETE FROM blackboard_entries WHERE title LIKE 'LOAD-%';"
```

#### Baseline-Harvest (manuell, optional nach Run)

```bash
# Top-10 langsamste Queries während des Test-Runs
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT left(query,80), calls, round(mean_exec_time::numeric,2) AS avg_ms \
   FROM pg_stat_statements WHERE query NOT LIKE '%pg_stat%' \
   ORDER BY total_exec_time DESC LIMIT 10;"

# Connection-Pool-Saturation
docker exec assixx-postgres psql -U assixx_user -d assixx -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='assixx';"

# Slow-Traces (>200 ms) aus Tempo seit Test-Start (Tail-Sampling-Threshold ist 200ms — ADR-048)
curl -s 'http://localhost:3200/api/search?minDuration=200ms&limit=20' | jq
```

**Wann:** Bei DB-Migration, RLS-Policy-Änderung, Connection-Pool-Config, Hot-Path-Code,
Major-Updates auf `pg`/`pino`/`@nestjs/throttler`/`nestjs-cls`. Nicht bei jedem PR.

---

## TypeScript-Regeln für Test-Files

### 1. Import-Extensions Required

`moduleResolution: NodeNext` in `backend/test/tsconfig.json` verlangt `.js`-Extension:

```ts
import { ... } from './helpers.js';   // korrekt
import { ... } from './helpers';      // TS-Error
```

### 2. Response-Body casten

`res.json()` returned `Promise<unknown>` (Node-Types). Immer explizit casten:

```ts
const body = (await res.json()) as JsonBody;   // korrekt
const body: JsonBody = await res.json();       // TS-Error
```

### 3. Conditional Expects

Wenn Assertions nur auf existierenden Daten laufen:

```ts
if (Array.isArray(body) && body.length > 0) {
  const entry = body[0] as JsonBody;
  // eslint-disable-next-line vitest/no-conditional-expect -- Integration: structure check only when data exists
  expect(entry).toHaveProperty('id');
}
```

### 4. Kein `any` ohne Begründung

```ts
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Integration: JsonBody = Record<string, any>
export type JsonBody = Record<string, any>;
```

---

## Coverage-Ignore-Comments (v8 Provider)

Für beweisbar unerreichbaren Code (`noUncheckedIndexedAccess`-Guards, exhaustive `switch default`):

```ts
// Nächsten Code-Knoten ignorieren (if-Block, Funktion, switch-case)
/* v8 ignore next -- @preserve Begründung */
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

// Block-Bereich ignorieren
/* v8 ignore start -- @preserve Begründung */
// ... unerreichbarer Code ...
/* v8 ignore stop */

// Selektiv if- oder else-Branch ignorieren
/* v8 ignore if -- @preserve */
/* v8 ignore else -- @preserve */
```

**Wichtig:** `/* v8 ignore next N */` (mit Zahl) existiert **nicht**. `next` ignoriert
immer den nächsten AST-Knoten.

Komplette Referenz: [Vitest Coverage Docs](https://vitest.dev/guide/coverage)

---

## Troubleshooting

| Symptom                               | Tier  | Ursache                             | Lösung                                                                                  |
| ------------------------------------- | ----- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `429 Too Many Requests` on login      | 2     | Rate-Limit (login/export)           | `flushThrottleKeys()` oder `pnpm run test:load:flush`                                   |
| `401 Unauthorized`                    | 2     | Token missing/expired               | Login-Cache prüfen, Docker neustarten                                                   |
| `400 Bad Request`                     | 2     | Content-Type bei GET/DELETE         | `authOnly()` statt `authHeaders()` verwenden                                            |
| `400 Bad Request`                     | 2     | Validation-Error                    | Body-Format gegen Zod-Schema prüfen                                                     |
| `403 Forbidden` (KVP)                 | 2     | User ist kein Team-Lead             | `UPDATE teams SET team_lead_id = 1 WHERE id = 2` (siehe Prerequisites)                  |
| `403 Forbidden` (Addon)               | 2     | Addon nicht aktiviert               | `INSERT INTO tenant_addons …` (siehe Prerequisites)                                     |
| `404 Not Found`                       | 2     | Resource existiert nicht            | Create-`describe` muss VOR Get/Delete kommen                                            |
| `500 Internal Server Error`           | 2     | Backend-Bug                         | `docker logs assixx-backend --tail 100`                                                 |
| `ECONNREFUSED`                        | 2/3/4 | Backend down                        | `cd docker && doppler run -- docker-compose up -d`                                      |
| `ECONNRESET`                          | 2     | Backend gecrashed                   | `doppler run -- docker-compose restart`                                                 |
| Test-Timeout (30 s)                   | 2     | hookTimeout zu kurz                 | `beforeAll(async () => {...}, 60_000)` als 2. Argument                                  |
| Double-wrapped Response               | 2     | Controller + ResponseInterceptor    | Controller soll `data` direkt returnen (nicht `{success, data}`)                        |
| Playwright `webServer.command failed` | 3     | Port :5173 belegt                   | `./scripts/free-port.sh 5173`                                                           |
| Turnstile-Challenge persistiert       | 3     | Echter Turnstile-Key statt Test-Key | parallel `pnpm run dev:svelte` killen, nur Playwright-managed laufen lassen             |
| k6 `permission denied` auf summary    | 4     | Docker-User-Mismatch                | Wrapper-Skript benutzt `--user "$(id -u):$(id -g)"` (in `scripts/run-load-baseline.sh`) |
| k6 `429` storm @ >5 VU single-tenant  | 4     | ADR-001 admin throttle 2000/15min   | `PROFILE=full LOGINS='[…5+ tenants…]'` verwenden                                        |
| Baseline `failed: refuses to start`   | 4     | `PROFILE=full` + Pool < 5           | Pool auf 5+ Logins erweitern oder `PROFILE=light` lassen                                |

### Debug — Backend-Logs

```bash
docker logs assixx-backend --tail 50    # letzte 50 Zeilen
docker logs assixx-backend -f           # Live-Stream
```

### Debug — Redis Rate-Limit-Keys

```bash
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning KEYS 'throttle:*'

docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

### Debug — Einzelne Endpoints manuell testen

```bash
# Login
curl -s http://localhost:3000/api/v2/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@apitest.de","password":"ApiTest12345!"}' | jq .

# GET mit Token
curl -s http://localhost:3000/api/v2/departments \
  -H "Authorization: Bearer <TOKEN>" | jq .
```

---

## Test-Result interpretieren

```
✓ backend/test/00-auth.api.test.ts (9 tests)
✓ backend/test/users.api.test.ts (10 tests)
...
✓ backend/test/work-orders.api.test.ts (12 tests)

Test Files  33 passed (33)
     Tests  539 passed (539)
  Duration  ...
```

- **Test Files:** Jede `.api.test.ts` = 1 Modul
- **Tests:** Jeder `it()`-Block = 1 Test
- **Duration:** Total-Runtime (typisch 10-15 s mit warmem Backend)

---

## Workflow: Neues Feature testen

```bash
# 1. Docker starten (falls nicht laufend)
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose up -d

# 2. Vor jedem Commit
pnpm run validate:all

# 3. Backend-Logik geändert
pnpm run test:unit                    # Pure functions
pnpm run test:api                     # HTTP integration
# Bei Fail: einzelnes Modul verbose
pnpm exec vitest run --project api backend/test/<modul>.api.test.ts --reporter verbose
docker logs assixx-backend --tail 100 # bei 500ern

# 4. Permission-/Auth-Code geändert
pnpm run test:permission

# 5. Frontend-Util geändert
pnpm test --project frontend-unit
cd frontend && pnpm run check && pnpm run lint

# 6. UI-Flow geändert
pnpm run test:e2e

# 7. Hot-Path / DB / Connection-Pool geändert
pnpm run test:load:baseline           # Light, ~5 min
pnpm run test:load:diff -- \
  --baseline=load/baselines/baseline-light.json \
  --current=load/results/baseline-latest.json

# 8. Vor Release-Tag
pnpm test                             # Vitest + Playwright + k6 smoke (~3 min)
```

### Neuen Tier-2-Test schreiben

1. Datei anlegen: `backend/test/<modul>.api.test.ts`
2. Pattern: `import helpers.js` → `beforeAll login` → `describe`-per-request → `it`-per-assertion
3. Lint-Check: `cd /home/scs/projects/Assixx && pnpm exec eslint backend/test/`
4. Run: `pnpm exec vitest run --project api backend/test/<modul>.api.test.ts`

---

## Verwandte Dokumente

- [ADR-018 Testing Strategy](../infrastructure/adr/ADR-018-testing-strategy.md) — Pyramide, Tooling-Decisions, Phase-Plan
- [ADR-001 Rate Limiting](../infrastructure/adr/ADR-001-rate-limiting.md) — Throttler-Tiers (relevant für Tier-4-Profile)
- [ADR-048 Distributed Tracing](../infrastructure/adr/ADR-048-distributed-tracing-tempo-otel.md) — Tail-Sampling-Threshold (200 ms) catched Tier-4-Outliers
- [HOW-TO-CREATE-TEST-USER.md](./HOW-TO-CREATE-TEST-USER.md) — apitest-Tenant Setup
- [HOW-TO-CLOUDFLARE-TURNSTILE.md](./HOW-TO-CLOUDFLARE-TURNSTILE.md) — Tier-3-Turnstile-Test-Keys
- [load/README.md](../../load/README.md) — Tier-4 Detail-Konfiguration + nächste Schritte
- [`backend/test/helpers.ts`](../../backend/test/helpers.ts) — Tier-2-Helpers Source-of-Truth

---

_Last Updated: 2026-04-25 — Renamed from HOW-TO-TEST-WITH-VITEST.md, expanded to cover all 4 tiers (Unit + Permission + Frontend-Unit + API + E2E + Load incl. baseline)._
