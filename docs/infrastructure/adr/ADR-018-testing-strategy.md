# ADR-018: Testing Strategy (Unit + API Integration)

| Metadata                | Value                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                              |
| **Date**                | 2026-02-04                                                                                            |
| **Decision Makers**     | SCS Technik                                                                                           |
| **Affected Components** | `vitest.config.ts`, `api-tests/vitest/`, `backend/src/**/*.test.ts`, `shared/src/**/*.test.ts`, CI/CD |

---

## Context

### Ausgangslage

Assixx hatte bis Anfang 2026 **keine automatisierten Tests**. API-Endpunkte wurden manuell mit der Bruno Desktop-App getestet. Es gab:

- Keine Unit-Tests
- Keine Coverage-Messung
- Keine Test-Gate in CI/CD
- Kein Regressionsschutz bei Refactoring

### Problem: Manuelles Testing skaliert nicht

| Problem                       | Auswirkung                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------- |
| Kein Regressionsschutz        | Refactoring bricht Features, die erst in Production auffallen                     |
| Bruno CLI ist fragil          | Rate-Limiting, State-Abhängigkeiten, kein parallelisierbares Feedback             |
| Keine Edge-Case-Dokumentation | `is_active` Multi-State (0/1/3/4), Password-Regeln, Coercion-Logik undokumentiert |
| Kein Merge-Gate               | Kaputter Code kann in `master` landen                                             |
| Kein Coverage-Tracking        | Unklar welche Code-Pfade getestet sind                                            |

### Anforderungen

1. **Unit-Tests** fuer reine Funktionen (Helpers, Schemas, Utils) — schnell, isoliert, ohne DB/Docker
2. **API-Integration-Tests** fuer HTTP-Endpunkte — gegen echtes Docker-Backend
3. **Einheitliches Tool** fuer beide Test-Typen — kein Tool-Wildwuchs
4. **ESM-native** — Assixx nutzt `"type": "module"` durchgehend
5. **CI/CD-Integration** als Merge-Gate — kein kaputtes Feature in `master`
6. **Phase-basierter Rollout** — Fundament zuerst, peu a peu erweitern

---

## Decision Drivers

1. **ESM-Kompatibilitaet** — Projekt nutzt `"type": "module"`, Tool muss ESM nativ unterstuetzen
2. **Single-Tool-Strategie** — Ein Test-Runner fuer Unit + Integration, kein Jest + Bruno + Supertest Mix
3. **Geschwindigkeit** — Unit-Tests muessen in <1s laufen, kein DI-Container-Overhead
4. **Workspace-Support** — Separate Konfiguration fuer Unit (schnell, isolated) vs. API (sequentiell, real HTTP)
5. **NestJS-Unabhaengigkeit** — Pure-Function-Tests brauchen keinen DI-Container
6. **Zuverlaessigkeit** — API-Tests muessen 100% deterministisch sein (kein Flaky durch Rate-Limiting)

---

## Options Considered

### Option A: Jest + @nestjs/testing + Bruno CLI (beibehalten)

**Pros:**

- NestJS-Dokumentation empfiehlt Jest + @nestjs/testing
- Bruno CLI existiert bereits (96 Requests, 169 Tests)
- Grosse Community

**Cons:**

- **ESM-Inkompatibel** — Jest braucht `--experimental-vm-modules` Flag, instabil mit ESM
- **Langsam** — @nestjs/testing startet DI-Container pro Test-Suite (~2-5s Overhead)
- **Zwei Tools** — Bruno CLI fuer API, Jest fuer Unit — unterschiedliche Configs, Outputs, CI-Setups
- **Bruno CLI fragil** — State-Abhaengigkeiten (`bru.setVar()`), Rate-Limiting bricht Tests
- **Kein Workspace-Support** — Keine native Trennung von Unit vs. Integration

**Verdict:** REJECTED — ESM-Inkompatibilitaet ist Dealbreaker, zwei Tools erhoehen Komplexitaet

### Option B: Vitest + @nestjs/testing (DI-Container-Tests)

**Pros:**

- Vitest ist ESM-native und schnell
- @nestjs/testing erlaubt Service-Tests mit echtem DI-Container

