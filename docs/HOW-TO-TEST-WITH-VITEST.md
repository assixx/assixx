# API Integration Testing mit Vitest

> **Vitest** läuft als pnpm-Dependency — kein globales Install nötig!
> 18 Module, 175 Assertions, 100% passing.

---

## Isolierter Test-Tenant: apitest

Tests laufen in einem **isolierten Tenant** namens `apitest`:

- **Tenant**: API Test GmbH (ID: 1)
- **Admin**: admin@apitest.de / ApiTest12345!
- **Employee**: employee@apitest.de / ApiTest12345!
- **Domain**: apitest.de

**Vorteile:**

- Test-Daten verschmutzen NICHT den Dev-Tenant
- Reproduzierbare Tests
- Einfaches Cleanup (nur Test-Tenant betroffen)

---

## Quick Start

```bash
# Alle API Integration Tests ausführen
pnpm run test:api:vitest

# Oder direkt mit vitest CLI
vitest run --project api
```

---

## Voraussetzungen

### 1. Docker läuft und ist healthy

```bash
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose ps

# Erwartete Ausgabe: alle Container "healthy"
```

### 2. Backend erreichbar

```bash
curl -s http://localhost:3000/health | jq .

# Erwartete Ausgabe: { "status": "ok", ... }
```

### 3. Datenbank-Prerequisites (einmalig nach DB-Setup)

Ohne diese schlagen KVP-Tests fehl:

```sql
-- Alle Features für apitest-Tenant aktivieren
INSERT INTO tenant_features (tenant_id, feature_id, is_active, activated_at)
SELECT 1, id, 1, NOW() FROM features WHERE is_active = 1
ON CONFLICT (tenant_id, feature_id) DO UPDATE SET is_active = 1;

-- Brunotest-User (id=1) als Teamleiter setzen (für KVP-Create)
UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1;
```

### 4. Rate Limit Problem?

```bash
# Symptom: 429 Too Many Requests bei Login

# Lösung 1: Redis Rate-Limit-Keys flushen (Auth-Tokens bleiben erhalten)
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB

# Lösung 2: Docker komplett neu starten
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose restart
sleep 20 && doppler run -- docker-compose ps
```

---

## Projektstruktur

```
backend/test/                        # NestJS convention: integration tests at project level
├── helpers.ts                       # Shared: login, auth headers, retry, throttle flush
├── tsconfig.json                    # TS config (moduleResolution: NodeNext)
├── 00-auth.api.test.ts              # Auth (login + refresh + logout)
├── users.api.test.ts                # Users CRUD
├── departments.api.test.ts          # Departments CRUD
├── teams.api.test.ts                # Teams CRUD
├── roles.api.test.ts                # Roles
├── notifications.api.test.ts        # Notifications CRUD + preferences + stats
├── blackboard.api.test.ts           # Blackboard CRUD
├── calendar.api.test.ts             # Calendar Events
├── kvp.api.test.ts                  # KVP (Verbesserungsvorschläge)
├── machines.api.test.ts             # Machines CRUD
├── surveys.api.test.ts              # Surveys CRUD
├── chat.api.test.ts                 # Chat (braucht 2. User via ensureTestEmployee)
├── documents.api.test.ts            # Documents
├── shifts.api.test.ts               # Shifts + Rotation + Cleanup
├── logs.api.test.ts                 # Audit Log Export (JSON/CSV/TXT + Validation)
├── settings.api.test.ts             # Tenant Settings
├── features.api.test.ts             # Feature Flags
├── areas.api.test.ts                # Areas
└── user-permissions.api.test.ts     # User Permissions CRUD
```

---

## Vitest Config

Definiert in `vitest.config.ts` als `api`-Projekt:

| Einstellung   | Wert                                | Warum                                      |
| ------------- | ----------------------------------- | ------------------------------------------ |
| `name`        | `api`                               | Projekt-Selektor: `--project api`          |
| `pool`        | `forks`                             | Prozess-basiert (kein Worker-Sharing)      |
| `maxWorkers`  | `1`                                 | Sequenziell (Tests teilen Auth-State)      |
| `isolate`     | `false`                             | Module-Cache shared (Login-Request nur 1x) |
| `testTimeout` | `30_000`                            | 30s pro Test (externe HTTP-Calls)          |
| `hookTimeout` | `30_000`                            | 30s pro beforeAll/afterAll                 |
| `include`     | `backend/test/**/*.api.test.ts` | Nur `.api.test.ts`-Dateien                 |
| `globals`     | `true`                              | `describe`, `it`, `expect` ohne Import     |

**Kein Setup-File:** Keine Mocks — echte HTTP-Requests gegen Docker-Backend.

---

## npm Scripts

| Script                     | Beschreibung                                    |
| -------------------------- | ----------------------------------------------- |
| `pnpm run test:api:vitest` | Alle 18 Module (175 Tests) mit Vitest ausführen |

### Nützliche Vitest CLI-Flags

```bash
# Alle Tests ausführen
pnpm run test:api:vitest

# Einzelne Test-Datei ausführen
vitest run --project api backend/test/calendar.api.test.ts

# Mehrere Module ausführen
vitest run --project api backend/test/auth.api.test.ts backend/test/users.api.test.ts

# Tests nach Name filtern (--testNamePattern / -t)
vitest run --project api -t "should return 200"

# Verbose-Ausgabe (jeder Test einzeln)
vitest run --project api --reporter verbose

# Watch-Mode (re-run bei Dateiänderung)
vitest --project api

# Mit Vitest UI (Browser-Dashboard auf Port 5175)
vitest --project api --ui
```

---

## Test-Architektur

### Login-Caching

`helpers.ts` cached den Login-Request auf Modul-Ebene. Mit `isolate: false` wird
nur **EIN** Login-Request für den gesamten Test-Lauf gemacht:

```typescript
// Jede Test-Datei: gleicher cached Token
let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest(); // → cached nach erstem Aufruf
});
```

### One-Request-per-Describe Pattern

Jeder `describe`-Block macht **einen** HTTP-Request in `beforeAll`.
Die `it()`-Blöcke prüfen nur synchron die gespeicherte Response:

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

**Warum:** Dieses Pattern verhindert doppelte HTTP-Calls und Rate-Limiting-Probleme.

### Auth-Header-Pattern

Fastify **lehnt** `Content-Type: application/json` bei Requests OHNE Body ab (400 Bad Request).

```typescript
// POST/PUT mit Body → authHeaders (inkl. Content-Type)
fetch(url, { method: 'POST', headers: authHeaders(token), body: JSON.stringify({...}) });

// GET/DELETE/PUT-ohne-Body → authOnly (nur Authorization)
fetch(url, { headers: authOnly(token) });
fetch(url, { method: 'DELETE', headers: authOnly(token) });
```

---

## helpers.ts Exports

| Export                 | Typ / Signatur                                   | Zweck                                                          |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| `BASE_URL`             | `string`                                         | `http://localhost:3000/api/v2`                                 |
| `APITEST_EMAIL`        | `string`                                         | `admin@apitest.de`                                             |
| `APITEST_PASSWORD`     | `string`                                         | `ApiTest12345!`                                                |
| `loginApitest()`       | `() => Promise<AuthState>`                       | Cached Login — EIN HTTP-Request für gesamte Suite              |
| `authHeaders(token)`   | `(string) => Record<string, string>`             | `Authorization` + `Content-Type: application/json`             |
| `authOnly(token)`      | `(string) => Record<string, string>`             | Nur `Authorization` (für GET/DELETE)                           |
| `fetchWithRetry()`     | `(url, options?, retries?) => Promise<Response>` | Auto-Retry bei 429 mit exponentiellem Backoff                  |
| `flushThrottleKeys()`  | `() => void`                                     | Flusht `throttle:*` Redis-Keys (für Export-Rate-Limit)         |
| `ensureTestEmployee()` | `(token) => Promise<number>`                     | Erstellt/findet Test-Employee (für Chat-Tests)                 |
| `AuthState`            | `interface`                                      | `{ authToken, refreshToken, userId, tenantId }`                |
| `JsonBody`             | `type`                                           | `Record<string, any>` (Integration-Tests prüfen per Assertion) |