**Cons:**

- **Overhead** — DI-Container-Setup pro Suite (~2-5s), obwohl wir reine Funktionen testen
- **Komplexitaet** — Mocking von Providers, Module-Registrierung, Token-Injection
- **Fragilitaet** — Tests brechen bei DI-Refactoring (Module-Struktur aendern = Tests anpassen)
- **Overkill** — 80% unserer testbaren Logik sind Pure Functions (Helpers, Schemas, Utils)

**Verdict:** REJECTED — Zu viel Overhead fuer Pure-Function-Tests. Fuer Service-Tests mit DB-Abhaengigkeit: `vi.mock()` statt DI-Container.

### Option C: Vitest + native fetch() — Two-Tier Strategy (EMPFOHLEN)

**Pros:**

- **ESM-native** — Keine Workarounds, kein `--experimental-vm-modules`
- **Single Tool** — Vitest fuer Unit UND Integration (Workspace-Projects)
- **Schnell** — 222 Unit-Tests in 453ms, 175 API-Tests in 5.7s
- **Workspace-Trennung** — `--project unit` (schnell, isolated) vs. `--project api` (sequentiell, real HTTP)
- **Pure-Function-First** — Kein DI-Container fuer Helpers/Schemas/Utils
- **fetch()-basiert** — API-Tests nutzen native `fetch()`, keine Abstraktion (Bruno CLI, Supertest)
- **Login-Caching** — Ein Login-Request fuer 175 Tests (`isolate: false`)
- **Deterministisch** — `flushThrottleKeys()` loest Rate-Limit-Problem sauber

**Cons:**

- **Service-Mocking noetig** — Fuer Phase 5+ muessen DB-Calls manuell gemockt werden (`vi.mock()`)
- **Kein DI-Container-Validation** — Wir testen nicht ob NestJS-DI korrekt verdrahtet ist (akzeptables Risiko)
- **Sequentielle API-Tests** — `maxWorkers: 1` ist langsamer als parallele Ausfuehrung (aber notwendig wegen Shared State)

**Verdict:** ACCEPTED — Bester Kompromiss aus Geschwindigkeit, Einfachheit und Zuverlaessigkeit

---

## Decision

**Two-Tier Testing Strategy mit Vitest als Single Test-Runner.**

### Architektur-Schema

```
                        VITEST TEST PYRAMID
                        ==================

                         ┌─────────────┐
                         │   E2E Tests │  (Zukunft: Playwright)
                         │   Browser   │  nicht Teil dieser ADR
                         └──────┬──────┘
                                │
                   ┌────────────┴────────────┐
                   │  API Integration Tests   │  Tier 2: Real HTTP
                   │  18 Dateien, 175 Tests   │  gegen Docker-Backend
                   │  vitest --project api    │  Sequential, fetch()
                   └────────────┬─────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          │           Unit Tests                       │  Tier 1: Pure Functions
          │  8+ Dateien, 222+ Tests (Phase 0-4)       │  Kein Docker noetig
          │  vitest --project unit                     │  Parallel, <1s
          └────────────────────────────────────────────┘
```

### Tier 1: Unit Tests (Pure Functions)

| Aspekt      | Entscheidung                                                                 |
| ----------- | ---------------------------------------------------------------------------- |
| Tool        | Vitest v4 (`vitest run --project unit`)                                      |
| Scope       | `backend/src/**/*.test.ts` + `shared/src/**/*.test.ts`                       |
| Ausfuehrung | Parallel, isolated, <1s Gesamtdauer                                          |
| Mocking     | `vi.mock()` fuer DB-Services (Phase 5+), `vi.useFakeTimers()` fuer Dates     |
| Dateien     | Co-located: `source.ts` neben `source.test.ts`                               |
| Pattern     | AAA (Arrange-Act-Assert), ein Konzept pro `it()`, minimaler Input            |
| Coverage    | v8 Provider, HTML + JSON + Text Reporter                                     |
| Naming      | `describe('FunctionName')` > `describe('when context')` > `it('should ...')` |

**Was wird Unit-getestet:**

```
Phase 1: fieldMapper.ts          — dbToApi(), apiToDb()              ✅ 16 Tests
Phase 2: date-helpers.ts         — formatDate(), isToday(), etc.     ✅ 27 Tests
         is-active.ts            — Status-Konstanten                 ✅  9 Tests
Phase 3: common.schema.ts        — Zod-Schemas (ID, Email, PW)      ✅ 63 Tests
Phase 4: shifts.helpers.ts       — parseTime, calculateHours         ✅ 22 Tests
         users.helpers.ts        — mapSortField, buildUpdateFields   ✅ 20 Tests
         kvp.helpers.ts          — isUuid, buildFilterConditions     ✅ 24 Tests
         audit.helpers.ts        — sanitizeData, singularize         ✅ 41 Tests
Phase 5: Service-Logik (Mocking) — roles, rotation, features, auth   ← NAECHSTE
Phase 6: Restliche Helpers       — blackboard, calendar, chat, etc.
Phase 7: Frontend Utils          — password-strength, jwt, auth
Phase 8: DTO-Validierungen       — Alle Module
```

**Was wird NICHT Unit-getestet:**

- `*.module.ts` — NestJS DI-Wiring (reines Deklarativ)
- `*.controller.ts` — HTTP-Layer (Tier 2 deckt das ab)
- `main.ts` — Bootstrap
- `index.ts` — Barrel-Exports
- `types/` — Reine Type-Definitionen

### Tier 2: API Integration Tests (Real HTTP)

| Aspekt        | Entscheidung                                                      |
| ------------- | ----------------------------------------------------------------- |
| Tool          | Vitest v4 (`vitest run --project api`)                            |
| Scope         | `api-tests/vitest/**/*.api.test.ts`                               |
| Ausfuehrung   | Sequentiell (`maxWorkers: 1`, `isolate: false`)                   |
| HTTP-Client   | Native `fetch()` — keine Abstraktion (kein Supertest, kein Axios) |
| Auth          | `loginApitest()` — cached, ein Request fuer gesamte Suite         |
| Rate-Limiting | `flushThrottleKeys()` — flusht Redis `throttle:*` Keys            |
| Timeout       | 30s pro Test, 30s pro Hook                                        |
| Voraussetzung | Docker-Backend laeuft (`docker-compose up -d`)                    |

**18 Module, 175 Tests:**

| Module        | Tests | Besonderheiten                              |
| ------------- | ----- | ------------------------------------------- |
| auth          | 9     | Login + Refresh + Logout                    |
| users         | 10    | CRUD + ensureTestEmployee                   |
| departments   | 9     | CRUD                                        |
| teams         | 11    | CRUD + members                              |
| roles         | 4     | Read-only                                   |
| notifications | 9     | CRUD + preferences + stats                  |
| blackboard    | 18    | CRUD + comments + confirm + archive         |
| calendar      | 8     | Events CRUD + dashboard                     |
| kvp           | 15    | CRUD + categories + comments + dashboard    |
| machines      | 15    | CRUD + categories + maintenance + stats     |
| surveys       | 10    | CRUD + templates + statistics               |
| chat          | 6     | Braucht 2. User (ensureTestEmployee)        |
| documents     | 4     | Folders + list                              |
| shifts        | 12    | Rotation generation + week/history deletion |
| logs          | 24    | Export JSON/CSV/TXT + validation + throttle |
| settings      | 4     | System + tenant + user + categories         |
| features      | 4     | List + categories + my-features             |
| areas         | 3     | List + stats                                |

**Kritische Patterns:**

```typescript
// 1. Auth-Header-Trennung (Fastify lehnt Content-Type bei body-losen Requests ab)
authHeaders(token)  // POST/PUT mit Body → inkl. Content-Type
authOnly(token)     // GET/DELETE → nur Authorization

// 2. One-Request-per-Describe (verhindert Rate-Limiting)
describe('Module: List', () => {
  let res: Response;
  beforeAll(async () => { res = await fetch(...); });
  it('should return 200', () => { expect(res.status).toBe(200); });
});

// 3. Throttle-Flush fuer rate-limited Endpoints
flushThrottleKeys();  // Redis EVAL loescht throttle:* Keys
const res = await fetch(`${BASE_URL}/logs/export?format=json...`);
```