---

## Neuen Test erstellen

### Template für GET (List)

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

### Template für POST (Create)

```typescript
import { type AuthState, BASE_URL, type JsonBody, authHeaders, authOnly, loginApitest } from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// Shared state (wie bru.setVar)
let resourceId: number;

describe('Module: Create', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources`, {
      method: 'POST',
      headers: authHeaders(auth.authToken), // inkl. Content-Type
      body: JSON.stringify({
        name: `Test ${Date.now()}`,
        description: 'Vitest API Test',
      }),
    });
    body = (await res.json()) as JsonBody;

    // State für nachfolgende describe-Blöcke speichern
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

// Nachfolgende Tests nutzen resourceId
describe('Module: Get By ID', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/resources/${resourceId}`, {
      headers: authOnly(auth.authToken), // kein Content-Type bei GET
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
      headers: authOnly(auth.authToken), // kein Content-Type bei DELETE
    });
    const body = (await res.json()) as JsonBody;

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

### Template für Rate-Limited Endpoints (Export)

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
    flushThrottleKeys(); // Redis throttle:* Keys löschen VOR jedem Request
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

## TypeScript-Regeln für Test-Dateien

### 1. Import-Extensions erforderlich

`moduleResolution: NodeNext` in `backend/test/tsconfig.json` erfordert `.js`-Extension:

```typescript
import { ... } from './helpers.js';  // ✅ korrekt
import { ... } from './helpers';     // ❌ TS-Fehler
```

### 2. Response-Body casten

`res.json()` gibt `Promise<unknown>` zurück (Node-Types). Immer explizit casten:

```typescript
const body = (await res.json()) as JsonBody;  // ✅ korrekt
const body: JsonBody = await res.json();       // ❌ TS-Fehler
```

### 3. Conditional Expects

Wenn Assertions nur bei vorhandenen Daten laufen, brauchen sie `eslint-disable`:

```typescript
if (Array.isArray(body) && body.length > 0) {
  const entry = body[0] as JsonBody;
  // eslint-disable-next-line vitest/no-conditional-expect -- Integration: Struktur-Check nur wenn Daten vorhanden
  expect(entry).toHaveProperty('id');
}
```

### 4. Keine `any` ohne Begründung

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Integration: JsonBody = Record<string, any>
export type JsonBody = Record<string, any>;
```

---

## Troubleshooting

| Symptom                     | Ursache                          | Lösung                                                          |
| --------------------------- | -------------------------------- | --------------------------------------------------------------- |
| `429 Too Many Requests`     | Rate Limit (Login/Export)        | Redis FLUSHDB (siehe oben) oder `flushThrottleKeys()`           |
| `401 Unauthorized`          | Token fehlt/abgelaufen           | Login-Cache prüfen, Docker neu starten                          |
| `400 Bad Request`           | Content-Type bei GET/DELETE      | `authOnly()` statt `authHeaders()` verwenden                    |
| `400 Bad Request`           | Validation Error                 | Body-Format prüfen (Zod-Schema)                                 |
| `403 Forbidden` (KVP)       | User kein Teamleiter             | `UPDATE teams SET team_lead_id = 1 WHERE id = 2`                |
| `403 Forbidden` (Feature)   | Feature nicht aktiviert          | `INSERT INTO tenant_features ...` (siehe Prerequisites)         |
| `404 Not Found`             | Resource existiert nicht         | Create-describe muss VOR Get/Delete stehen                      |
| `500 Internal Server Error` | Backend Bug                      | `docker logs assixx-backend`                                    |
| `ECONNREFUSED`              | Backend down                     | `doppler run -- docker-compose up -d`                           |
| `ECONNRESET`                | Backend crashed                  | `doppler run -- docker-compose restart`                         |
| Test-Timeout (30s)          | hookTimeout zu kurz              | `beforeAll(async () => {...}, 60_000)` als 2. Argument          |
| Double-wrapped Response     | Controller + ResponseInterceptor | Controller soll Daten direkt returnen (nicht `{success, data}`) |

### Debug: Backend Logs anzeigen

```bash
# Letzte 50 Zeilen
docker logs assixx-backend --tail 50

# Live-Stream
docker logs assixx-backend -f
```

### Debug: Redis Rate-Limit-Keys prüfen

```bash
# Alle throttle-Keys anzeigen
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning KEYS 'throttle:*'

# Alle Keys flushen (Auth-Tokens sind im Node-Prozess, NICHT in Redis)
docker exec assixx-redis redis-cli -a 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0' \
  --no-auth-warning FLUSHDB
```

### Debug: Einzelne Endpoints manuell testen

```bash
# Login
curl -s http://localhost:3000/api/v2/auth/login \
  -H 'Content-Type: application/json' \
  -d @- <<'EOF' | jq .
{"email":"admin@apitest.de","password":"ApiTest12345!"}
EOF

# GET mit Token
curl -s http://localhost:3000/api/v2/departments \
  -H "Authorization: Bearer <TOKEN>" | jq .
```

---

## Bekannte Spezialfälle

### ResponseInterceptor Double-Wrapping

NestJS `ResponseInterceptor` wrapped alle Responses in `{ success, data, timestamp }`.
Controller dürfen **NICHT** manuell wrappen — sonst doppelt:

```typescript
// ❌ FALSCH — wird zu { success, data: { success, data: {...} }, timestamp }
return { success: true, data: result };

// ✅ KORREKT — Interceptor wrapped automatisch
return result;
```

### ExportThrottle (1 Request/Minute)

`ExportThrottle`-Decorator erlaubt nur **1 Request pro 60 Sekunden** (ADR-001).
In Tests: `flushThrottleKeys()` vor jedem Export-Request aufrufen.

### KVP braucht Teamleiter-Rolle

`kvp.service.ts` prüft ob Admin/Root-User ein Teamleiter ist
(`orgInfo.teamLeadOf.length > 0`). Ohne Team-Lead-Zuweisung → 403 Forbidden.

---

## Test-Ergebnisse interpretieren

```
✓ backend/test/auth.api.test.ts (9 tests)
✓ backend/test/users.api.test.ts (10 tests)
...
✓ backend/test/areas.api.test.ts (3 tests)

Test Files  18 passed (18)
     Tests  175 passed (175)
  Start at  ...
  Duration  ...
```

- **Test Files**: Jede `.api.test.ts`-Datei = 1 Modul
- **Tests**: Jeder `it()`-Block = 1 Test
- **Duration**: Gesamtlaufzeit (typisch 10-20s bei warmem Backend)

---

## Workflow: Neues Feature testen

```bash
# 1. Docker starten (falls nicht läuft)
cd /home/scs/projects/Assixx/docker
doppler run -- docker-compose up -d

# 2. Alle API Tests ausführen
pnpm run test:api:vitest

# 3. Bei Fehlern: Einzelne Module debuggen (verbose)
vitest run --project api backend/test/calendar.api.test.ts --reporter verbose

# 4. Backend Logs prüfen bei 500er
docker logs assixx-backend --tail 100

# 5. Neuen Test schreiben
# → Datei erstellen: backend/test/{module}.api.test.ts
# → Pattern: import helpers.js → beforeAll login → describe-per-request → it-per-assertion
# → ESLint prüfen: cd /home/scs/projects/Assixx && pnpm exec eslint backend/test/
```

---

_Erstellt: 2026-02-04 | Aktualisiert: 2026-02-09_