### Vitest Config (Workspace-Projects)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      // Tier 1: Unit Tests
      {
        test: {
          name: 'unit',
          include: ['backend/src/**/*.{test,spec}.ts', 'shared/src/**/*.{test,spec}.ts'],
          testTimeout: 10_000,
          setupFiles: ['./vitest.setup.ts'],
        },
      },
      // Tier 2: API Integration Tests
      {
        test: {
          name: 'api',
          include: ['api-tests/vitest/**/*.api.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 30_000,
          pool: 'forks',
          maxWorkers: 1, // Sequentiell (Shared Auth State)
          isolate: false, // Module-Cache shared (Login nur 1x)
        },
      },
    ],
  },
});
```

### npm Scripts

| Script               | Command                     | Zweck                               |
| -------------------- | --------------------------- | ----------------------------------- |
| `pnpm test`          | `vitest run`                | Alle Tests (Unit + API)             |
| `pnpm test:unit`     | `vitest run --project unit` | Nur Unit-Tests (kein Docker noetig) |
| `pnpm test:api`      | `vitest run --project api`  | Nur API-Tests (Docker erforderlich) |
| `pnpm test:watch`    | `vitest`                    | Watch-Mode                          |
| `pnpm test:coverage` | `vitest run --coverage`     | Coverage-Report                     |
| `pnpm test:ui`       | `vitest --ui --watch`       | Browser-UI auf Port 5175            |

### Phase-basierter Rollout

```
Phase 0: Config & Infrastruktur    ✅ DONE   6/6 Checks
Phase 1: Proof of Concept          ✅ DONE   16 Tests   (fieldMapper)
Phase 2: Shared Package            ✅ DONE   36 Tests   (date-helpers, is-active)
Phase 3: Zod Schemas               ✅ DONE   63 Tests   (common.schema)
Phase 4: Backend Helpers            ✅ DONE  107 Tests   (shifts, users, kvp, audit)
──────────────────────────────────────────────────────────────────────
Phase 5: Services (Mocking)         PENDING   ~80-100    (roles, rotation, features, auth)
Phase 6: Restliche Helpers          PENDING   ~60-80     (blackboard, calendar, chat, etc.)
Phase 7: Frontend Utils             PENDING   ~40-50     (password-strength, auth, jwt)
Phase 8: DTO-Validierungen          PENDING  ~100-120    (alle Module)
```

**Regel:** Phase N+1 startet erst wenn Phase N 100% gruen ist. Kein Vorspringen.

### Coverage-Ziele

| Metrik     | Phase 4 (aktuell) | Langfrist-Ziel (Phase 8) |
| ---------- | ----------------- | ------------------------ |
| Lines      | ~35%              | 70%                      |
| Branches   | ~30%              | 60%                      |
| Functions  | ~40%              | 75%                      |
| Statements | ~35%              | 70%                      |

Coverage-Thresholds werden erst ab Phase 5 in CI aktiviert.

### CI/CD Integration (geplant)

```yaml
# .github/workflows/code-quality-checks.yml — Neuer Job
unit-tests:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v5
    - run: pnpm install --frozen-lockfile
    - run: pnpm test:unit # Nur Unit-Tests (kein Docker in CI)
    - run: pnpm test:coverage
```

**Wichtig:** API-Integration-Tests (`test:api`) laufen NICHT in CI — sie brauchen Docker mit DB/Redis.
Unit-Tests (`test:unit`) laufen in CI — sie brauchen nur Node.js.

---

## Consequences

### Positive

- **Single Tool** — Vitest fuer Unit + Integration, keine Tool-Fragmentierung
- **ESM-native** — Keine Workarounds, keine `--experimental-vm-modules` Flags
- **Schnell** — 222 Unit-Tests in <500ms, 175 API-Tests in ~6s
- **Deterministisch** — `vi.useFakeTimers()` fuer Dates, `flushThrottleKeys()` fuer Rate-Limiting
- **Workspace-Trennung** — Unit-Tests (CI-tauglich, kein Docker) vs. API-Tests (Docker required)
- **Bruno CLI eliminiert** — 329 npm-Packages entfernt, kein State-Management via `bru.setVar()`
- **Tests als Dokumentation** — Edge Cases (is_active Multi-State, Password NIST-Regeln) werden durch Tests sichtbar
- **Bugs durch Tests entdeckt** — EmailSchema Trim-Order-Bug, sanitizeData camelCase-Bug (Phase 3-4)
- **Regressionsschutz** — 397 automatisierte Assertions (222 Unit + 175 API)

### Negative

- **Kein DI-Container-Testing** — Wir testen nicht ob NestJS Module korrekt verdrahtet sind (akzeptables Risiko — API-Tests decken das indirekt ab)
- **API-Tests brauchen Docker** — Koennen nicht in Standard-CI laufen, nur lokal oder in Docker-CI
- **Sequentielle API-Tests** — `maxWorkers: 1` ist langsamer als parallel (aber notwendig wegen Shared State)
- **Phase-basiert = langsam** — Voller Coverage-Ausbau dauert mehrere Phasen
- **Service-Mocking-Overhead** — Ab Phase 5: `vi.mock()` fuer DB-Services manuell pflegen

### Neutral

- Bruno `.bru`-Dateien entfernt (waren nur noch fuer CLI, Desktop-App wird nicht genutzt)
- `@usebruno/cli` Dependency entfernt (-329 Packages)
- `test:api` Script umgeleitet auf Vitest (war vorher Bruno CLI)
- Bestehende `vitest.setup.ts` beibehalten (clearAllMocks, resetModules, Test-ENV-Vars)

---

## Resolved Issues (durch Testing-Migration entdeckt)

### 1. ResponseInterceptor Double-Wrapping (Shifts)

**Problem:** Controller wrappten manuell in `{ success, data }`, aber der globale `ResponseInterceptor` wrapped AUCH — doppeltes Wrapping.

**Fix:** 3 Controller-Methoden bereinigt (`rotation.controller.ts`, `shifts.controller.ts`). Controller returnen jetzt Daten direkt.

**Betroffene Dateien:** `rotation.controller.ts:270-283`, `rotation.controller.ts:323-349`, `shifts.controller.ts:476-494`

### 2. ExportThrottle Rate-Limiting (Logs)

**Problem:** `ExportThrottle` erlaubt 1 Request/Minute. 6 sequentielle Export-Requests in Tests loesten 429er aus.

**Fix:** `flushThrottleKeys()` in `helpers.ts` — flusht Redis `throttle:*` Keys per `docker exec` + EVAL. Auth-Tokens sind im Node-Prozess gecached (nicht Redis), daher sicher.

### 3. KVP Team-Lead-Requirement

**Problem:** `kvp.service.ts` verlangt dass Admin/Root-User ein Teamleiter ist (`orgInfo.teamLeadOf.length > 0`), sonst 403.

**Fix:** DB-Setup: `UPDATE teams SET team_lead_id = 1 WHERE id = 2 AND tenant_id = 1`

---

## Related Documents

- [VITEST-UNIT-TEST-PLAN.md](../../VITEST-UNIT-TEST-PLAN.md) — Detaillierter Phase-Plan (Phase 0-8)
- [VITEST-API-MIGRATION.md](../../VITEST-API-MIGRATION.md) — Bruno → Vitest Migration (103 Tests)
- [HOW-TO-TEST-WITH-VITEST.md](../../HOW-TO-TEST-WITH-VITEST.md) — Bedienungsanleitung fuer API-Tests

## Related ADRs

- **ADR-001** — Rate Limiting (ExportThrottle: 1 req/min, relevant fuer Logs-Tests)
- **ADR-005** — Authentication Strategy (JWT Guard, relevant fuer Login-Caching)
- **ADR-007** — API Response Standardization (ResponseInterceptor, relevant fuer Double-Wrapping-Fix)
- **ADR-013** — CI/CD Pipeline Hardening (Unit-Tests als zukuenftiges Merge-Gate)

---

_Last Updated: 2026-02-04 (v1 - Initial Decision)_
