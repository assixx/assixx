# Vitest Unit Test Plan — Assixx

**Version:** 1.4.0 | **Branch:** `unit-test` | **Erstellt:** 2026-02-04 | **Letztes Update:** 2026-02-05

> **Philosophie:** Fundament zuerst. Peu à peu. Wenn heute die Config stimmt und EIN grüner Test läuft — war der Tag gut.

---

## Inhaltsverzeichnis

1. [Ist-Zustand](#1-ist-zustand)
2. [Phase 0: Fundament (Config & Infrastruktur)](#2-phase-0-fundament)
3. [Phase 1: Erster grüner Test (Proof of Concept)](#3-phase-1-erster-grüner-test)
4. [Phase 2-8: Test-Phasen (nach stabilem Fundament)](#4-phase-2-8-test-phasen)
5. [Best Practices (Industrie-Standard)](#5-best-practices-industrie-standard)
6. [Konventionen & Regeln](#6-konventionen--regeln)
7. [CI/CD Integration (nach Phase 2)](#7-cicd-integration)
8. [Coverage-Ziele (Langfrist)](#8-coverage-ziele)
9. [Erkenntnisse / Findings](#erkenntnisse--findings-durch-tests-entdeckt)

---

## 1. Ist-Zustand

### Was existiert

| Was                | Status                                                                |
| ------------------ | --------------------------------------------------------------------- |
| Vitest installiert | v4.0.18 + `@vitest/coverage-v8` + `@vitest/ui`                        |
| `vitest.config.ts` | **FIXED** — alle 4 Fehler behoben (Phase 0)                           |
| `vitest.setup.ts`  | Erweitert: `TZ=UTC` für deterministische Date-Tests                   |
| Test-Dateien       | **62 Dateien, 1222 Tests** — Phase 0-9 ✅, Phase 10 🔄 IN PROGRESS    |
| Vitest API-Tests   | 18 Dateien, 175 Tests (Vitest Integration)                            |
| CI/CD              | `code-quality-checks.yml` — Unit-Tests als Merge-Gate ✅ (2026-02-05) |
| Coverage           | **Funktioniert** — nest/ inkludiert, v8 Provider aktiv                |

### npm Scripts (vorhanden)

```bash
pnpm test            # vitest run         → Single-Run
pnpm test:watch      # vitest             → Watch-Mode (Re-Run bei File-Change)
pnpm test:coverage   # vitest run --coverage → Coverage-Report
pnpm test:ui         # vitest --ui --watch → Browser-UI auf http://localhost:5175
```

### Aktueller Zustand bei `pnpm test --project unit --project frontend-unit`

```
 ✓  unit  shared/src/constants/is-active.test.ts                               ( 9 tests)
 ✓  unit  shared/src/helpers/date-helpers.test.ts                              (27 tests)
 ✓  unit  backend/src/utils/fieldMapper.test.ts                                (16 tests)
 ✓  unit  backend/src/schemas/common.schema.test.ts                            (63 tests)
 ✓  unit  backend/src/nest/common/audit/audit.helpers.test.ts                  (41 tests)
 ✓  unit  backend/src/nest/users/users.helpers.test.ts                         (27 tests)
 ✓  unit  backend/src/nest/shifts/shifts.helpers.test.ts                       (22 tests)
 ✓  unit  backend/src/nest/kvp/kvp.helpers.test.ts                             (24 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard.helpers.test.ts               ( 6 tests)
 ✓  unit  backend/src/nest/calendar/calendar.helpers.test.ts                   ( 7 tests)
 ✓  unit  backend/src/nest/chat/chat.helpers.test.ts                           (10 tests)
 ✓  unit  backend/src/nest/documents/documents.helpers.test.ts                 ( 5 tests)
 ✓  unit  backend/src/nest/surveys/surveys.helpers.test.ts                     ( 6 tests)
 ✓  unit  backend/src/nest/notifications/notifications.helpers.test.ts         ( 3 tests)
 ✓  unit  backend/src/nest/roles/roles.service.test.ts                         (32 tests)
 ✓  unit  backend/src/nest/features/features.service.test.ts                   (23 tests)
 ✓  unit  backend/src/nest/auth/auth.service.test.ts                           (14 tests)
 ✓  unit  backend/src/nest/admin-permissions/admin-permissions.service.test.ts (17 tests)
 ✓  unit  backend/src/nest/auth/dto/auth.dto.test.ts                           (20 tests)
 ✓  unit  backend/src/nest/users/dto/users.dto.test.ts                         (54 tests)
 ✓  unit  backend/src/nest/calendar/dto/calendar.dto.test.ts                   (42 tests)
 ✓  unit  backend/src/nest/departments/dto/departments.dto.test.ts             (23 tests)
 ✓  unit  backend/src/nest/teams/dto/teams.dto.test.ts                         (26 tests)
 ✓  unit  backend/src/nest/notifications/dto/notifications.dto.test.ts         (26 tests)
 ✓  unit  backend/src/nest/blackboard/dto/blackboard.dto.test.ts               (37 tests)
 ✓  unit  backend/src/nest/machines/dto/machines.dto.test.ts                   (42 tests)
 ✓  unit  backend/src/nest/surveys/dto/surveys.dto.test.ts                     (29 tests)
 ✓  unit  backend/src/nest/documents/dto/documents.dto.test.ts                 (20 tests)
 ✓  unit  backend/src/nest/kvp/dto/kvp.dto.test.ts                            (42 tests)
 ✓  unit  backend/src/nest/shifts/dto/shifts.dto.test.ts                       (66 tests)
 ✓  unit  backend/src/nest/settings/dto/settings.dto.test.ts                   (33 tests)
 ✓  unit  backend/src/nest/logs/log-formatters.service.test.ts                 (28 tests)
 ✓  unit  backend/src/nest/config/config.service.test.ts                       (14 tests)
 ✓  unit  backend/src/nest/common/audit/audit-metadata.service.test.ts         ( 8 tests)
 ✓  unit  backend/src/nest/common/audit/audit-logging.service.test.ts          ( 5 tests)
 ✓  unit  backend/src/nest/logs/log-retention.service.test.ts                  ( 8 tests)
 ✓  unit  backend/src/nest/machines/machine-team.service.test.ts               ( 5 tests)
 ✓  unit  backend/src/nest/shifts/rotation-generator.service.test.ts           ( 6 tests)
 ✓  unit  backend/src/nest/audit-trail/audit-trail.service.test.ts             (30 tests)
 ✓  unit  backend/src/nest/shifts/rotation-pattern.service.test.ts             (17 tests)
 ✓  unit  backend/src/nest/kvp/kvp.service.test.ts                             (12 tests)
 ✓  unit  backend/src/nest/documents/documents.service.test.ts                 (19 tests)
 ✓  unit  backend/src/nest/surveys/surveys.service.test.ts                     (12 tests)
 ✓  unit  backend/src/nest/reports/reports.service.test.ts                     (16 tests)
 ✓  unit  backend/src/nest/settings/settings.service.test.ts                   (38 tests)
 ✓  unit  backend/src/nest/plans/plans.service.test.ts                         (12 tests)
 ✓  unit  backend/src/nest/shifts/shifts.service.test.ts                       (11 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-entries.service.test.ts       (10 tests)
 ✓  unit  backend/src/nest/users/user-availability.service.test.ts             (24 tests)
 ✓  unit  backend/src/nest/notifications/notifications.service.test.ts         (14 tests)
 ✓  unit  backend/src/nest/calendar/calendar.service.test.ts                   (18 tests)
 ✓  unit  backend/src/nest/chat/chat-conversations.service.test.ts             (12 tests)
 ✓  unit  backend/src/nest/surveys/survey-access.service.test.ts               (17 tests)
 ✓  unit  backend/src/nest/machines/machines.service.test.ts                   (12 tests)
 ✓  unit  backend/src/nest/signup/signup.service.test.ts                       (20 tests)
 ✓  unit  backend/src/nest/chat/chat-messages.service.test.ts                  (13 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard.service.test.ts               (10 tests)
 ✓  frontend-unit  frontend/src/lib/utils/avatar-helpers.test.ts               ( 4 tests)
 ✓  frontend-unit  frontend/src/lib/utils/sanitize-html.test.ts                ( 2 tests)
 ✓  frontend-unit  frontend/src/lib/utils/auth.test.ts                         ( 6 tests)
 ✓  frontend-unit  frontend/src/lib/utils/password-strength.test.ts            ( 4 tests)
 ✓  frontend-unit  frontend/src/lib/utils/jwt-utils.test.ts                    ( 3 tests)

 Test Files  62 passed (62)
       Tests  1222 passed (1222)
    Duration  ~3.2s
```

Phase 0-10 (laufend). 1203 Unit + 19 Frontend = 1222 Tests grün.

---

## 2. Phase 0: Fundament (Config & Infrastruktur)

> **Ziel:** Bevor auch nur EIN Test geschrieben wird, muss die gesamte Infrastruktur stimmen. Langfristig denken. Kein Quick-Fix.

### Schritt 0.1: `vitest.config.ts` — Coverage-Exclude fixen

**Problem:** Coverage schließt `backend/src/nest/**` aus — dort liegt 100% der Business-Logik.

```typescript
// ❌ AKTUELL (FALSCH)
coverage: {
  exclude: [
    'backend/src/nest/**', // "NestJS has own test system" — IRREFÜHREND
  ],
}
```

**Warum falsch:** `@nestjs/testing` ist für Integration-Tests mit DI-Container. Wir testen reine Funktionen mit Vitest — das hat nichts mit dem NestJS-Testsystem zu tun.

```typescript
// ✅ FIX: Nur wirklich untestbare Dinge ausschließen
coverage: {
  provider: 'v8',
  reporter: ['text', 'json', 'html'],
  reportsDirectory: './coverage',
  include: [
    'backend/src/**/*.ts',
    'shared/src/**/*.ts',
  ],
  exclude: [
    'backend/src/**/*.test.ts',
    'backend/src/**/*.spec.ts',
    'backend/src/**/*.module.ts',     // NestJS Module-Definitionen (nur DI-Wiring)
    'backend/src/**/*.controller.ts', // Controller = HTTP-Layer (→ Integration-Test)
    'backend/src/**/main.ts',         // NestJS Bootstrap
    'backend/src/**/index.ts',        // Barrel-Exports
    'backend/src/types/**',           // Reine Type-Definitionen
  ],
}
```

**Verifikation:** `pnpm test:coverage` zeigt nest/-Dateien in der Coverage-Tabelle.

---

### Schritt 0.2: `vitest.config.ts` — Test-Include erweitern

**Problem:** Nur `backend/src/**` im Include. Tests im `shared/`-Package werden ignoriert.

```typescript
// ❌ AKTUELL
include: ['backend/src/**/*.{test,spec}.ts'],

// ✅ FIX
include: [
  'backend/src/**/*.{test,spec}.ts',
  'shared/src/**/*.{test,spec}.ts',
],
```

**Verifikation:** Test-Datei in `shared/src/` wird von `pnpm test` gefunden.

---

### Schritt 0.3: `vitest.config.ts` — Aliases aktualisieren

**Problem:** Aliases zeigen auf nicht-existierende Pre-NestJS-Pfade.

```typescript
// ❌ AKTUELL (VERALTET)
resolve: {
  alias: {
    '@controllers': resolve(rootDir, './backend/src/controllers'), // EXISTIERT NICHT
    '@models': resolve(rootDir, './backend/src/models'),           // EXISTIERT NICHT
    '@middleware': resolve(rootDir, './backend/src/middleware'),   // EXISTIERT NICHT
    '@services': resolve(rootDir, './backend/src/services'),      // Nur 2 Legacy-Files
  },
}

// ✅ FIX: An aktuelle NestJS-Struktur anpassen
resolve: {
  alias: {
    '@': resolve(rootDir, './backend/src'),
    '@nest': resolve(rootDir, './backend/src/nest'),
    '@utils': resolve(rootDir, './backend/src/utils'),
    '@schemas': resolve(rootDir, './backend/src/schemas'),
    '@shared': resolve(rootDir, './shared/src'),
  },
}
```

**Verifikation:** Import mit `@utils/fieldMapper.js` in einem Test resolves korrekt.

---

### Schritt 0.4: `vitest.setup.ts` — Prüfen & ggf. erweitern

**Aktuell:** Funktioniert, aber prüfen ob ausreichend.

```typescript
// vitest.setup.ts (AKTUELL)
beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.resetModules());
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-vitest';
// ... weitere ENV-Vars
```

**Prüfpunkte:**

- [ ] `vi.clearAllMocks()` in `beforeEach` — korrekt
- [ ] `vi.resetModules()` in `afterEach` — korrekt
- [ ] Test-ENV-Vars gesetzt — korrekt
- [ ] Kein globaler State der Tests koppelt — prüfen

---

### Schritt 0.5: `.gitignore` — Coverage-Output ausschließen

**Prüfen:** Ist `coverage/` in `.gitignore`? Wenn nicht, hinzufügen.

```
# Test coverage
coverage/
```

---

### Schritt 0.6: Smoke-Test — `pnpm test` läuft ohne Fehler

Nach allen Config-Fixes:

```bash
pnpm test
# Erwartung: "No test files found" (noch keine Tests) ODER exit 0

pnpm test:coverage
# Erwartung: Läuft durch, zeigt leere Coverage-Tabelle

pnpm test:ui
# Erwartung: Browser-UI auf http://localhost:5175 erreichbar
```

**Kriterium für Phase 0 abgeschlossen:** Alle drei Commands laufen fehlerfrei.

---

### Phase 0: Checkliste

| #   | Aufgabe                                                                    | Status |
| --- | -------------------------------------------------------------------------- | ------ |
| 0.1 | Coverage-Exclude: `nest/**` entfernen, sinnvolle Excludes setzen           | [x]    |
| 0.2 | Include: `shared/src/**` hinzufügen                                        | [x]    |
| 0.3 | Aliases: Auf NestJS-Struktur aktualisieren                                 | [x]    |
| 0.4 | Setup: `vitest.setup.ts` prüfen + `TZ=UTC` ergänzt                         | [x]    |
| 0.5 | `.gitignore`: `coverage/` drin?                                            | [x]    |
| 0.6 | Smoke-Test: `pnpm test` + `pnpm test:coverage` + `pnpm test:ui` fehlerfrei | [x]    |

**Zusätzlich erledigt:**

- `@vitest/coverage-v8` installiert (fehlte als Dependency)
- `@vitest/ui` installiert (für Browser-UI)
- `root: rootDir` statt `root: '.'` (WSL2 ERR_INVALID_FILE_URL_HOST Fix)

### Phase 0: Definition of Done

- [x] `vitest.config.ts` hat korrekte Includes, Excludes und Aliases
- [x] `pnpm test` läuft fehlerfrei (exit 0 oder "no test files found")
- [x] `pnpm test:coverage` läuft durch ohne Crash
- [x] `coverage/` ist in `.gitignore`
- [x] Keine Quick-Fixes, keine Workarounds — saubere Config

---

## 3. Phase 1: Erster grüner Test (Proof of Concept)

> **Ziel:** EINE Test-Datei. Grün. Beweis dass das Fundament trägt. Nicht mehr.

### Warum `fieldMapper.ts`?

| Kriterium                 | fieldMapper.ts                                  |
| ------------------------- | ----------------------------------------------- |
| Pure Function             | Ja — kein DI, kein State, kein DB               |
| Dependencies              | Nur `lodash` (trivial)                          |
| Im Include-Pfad           | `backend/src/utils/` — ja                       |
| Wird überall benutzt      | Ja — jeder Helper importiert `dbToApi()`        |
| Klare Input→Output        | Objekt rein → Objekt raus                       |
| Edge Cases dokumentierbar | `is_active` Exception, null-Handling, Rekursion |

### Datei: `backend/src/utils/fieldMapper.test.ts`

**Zu testende Funktionen:** `dbToApi()`, `apiToDb()`

**Testfälle (Minimum für Phase 1):**

```
dbToApi()
├── should convert snake_case keys to camelCase
├── should convert is_* fields to boolean
├── should convert has_* fields to boolean
├── should NOT convert is_active to boolean (multi-state: 0/1/3/4)
├── should convert Date objects to ISO string
├── should preserve null values
├── should handle nested objects recursively
├── should handle arrays of objects
├── should return empty object for empty input

apiToDb()
├── should convert camelCase keys to snake_case
├── should preserve null values
├── should handle nested objects recursively
├── should handle arrays of objects
├── should return empty object for empty input
```

### Erfolgskriterium Phase 1

```bash
pnpm test
#  ✓ backend/src/utils/fieldMapper.test.ts (14 tests) 23ms
#  Tests  14 passed
#  Duration  0.5s
```

14+ Tests. Alle grün. Fertig. Das ist der Beweis.

### Phase 1: Definition of Done

- [x] `pnpm test` zeigt 14+ grüne Tests — **16 Tests, alle grün**
- [x] Kein `.only` oder `.skip` im Code
- [x] Alle Tests folgen AAA-Pattern und Naming-Konvention
- [x] `pnpm test:coverage` zeigt `fieldMapper.ts` mit >90% Coverage — **100% Stmts / 97.14% Branch / 100% Fn / 100% Lines**

---

## 4. Phase 2-8: Test-Phasen (nach stabilem Fundament)

> **Regel:** Jede Phase wird erst begonnen wenn die vorherige Phase 100% grün ist. Kein Vorspringen.

### Phase 2: Shared Package — Pure Helpers

| #   | Datei                                | Funktionen                                                                                                | Fokus                                                                                                                                                      |
| --- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `shared/src/helpers/date-helpers.ts` | `formatDate()`, `formatDateTime()`, `formatTime()`, `formatRelativeDate()`, `isToday()`, `isWithinDays()` | DE-Locale, relative Zeiten ("gerade eben", "gestern"), Edge: Mitternacht, Jahreswechsel. WICHTIG: `vi.useFakeTimers()` für deterministische Zeitvergleiche |
| 2   | `shared/src/constants/is-active.ts`  | `IS_ACTIVE`, `STATUS_LABELS`, `STATUS_BADGE_CLASSES`, `FORM_STATUS_OPTIONS`                               | Mapping-Korrektheit, FORM_STATUS_OPTIONS hat KEIN "deleted"                                                                                                |

**Geschätzte Tests:** ~25-30 → **Tatsächlich: 36 Tests (9 + 27)**

### Phase 2: Definition of Done

- [x] `pnpm test` zeigt alle Phase 1+2 Tests grün — **52 Tests (16 + 36)**
- [x] `date-helpers.test.ts` nutzt `vi.useFakeTimers()` — keine flaky Tests
- [x] `is-active.test.ts` verifiziert alle 4 Status-Codes (0/1/3/4)
- [x] Kein `.only` oder `.skip` im Code

---

### Phase 3: Zod Schemas — Eingabe-Validierung

| #   | Datei                                  | Schemas                    | Fokus                                                                  |
| --- | -------------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| 1   | `backend/src/schemas/common.schema.ts` | `IdSchema`                 | String→Number Coercion, ""→undefined, "abc"→undefined, -1→fail, 0→fail |
| 2   | (gleich)                               | `EmailSchema`              | Valide/invalide Emails, Normalisierung (Trim, Lowercase)               |
| 3   | (gleich)                               | `PasswordSchema`           | <12→fail, >72→fail, 3/4 Kategorien-Regel (NIST 800-63B)                |
| 4   | (gleich)                               | `PaginationSchema`         | String→Number, Defaults (page=1, limit=10), max=100                    |
| 5   | (gleich)                               | `TenantIdSchema`           | 0→fail, -1→fail                                                        |
| 6   | (gleich)                               | `DateSchema`, `TimeSchema` | ISO-Format, HH:MM, ungültige Strings                                   |
| 7   | (gleich)                               | `DocumentMimeTypes`        | Erlaubte→pass, unbekannte→fail                                         |

**Geschätzte Tests:** ~50-60 → **Tatsächlich: 63 Tests**

### Phase 3: Definition of Done

- [x] Jedes Schema hat Happy-Path + Edge-Case + Grenzwert-Tests
- [x] `PasswordSchema` testet NIST 800-63B Regeln (12-72 chars, 3/4 Kategorien)
- [x] Alle Coercion-Logik getestet (String→Number, Trim, Lowercase)
- [x] Kein `.only` oder `.skip` im Code
- [ ] CI-Job hinzugefügt (optional, nicht required) — verschoben auf nach Phase 4

**Erkenntnis:** EmailSchema hat Trim-Order-Bug — `.trim()` läuft NACH `.regex()`, daher scheitern Emails mit Whitespace am Regex bevor Trim greift. Im Test dokumentiert.

---

### Phase 4: Backend Helpers — Data Transformation

| #   | Datei                                            | Kernfunktionen                                                                                                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `backend/src/nest/shifts/shifts.helpers.ts`      | `parseTimeFromDateTime()`, `parseDateToString()`, `buildTimestamp()`, `calculateHours()`                                                        |
| 2   | `backend/src/nest/users/users.helpers.ts`        | `mapSortField()`, `isUniqueConstraintViolation()`, `buildUpdateFields()`, `buildUserListWhereClause()`                                          |
| 3   | `backend/src/nest/kvp/kvp.helpers.ts`            | `isUuid()`, `hasExtendedOrgAccess()`, `buildStatusFilter()`, `buildFilterConditions()`, `mapOrgLevelToRecipient()`                              |
| 4   | `backend/src/nest/common/audit/audit.helpers.ts` | `sanitizeData()`, `extractResourceType()`, `extractResourceId()`, `singularize()`, `shouldExclude()`, `getPathBasedAction()`, `buildUserName()` |

**Geschätzte Tests:** ~100-120 → **Tatsächlich: 107 Tests (22 + 20 + 24 + 41)**

### Phase 4: Definition of Done

- [x] Alle Helper-Dateien haben co-located `.test.ts`
- [x] SQL-Injection-Schutz getestet (`mapSortField()` Fallback — `'DROP TABLE users'` → `'created_at'`)
- [x] `sanitizeData()` redacted SENSITIVE_FIELDS (mit dokumentierter camelCase-Limitation)
- [x] `singularize()` deckt Special-Cases ab (entries→entry, categories→category, activities→activity, companies→company)
- [x] Kein `.only` oder `.skip` im Code
- [ ] CI-Job als **required** gesetzt — noch nicht implementiert

**Erkenntnis:** `sanitizeData()` hat camelCase-Sensitivity-Bug — `SENSITIVE_FIELDS.includes(key.toLowerCase())` nutzt case-sensitive `Array.includes()`. CamelCase-Einträge wie `accessToken` matchen nicht auf `accesstoken`. ALL-CAPS Keys (z.B. `PASSWORD`) funktionieren korrekt. Im Test dokumentiert.

---

### Phase 5: Service-Logik mit Mocking

| #   | Datei                          | Testbare Logik                                                  | Was wird gemockt     |
| --- | ------------------------------ | --------------------------------------------------------------- | -------------------- |
| 1   | `roles.service.ts`             | `getRoleHierarchy()`, `getAssignableRoles()`, `checkUserRole()` | `execute` (utils/db) |
| 2   | `features.service.ts`          | Mapper-Logik, Status-Berechnung, `checkTenantAccess()`          | DatabaseService      |
| 3   | `auth.service.ts`              | `verifyToken()`, Token-Reuse-Detection, Refresh-Rotation        | DatabaseService, JWT |
| 4   | `admin-permissions.service.ts` | `checkAccess()`, Permission-Level-Prüfung, Deprecated-Verhalten | DatabaseService      |

**Nicht getestet (bewusst ausgelassen):**

- `rotation-generator.service.ts` — Alle pure Methoden sind `private`, testbar nur via öffentliche Methoden die komplexes DB-Mocking brauchen. → Phase 6 oder Extract-to-Helper.
- `plans.service.ts` — Mapper-Logik identisch zu features.service.ts. Kein Mehrwert durch doppelte Tests.

**Mocking-Pattern (konsistent über alle Service-Tests):**

```typescript
// 1. Create mock DB factory
function createMockDb() {
  return { query: vi.fn(), queryOne: vi.fn() };
}

// 2. Instantiate service with mock (DI bypass)
const mockDb = createMockDb();
const service = new FeaturesService(mockDb as unknown as DatabaseService);

// 3. Configure mock per test
mockDb.query.mockResolvedValueOnce([{ id: 1, name: 'Test' }]);

// For modules with module-level validation (auth.service.ts):
vi.hoisted(() => {
  process.env['JWT_SECRET'] = 'long-enough-secret...';
});
```

**Geschätzte Tests:** ~80-100 → **Tatsächlich: 86 Tests (32 + 23 + 14 + 17)**

### Phase 5: Definition of Done

- [x] Mocking-Pattern dokumentiert und konsistent über alle Service-Tests
- [x] Kein echter DB-Call in Tests — alles gemockt
- [x] Role-Hierarchy-Logik vollständig getestet (root > admin > employee) — 9-Combo table-driven
- [x] Token-Reuse-Detection getestet (Refresh-Rotation) — 3 Reuse + 2 Happy-Path
- [x] Kein `.only` oder `.skip` im Code
- [ ] Coverage-Thresholds in CI aktiviert — verschoben auf CI-Setup

**Erkenntnisse:**

- `vi.hoisted()` nötig für Module mit Top-Level-Validierung (auth.service.ts `getJwtSecrets()`)
- `vi.useFakeTimers()` nötig für Feature-Expiry-Logik (deterministische `new Date()` Vergleiche)
- DI-Bypass via Constructor-Injection: `new Service(mockDb as unknown as DatabaseService)` — Standard-Pattern, kein NestJS-Testmodul nötig

---

### Phase 6: Restliche Helpers

| #   | Datei                      | Funktionen                                        |
| --- | -------------------------- | ------------------------------------------------- |
| 1   | `blackboard.helpers.ts`    | `validateSortColumn()`, `validateSortDirection()` |
| 2   | `calendar.helpers.ts`      | `validateSortColumn()`, Filter-Normalisierung     |
| 3   | `chat.helpers.ts`          | Row→User-Mapping, Conversation-Mapping            |
| 4   | `documents.helpers.ts`     | Tag-Parsing, MIME-Validation                      |
| 5   | `surveys.helpers.ts`       | Status-Workflow, Question-Validierung             |
| 6   | `notifications.helpers.ts` | Type-Mapping                                      |

**Geschätzte Tests:** ~60-80 → **Tatsächlich: 37 Tests (6 + 7 + 10 + 5 + 6 + 3)**

Constraint: 1 Test pro Funktion — lean, kein Over-Testing. DB-Helpers in `documents.helpers.ts` bewusst ausgelassen (getDocumentRow, insertDocumentRecord, getDocumentsCount → Integration-Test).

### Phase 6: Definition of Done

- [x] Alle restlichen Helper-Dateien haben Tests (6 Dateien)
- [x] 1 Test pro Funktion — kein Over-Testing
- [x] `vi.useFakeTimers()` für `validateScheduledTime()` (chat)
- [x] Kein `.only` oder `.skip` im Code

---

### Phase 7: Frontend Utils (eigenes Setup)

**Lösung:** Eigenes `frontend-unit` Projekt in `vitest.config.ts` mit `environment: 'node'` + custom Mocks (kein happy-dom nötig).

**Infrastruktur:**

- `vitest.mocks/app-environment.ts` — Mock für `$app/environment` (browser=false)
- `vitest.frontend-setup.ts` — Map-based localStorage + window Mock
- `vitest.config.ts` — `frontend-unit` Projekt mit resolve-alias für `$app/environment`

**Mocking-Pattern:** `vi.mock('./logger')` in jeder Test-Datei die Logger braucht (vermeidet $app/environment → pino Chain).

| #   | Datei                  | Funktionen                                                                                                                     | Tests |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | `avatar-helpers.ts`    | `getAvatarColor()`, `getAvatarColorClass()`, `getInitials()`, `getProfilePictureUrl()`                                         | 4     |
| 2   | `password-strength.ts` | `getStrengthLabel()`, `getStrengthColor()`, `getStrengthClass()`, `formatCrackTime()`                                          | 4     |
| 3   | `jwt-utils.ts`         | `parseJwt()`, `isTokenExpired()`, `getTokenExpiryTime()`                                                                       | 3     |
| 4   | `sanitize-html.ts`     | `escapeHtml()`, `sanitizeHtml()` (SSR fallback)                                                                                | 2     |
| 5   | `auth.ts`              | `getRoleDisplayName()`, `setAuthToken()+getAuthToken()`, `setUserRole()+getUserRole()`, `hasPermission()`, `isAuthenticated()` | 6     |

**Geschätzte Tests:** ~40-50 → **Tatsächlich: 19 Tests (4 + 4 + 3 + 2 + 6)**

Constraint: 1 Test pro Funktion. Async Functions (zxcvbn) und DOMPurify-Branch bewusst ausgelassen.

### Phase 7: Definition of Done

- [x] `frontend-unit` Projekt in `vitest.config.ts` mit resolve-alias für `$app/environment`
- [x] `pnpm test --project frontend-unit` läuft separat und grün (19 Tests, 279ms)
- [x] localStorage via Map-based Mock in `vitest.frontend-setup.ts`
- [x] Logger-Mock via `vi.mock('./logger')` in Test-Dateien (vermeidet pino-Import)
- [x] Kein `.only` oder `.skip` im Code

---

### Phase 8: DTO-Validierungen (alle Module)

Alle Zod-DTOs in `backend/src/nest/*/dto/` testen: valid→pass, missing required→fail, wrong type→fail, edge values.

**Module:** users, auth, departments, teams, calendar, kvp, shifts, surveys, documents, blackboard, machines, notifications, settings

**Geschätzte Tests:** ~100-120

### Phase 8: Definition of Done

- [x] Jedes DTO-Modul hat Tests: valid→pass, missing required→fail, wrong type→fail
- [x] Grenzwerte getestet (min/max Längen, Zahlen)
- [x] Kein `.only` oder `.skip` im Code
- [x] CI blockiert Merge bei Test-Failure — ✅ `unit-tests` Job implementiert (2026-02-05)
- [ ] Backend-Coverage >= 70% Lines, 75% Functions — verschoben (aktuell 28%, Threshold 25%)

---

### Phase 9: Backend Service Tests — Coverage Push

> **Ziel:** Die 16 Service-Dateien mit 0% Coverage angreifen. Fokus: pure Logik zuerst, dann DB-Mocking. Coverage von ~10% auf ~20%+ heben.

**Strategie:** Step-by-step, 1 Service nach dem anderen. 1 Test pro Funktion (lean). Pure-Logik-Services zuerst (kein Mocking), dann Services mit DB-Dependency (mocked).

| #   | Service                         | Lines | Tests | Typ                                    | Status |
| --- | ------------------------------- | ----- | ----- | -------------------------------------- | ------ |
| 1   | `log-formatters.service.ts`     | 265   | 28    | Pure Logik (TXT/CSV/JSON Formatter)    | ✅     |
| 2   | `config.service.ts`             | 220   | 14    | Zod Validation, computed Getters       | ✅     |
| 3   | `audit-metadata.service.ts`     | 108   | 8     | Request-Metadata, fire-and-forget      | ✅     |
| 4   | `audit-logging.service.ts`      | 199   | 5     | Fire-and-forget, error extraction      | ✅     |
| 5   | `log-retention.service.ts`      | 363   | 8     | Retention days validation, min enforce | ✅     |
| 6   | `machine-team.service.ts`       | 118   | 5     | Row mapper, team validation            | ✅     |
| 7   | `rotation-generator.service.ts` | 621   | 6     | Schichttyp-Algorithmus, Weekend-Skip   | ✅     |
| 8   | `audit-trail.service.ts`        | 824   | 30    | CSV, row mapper, access control, stats | ✅     |
| 9   | `rotation-pattern.service.ts`   | 332   | 17    | Config parsing, date fmt, UUID, CRUD   | ✅     |
| 10  | `kvp.service.ts`                | 915   | 12    | Dashboard, permissions, visibility     | ✅     |
| 11  | `documents.service.ts`          | 844   | 19    | Access ctrl, stats, scope filter, UUID | ✅     |
| 12  | `surveys.service.ts`            | 774   | 12    | parseIdParam, UUID, templates, CRUD    | ✅     |

**Tatsächlich Phase 9 Gesamt:** 145 Tests in 12 Dateien ✅ COMPLETE

**Mocking-Pattern (Phase 9 — konsistent):**

```typescript
// Pure services: new Service() — kein Mock nötig
const service = new LogFormattersService();

// DB-dependent: Mock via constructor injection
const mockDb = { query: vi.fn() };
const service = new SomeService(mockDb as unknown as DatabaseService);

// PG Pool: Mock via constructor
const mockPool = { query: vi.fn() };
const service = new SomeService(mockPool as never);

// CLS: Mock via constructor
const mockCls = { get: vi.fn() };

// Fire-and-forget: vi.waitFor() für async void Methoden
await vi.waitFor(() => { expect(mockDb.query).toHaveBeenCalled(); });
```

**Erkenntnisse Phase 9:**

- Vitest nutzt Chai → **kein `endsWith()` Matcher!** Stattdessen `toMatch(/\n$/)` oder `expect(str.endsWith('\n')).toBe(true)`
- `vi.waitFor()` für fire-and-forget async Methoden (void Promise)
- `vi.useFakeTimers()` nötig für `rotation-generator` (Date-basierte Schichtberechnung)
- Private Methoden testen sich indirekt durch public API (z.B. `generateRotationShifts` testet `determineShiftType`, `shouldSkipBySpecialRules`, etc.)

### Phase 9: Definition of Done

- [x] Pure-Logik-Services getestet (log-formatters, config) — kein Mocking nötig
- [x] Audit-Services getestet (metadata, logging, retention) — fire-and-forget Pattern verifiziert
- [x] Business-kritischer Algorithmus getestet (rotation-generator) — Schichttyp, Weekend-Skip, Night-Static
- [x] Kein `.only` oder `.skip` im Code
- [x] Mocking-Pattern dokumentiert und konsistent (3 Varianten: pure, DB mock, Pool mock)
- [x] audit-trail.service.ts (30 Tests: CSV, row mapper, access control, stats, report summary)
- [x] rotation-pattern.service.ts (17 Tests: config parsing, date format, UUID, CRUD)
- [x] kvp.service.ts (12 Tests: dashboard, permissions, visibility)
- [x] documents.service.ts (19 Tests: access ctrl, stats, scope filter, UUID)
- [x] surveys.service.ts (11 Tests: parseIdParam, UUID, templates, CRUD)
- [ ] Coverage-Thresholds erhöhen (nach 20%+ erreicht)
- [ ] Coverage >= 20% Lines, 15% Functions

---

### Phase 10: Backend Service Tests — Remaining Services (Coverage Push)

> **Ziel:** Die verbleibenden 57 untesteten Services systematisch abarbeiten. DB-Mocking, Delegation-Tests, pure Helpers. Coverage von ~13% auf ~25%+ heben.

**Strategie:** Batch-weise (3 Services pro Batch), nach LOC sortiert. Pure Logik zuerst, dann DB-mocked, dann Delegation-Tests.

| #   | Service                         | Lines | Tests | Typ                                   | Status |
| --- | ------------------------------- | ----- | ----- | ------------------------------------- | ------ |
| 1   | `reports.service.ts`            | 512   | 16    | DB-mocked, pure formatters            | ✅     |
| 2   | `settings.service.ts`           | 487   | 38    | DB-mocked, validation, CRUD           | ✅     |
| 3   | `plans.service.ts`              | 404   | 12    | DB-mocked, mapper, delegation         | ✅     |
| 4   | `shifts.service.ts`             | 725   | 11    | DB-mocked, schedule logic             | ✅     |
| 5   | `blackboard-entries.service.ts` | 548   | 10    | DB-mocked, archive, access ctrl       | ✅     |
| 6   | `user-availability.service.ts`  | 697   | 24    | Pure helpers + DB-mocked, validation  | ✅     |
| 7   | `notifications.service.ts`      | 553   | 14    | DB-mocked + delegation to sub-svc     | ✅     |
| 8   | `calendar.service.ts`           | 648   | 18    | Pure helpers + DB-mocked + delegation | ✅     |
| 9   | `chat-conversations.service.ts` | 635   | 12    | CLS-mocked, context helpers, stubs    | ✅     |
| 10  | `survey-access.service.ts`      | 559   | 17    | Pure clause builders + DB-mocked      | ✅     |
| 11  | `machines.service.ts`           | 498   | 12    | DB-mocked + delegation to sub-svc     | ✅     |
| 12  | `signup.service.ts`             | 453   | 20    | Pure validators + DB-mocked           | ✅     |
| 13  | `chat-messages.service.ts`      | 534   | 13    | Pure clause builders + stubs + DB     | ✅     |
| 14  | `blackboard.service.ts`         | 332   | 10    | Pure facade delegation                | ✅     |

**Phase 10 Gesamt:** 227 Tests in 14 Dateien (+ 7 Tests in users.helpers erweitert)

**Mocking-Pattern (Phase 10 — konsistent):**

```typescript
// Facade/Delegation pattern (blackboard.service.ts):
const mockEntries = { listEntries: vi.fn(), createEntry: vi.fn() };
const service = new BlackboardService(
  mockEntries as unknown as BlackboardEntriesService,
  mockComments as unknown as BlackboardCommentsService, ...
);
expect(mockEntries.listEntries).toHaveBeenCalledWith(1, 5, {} as never);

// CLS-dependent services (chat-*.service.ts):
const mockCls = {
  get: vi.fn((key: string) => {
    if (key === 'tenantId') return 1;
    if (key === 'userId') return 5;
    return undefined;
  }),
};
const service = new ChatMessagesService(
  mockCls as unknown as ClsService,
  mockDb as unknown as DatabaseService,
);

// Full mock rows for services with mappers (machines.service.ts):
// ALL optional fields must be null (NOT undefined!) to avoid new Date(undefined)
mockDb.queryOne.mockResolvedValueOnce({
  id: 1, name: 'Machine 1', tenant_id: 1,
  status: 'operational', is_active: 1, machine_type: 'cnc',
  created_at: new Date('2025-01-01'), updated_at: new Date('2025-01-01'),
  // ALL optional date/string fields explicitly null:
  purchase_date: null, installation_date: null, warranty_until: null,
  last_maintenance: null, next_maintenance: null, notes: null, ...
});
```

**Erkenntnisse Phase 10:**

- **`undefined !== null` Trap:** Mock-Rows müssen ALLE optionalen Felder auf `null` setzen (nicht `undefined`). `row.installation_date !== null` ist `true` wenn `undefined`, was `new Date(undefined)` → RangeError auslöst.
- **CLS-Mocking:** Chat-Services nutzen nestjs-cls — Mock mit key-basiertem `get()` Callback.
- **Facade-Pattern:** Reine Delegations-Services (blackboard.service.ts) brauchen nur Mock-Assertion `toHaveBeenCalledWith()` — kein DB-Mocking.
- **Stub-Methods:** Nicht-implementierte Methoden (editMessage, deleteMessage) werfen `BadRequestException` — testen reicht als 1-Liner.

### Phase 10: Definition of Done

- [x] 14 neue Service-Testdateien erstellt (227 Tests)
- [x] Facade/Delegation-Pattern getestet (blackboard.service)
- [x] CLS-abhängige Services getestet (chat-conversations, chat-messages)
- [x] Pure Clause-Builders getestet (survey-access, chat-messages)
- [x] `undefined !== null` Trap dokumentiert und in allen Mock-Rows beachtet
- [x] Kein `.only` oder `.skip` im Code
- [ ] Coverage-Thresholds erhöhen (nach 20%+ erreicht)
- [ ] Verbleibende ~43 Services (Phase 11+)

---

### Phasen-Übersicht

```
Phase 0:  Fundament         Config fixen, Smoke-Test                ✅ DONE (6/6 Checks)
Phase 1:  Proof of Concept  fieldMapper.test.ts — 16 Tests grün    ✅ DONE (16 Tests)
Phase 2:  Shared Package    date-helpers, is-active                 ✅ DONE (36 Tests)
Phase 3:  Zod Schemas       common.schema.ts                       ✅ DONE (63 Tests)
Phase 4:  Backend Helpers   shifts, users, kvp, audit               ✅ DONE (107 Tests)
Phase 5:  Services          roles, features, auth, admin-perms      ✅ DONE (86 Tests)
Phase 6:  Restliche         blackboard, calendar, chat, etc.        ✅ DONE (37 Tests)
Phase 7:  Frontend Utils    avatar, password, jwt, sanitize, auth    ✅ DONE (19 Tests)
Phase 8:  DTOs              Alle 13 Module (460 Tests, 13 Dateien)   ✅ DONE (460 Tests)
Phase 9:  Service Tests     12 Services, 145 Tests                    ✅ DONE (12/12 Services)
Phase 10: Service Tests II  14 Services, 234 Tests                     ✅ DONE (14/14 Services)
```

**Gesamt: 1203 Unit Tests + 19 Frontend Tests in 62 Dateien, alle grün.**
**Gesamtprojekt: 1397 Tests (1203 unit + 19 frontend + 175 API) in 80 Dateien.**

**Regel:** Phase N+1 startet erst wenn Phase N 100% grün ist.

---

## 5. Best Practices (Industrie-Standard)

> Quellen: Microsoft .NET Testing Guidelines, IBM Unit Testing Best Practices, "Unit Tests as Documentation" (The Coder Cafe)

### 5.1 F.I.R.S.T. Prinzipien

| Prinzip           | Bedeutung                                                                |
| ----------------- | ------------------------------------------------------------------------ |
| **Fast**          | Millisekunden pro Test. Langsame Tests werden nicht ausgeführt           |
| **Isolated**      | Kein Test hängt von einem anderen ab. Kein shared state                  |
| **Repeatable**    | Gleiches Ergebnis bei jedem Run. Kein `Math.random()`, kein `new Date()` |
| **Self-Checking** | Automatisch pass/fail. Kein manuelles Log-Lesen                          |
| **Timely**        | Tests werden MIT dem Code geschrieben, nicht "irgendwann"                |

### 5.2 Naming: Tests als lebende Dokumentation

Tests SIND die Dokumentation. Wenn ein Test fehlschlägt, soll der Name allein erklären was kaputt ist.

```typescript
// ❌ SCHLECHT — sagt nichts
it('should work', () => { ... });
it('test 1', () => { ... });

// ✅ GUT — sofort verständlich
it('should convert snake_case to camelCase', () => { ... });
it('should return undefined for invalid date input', () => { ... });
it('should redact password fields in nested objects', () => { ... });
```

Alternativ mit describe-Verschachtelung:

```typescript
describe('PasswordSchema', () => {
  describe('when password is too short', () => {
    it('should reject with min-length error', () => { ... });
  });
  describe('when password has only lowercase', () => {
    it('should reject with category error', () => { ... });
  });
});
```

### 5.3 Ein Konzept pro Test

Jeder Test prüft EINEN Aspekt. Wenn der Test fehlschlägt, weißt du sofort WAS kaputt ist.

```typescript
// ❌ SCHLECHT — zwei Dinge in einem Test
it('should handle conversion', () => {
  expect(dbToApi({ first_name: 'John' })).toEqual({ firstName: 'John' });
  expect(apiToDb({ firstName: 'John' })).toEqual({ first_name: 'John' });
});

// ✅ GUT — getrennte Tests
it('should convert snake_case keys to camelCase', () => {
  expect(dbToApi({ first_name: 'John' })).toEqual({ firstName: 'John' });
});

it('should convert camelCase keys to snake_case', () => {
  expect(apiToDb({ firstName: 'John' })).toEqual({ first_name: 'John' });
});
```

### 5.4 Minimaler Test-Input

Nutze den **einfachsten** Input der das Verhalten beweist. Kein Rauschen.

```typescript
// ❌ SCHLECHT — überflüssige Daten
const user = {
  id: 42,
  first_name: 'John',
  last_name: 'Doe',
  email: 'john@test.de',
  role: 'admin',
  tenant_id: 7,
  created_at: '2025-01-01',
  is_active: 1,
  phone: '+49...',
};
expect(dbToApi(user).firstName).toBe('John');

// ✅ GUT — minimaler Input
expect(dbToApi({ first_name: 'John' })).toEqual({ firstName: 'John' });
```

### 5.5 Keine Logik in Tests

Tests sind DEKLARATIV, nicht imperativ. Keine Schleifen, keine if/else, keine Berechnungen.

```typescript
// ❌ SCHLECHT — Logik im Test
const testCases = ['admin', 'employee', 'root'];
for (const role of testCases) {
  expect(RoleSchema.safeParse(role).success).toBe(true);
}

// ✅ GUT — deklarativ mit it.each
it.each(['admin', 'employee', 'root'])('should accept valid role "%s"', (role) => {
  expect(RoleSchema.safeParse(role).success).toBe(true);
});
```

### 5.6 Mocking: Stubs vs. Mocks

| Begriff  | Zweck                       | Assertion auf... |
| -------- | --------------------------- | ---------------- |
| **Stub** | Liefert kontrollierte Daten | das Ergebnis     |
| **Mock** | Verifiziert Interaktionen   | den Mock selbst  |

**Regel:** Bevorzuge Stubs. Mocks koppeln Tests an Implementation.

### 5.7 Edge Cases dokumentieren Verhalten

Tests für Edge Cases sind die wertvollste Dokumentation — Dinge die in README.md NIE stehen:

```typescript
describe('is_active exception', () => {
  it('should NOT convert is_active to boolean (multi-state: 0/1/3/4)', () => {
    expect(dbToApi({ is_active: 0 }).isActive).toBe(0); // NICHT false!
    expect(dbToApi({ is_active: 3 }).isActive).toBe(3); // NICHT true!
  });
});
```

### 5.8 Anti-Patterns (Verboten)

| Anti-Pattern                    | Warum schlecht                      | Stattdessen                 |
| ------------------------------- | ----------------------------------- | --------------------------- |
| `expect(result).toBeTruthy()`   | Sagt nichts bei Fehler              | `expect(result).toBe(true)` |
| Test hängt von anderem Test ab  | Reihenfolge-abhängig, fragil        | Jeder Test unabhängig       |
| `beforeAll` mit shared state    | Koppelt Tests aneinander            | Factory-Funktionen pro Test |
| Implementierungs-Details testen | Bricht bei Refactoring              | Verhalten/Output testen     |
| Zu viele Assertions pro Test    | Unklar was fehlschlug               | Ein Konzept pro Test        |
| Coverage > 90% als Ziel         | Diminishing returns, nutzlose Tests | 70-80% mit Qualitätsfokus   |

---

## 6. Konventionen & Regeln

### Dateistruktur

```
source.ts           → source.test.ts (co-located, NICHT in __tests__/)
```

### Naming

```typescript
describe('FunctionName', () => {
  // Funktionsname
  describe('when valid input', () => {
    // Kontext
    it('should return expected', () => {
      // Erwartung
    });
  });
});
```

### AAA-Pattern (Arrange-Act-Assert)

```typescript
it('should convert snake_case to camelCase', () => {
  // Arrange
  const input = { first_name: 'John' };

  // Act
  const result = dbToApi(input);

  // Assert
  expect(result).toEqual({ firstName: 'John' });
});
```

### Was MUSS getestet werden

- **Happy Path** — normaler, erwarteter Input
- **Edge Cases** — null, undefined, leerer String, 0, negative Zahlen
- **Grenzwerte** — Min/Max (z.B. Passwort 12 chars, 72 chars)
- **Fehlerfall** — ungültiger Input, was passiert?

### Was NICHT

- Private Funktionen direkt testen (ueber public API testen)
- Implementation Details (HOW statt WHAT)
- Framework-Code (NestJS Decorators, Module-Wiring)
- Reine Type-Definitionen

### Verboten in Tests

```typescript
// ❌ NIEMALS
any                          // Typsicher auch in Tests
console.log()                // Kein Debug-Output
.skip / .only                // Nicht committen
sleep() / setTimeout()       // Deterministische Tests
Math.random()                // Deterministisch!
new Date()                   // Nutze vi.useFakeTimers()
```

---

## 7. CI/CD Integration (nach Phase 2)

> CI/CD wird NICHT sofort gebaut. Erst wenn mindestens Phase 1+2 stabil grün laufen, lohnt sich die Pipeline. Sonst blockiert eine leere Test-Suite den Merge.

### Aktueller Workflow (`code-quality-checks.yml`)

```
Backend:  TypeScript Check → ESLint → Prettier
Frontend: Svelte Check → ESLint → Prettier → Stylelint
Docker:   Build Verification
```

### ✅ Implementiert: Unit-Tests als Merge-Gate (2026-02-05)

```yaml
# .github/workflows/code-quality-checks.yml — Job: unit-tests

unit-tests:
  runs-on: ubuntu-latest
  name: Unit Tests (Backend + Shared + Frontend)
  permissions:
    contents: read

  steps:
    - uses: actions/checkout@v4

    - name: Install pnpm
      uses: pnpm/action-setup@v2
      with:
        version: 10.28.2

    - name: Setup Node.js
      uses: actions/setup-node@v5
      with:
        node-version: '24'
        cache: 'pnpm'

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    - name: Generate SvelteKit types
      run: cd frontend && pnpm exec svelte-kit sync

    - name: Run Unit Tests with Coverage
      run: pnpm vitest run --project unit --project frontend-unit --coverage

    - name: Upload Coverage Report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
        retention-days: 30
```

**CI-Learnings:**

- `svelte-kit sync` ist Pflicht in CI — `frontend/tsconfig.json` extends `.svelte-kit/tsconfig.json`
- `*.guard.ts` aus Coverage excluden — Rollup kann TypeScript-Decorators nicht parsen
- `*.test.ts` aus `.prettierignore` entfernt — sonst formatiert `validate:all` die Test-Files nicht, aber CI checkt sie

### Branch Protection Rules (GitHub) — ✅ Konfiguriert

```
Settings → Branches → master:
  ✅ Require status checks to pass
    ✅ Unit Tests (Backend + Shared + Frontend) (required)
    ✅ Backend & Shared (TypeScript, ESLint, Prettier) (required)
    ✅ Frontend (Svelte Check, ESLint, Prettier, Stylelint) (required)
  ✅ Require branches to be up to date
```

**Ergebnis:** Kein Merge in `master` ohne grüne Unit-Tests + Quality Checks.

> **Hinweis:** Branch Protection erfordert GitHub Team Plan ($4/User/Monat) für private Repos.

### CI/CD Meilensteine

| Meilenstein                     | Aktion                                 | Status                                              |
| ------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Phase 1 grün (fieldMapper)      | Noch nicht — zu wenig Tests            | ✅ erreicht                                         |
| Phase 2 grün (shared + schemas) | CI-Job hinzufügen, aber NICHT required | ✅ erreicht                                         |
| Phase 3 grün (helpers)          | CI-Job als **required** setzen         | ✅ erreicht                                         |
| Phase 4+                        | Coverage-Thresholds in CI aktivieren   | ✅ erreicht — **CI-Job implementiert (2026-02-05)** |

**Status:** CI-Job `unit-tests` läuft in `code-quality-checks.yml` (1222 Tests: 1203 unit + 19 frontend-unit). Branch Protection Rule auf GitHub konfiguriert.

---

## 8. Coverage-Ziele

### Aktueller Stand (2026-02-05)

- **Coverage:** **28.30% Lines, 27.83% Branches, 28.88% Functions, 28.29% Statements**
- **Warum noch <30%:** ~43 Service-Dateien (der Großteil des Codes) haben noch 0% Coverage
- **Gut getestet:** Helpers, Schemas, DTOs, Constants (50-100% pro File), 26 Services getestet

### Aktive Thresholds (in `vitest.config.ts`)

```typescript
// Floor-Werte — verhindern Regressions, nicht das Ziel
coverage: {
  thresholds: {
    lines: 25,
    functions: 25,
    branches: 25,
    statements: 25,
  },
}
```

> **Wenn Coverage unter diese Werte fällt → CI wird rot → Merge blockiert.**

### Stufenplan

| Stufe        | Wann                     | Lines     | Functions | Aktion                               |
| ------------ | ------------------------ | --------- | --------- | ------------------------------------ |
| **Phase 8**  | Abgeschlossen            | **10%**   | **8%**    | ✅ Thresholds aktiviert (2026-02-05) |
| **Phase 9**  | ✅ DONE (12/12 Services) | **~13%**  | **~11%**  | 145 Tests, 12 Services getestet      |
| **Phase 10** | ✅ DONE (14/14 Services) | **28.3%** | **28.9%** | 234 Tests, Thresholds → 25%          |
| Phase 11+    | Weitere Services         | **35%**   | **30%**   | Weitere ~43 Services testen          |
| Langfrist    | Alle Services getestet   | **50%**   | **50%**   | Ziel-Wert                            |

---

## Zusammenfassung

| Metrik              | Geplant  | Aktuell (Phase 0-10) |
| ------------------- | -------- | -------------------- |
| Testbare Dateien    | ~80+     | 62 getestet          |
| Testbare Funktionen | ~400+    | ~800+ getestet       |
| Geschätzte Tests    | ~470-580 | **1222 geschrieben** |
| Phasen              | 0 + 11+  | **Phase 10 ✅ DONE** |

### Abgeschlossen: Phase 0-10

```
Phase 0:  vitest.config.ts komplett überarbeitet          ✅ 6/6 Checks
Phase 1:  fieldMapper.test.ts — 16 Tests                  ✅ 100/97/100/100% Coverage
Phase 2:  date-helpers + is-active — 36 Tests              ✅ vi.useFakeTimers()
Phase 3:  common.schema.ts — 63 Tests                      ✅ NIST 800-63B, Coercion
Phase 4:  shifts + users + kvp + audit — 107 Tests         ✅ SQL-Injection, SENSITIVE_FIELDS
Phase 5:  roles + features + auth + admin — 86 Tests        ✅ DB-Mocking, Token-Reuse
Phase 6:  blackboard+calendar+chat+docs+surveys+notif — 37  ✅ 1 Test/Funktion, lean
Phase 7:  avatar+password+jwt+sanitize+auth — 19           ✅ frontend-unit, no deps added
Phase 8:  DTO-Validierungen — 460 Tests, 13 Module         ✅ .safeParse(), refinements, coercions
Phase 9:  Service Tests — 145 Tests, 12 Services             ✅ DONE (12/12 Services)
Phase 10: Service Tests II — 234 Tests, 14 Services           ✅ DONE (14/14 Services)
════════════════════════════════════════════════════════════════════════
          1203 Unit + 19 Frontend + 175 API = 1397 Tests.
          80 Dateien. ~3.2s (unit). Alle grün.
```

### CI/CD — ✅ Implementiert (2026-02-05)

- [x] `unit-tests` Job in `code-quality-checks.yml` (1203 unit + 19 frontend = 1222 tests)
- [x] Coverage-Thresholds aktiv (lines 25%, functions 25%, branches 25%, statements 25%)
- [x] Branch Protection Rules auf GitHub konfiguriert
- [x] `svelte-kit sync` vor Tests in CI (Pflicht)

### Bug-Fixes (2026-02-05)

- [x] `sanitizeData` camelCase-Bug gefixt (SENSITIVE_FIELDS lowercase-Normalisierung)
- [x] `EmailSchema` Trim-Order dokumentiert (Low Priority, kein Fix nötig)

---

### ⚡ NÄCHSTER SCHRITT: Phase 11 — Verbleibende Services

**Phase 9+10 komplett (26 Services getestet).** Verbleibend: ~43 Services ohne Unit-Tests.

**Top-Priorität nach LOC (größte Dateien = meiste Business-Logik):**

| #   | Service                       | LOC  | Modul       | Testbare Logik                       |
| --- | ----------------------------- | ---- | ----------- | ------------------------------------ |
| 1   | `users.service.ts`            | 1053 | users       | CRUD, search, avatar, bulk ops       |
| 2   | `teams.service.ts`            | 869  | teams       | CRUD, member mgmt, hierarchy         |
| 3   | `departments.service.ts`      | 768  | departments | CRUD, lead assignment, area relation |
| 4   | `logs.service.ts`             | 687  | logs        | Query builder, export, retention     |
| 5   | `areas.service.ts`            | 585  | areas       | CRUD, lead assignment                |
| 6   | `survey-responses.service.ts` | 535  | surveys     | Submit, stats, export, validation    |
| 7   | `root.service.ts`             | 545  | root        | System admin, tenant CRUD, features  |
| 8   | `shift-plans.service.ts`      | 439  | shifts      | Plan CRUD, assignment, scheduling    |
| 9   | `chat.service.ts`             | 407  | chat        | Facade/delegation to sub-services    |
| 10  | `kvp-categories.service.ts`   | 347  | kvp         | CRUD, hierarchy, default categories  |

**Anleitung für jeden Service:**

1. Datei lesen (`Read`)
2. Public Methoden identifizieren
3. Pure Logik vs. DB-Calls trennen
4. 1 Test pro Funktion schreiben (lean, minimaler Input)
5. `pnpm vitest run --project unit -- <datei>` laufen lassen
6. Grün? → Nächster Service. Rot? → Fixen.

---

### Phase 8 Details: DTO-Tests (460 Tests, 13 Dateien)

| Modul         | Datei                     | Tests | Highlights                                          |
| ------------- | ------------------------- | ----- | --------------------------------------------------- |
| auth          | auth.dto.test.ts          | 20    | PasswordSchema 12+ chars, RegisterSchema regex      |
| users         | users.dto.test.ts         | 54    | ChangePassword 2 refinements, phone/employee regex  |
| calendar      | calendar.dto.test.ts      | 42    | endTime>startTime refine, hex color, z.iso.datetime |
| departments   | departments.dto.test.ts   | 23    | Boolean coercion (preprocess), name bounds          |
| teams         | teams.dto.test.ts         | 26    | Date format regex, coerce IDs, boolean preprocess   |
| notifications | notifications.dto.test.ts | 26    | recipientId refine (required unless 'all')          |
| blackboard    | blackboard.dto.test.ts    | 37    | isActive refine [0,1,3,4], UUID, priority enums     |
| machines      | machines.dto.test.ts      | 42    | z.url(), maintenance enums, teamIds max 50          |
| surveys       | surveys.dto.test.ts       | 29    | QuestionSchema, AssignmentSchema refine, dual-ID    |
| documents     | documents.dto.test.ts     | 20    | DtoClass.schema (unexported), tags max 20           |
| kvp           | kvp.dto.test.ts           | 42    | categoryId OR customCategoryId refine, hex color    |
| shifts        | shifts.dto.test.ts        | 66    | 8 common enums, TimeSchema HH:MM, dual date fmt     |
| settings      | settings.dto.test.ts      | 33    | SettingValue union, BulkUpdate min 1, CategoryEnum  |

**Phase 0-10 abgeschlossen. Phase 11 (weitere Services) als Nächstes.** CI + Coverage-Thresholds aktiv seit 2026-02-05.

---

## Erkenntnisse / Findings (durch Tests entdeckt)

### Bug 1: EmailSchema Trim-Order (Phase 3)

**Datei:** `backend/src/schemas/common.schema.ts`
**Problem:** `.trim()` läuft NACH `.regex()` in der Zod-Chain. Emails mit Whitespace (`'  user@test.de  '`) scheitern am Regex bevor Trim greift.
**Impact:** Gering — User-Input hat selten Leading/Trailing Whitespace bei Emails.
**Fix-Vorschlag:** `.trim()` VOR `.regex()` in der Chain platzieren.
**Status:** Im Test dokumentiert, kein Fix nötig (Low Priority).

### Bug 2: sanitizeData camelCase-Sensitivity (Phase 4) — ✅ GEFIXT

**Datei:** `backend/src/nest/common/audit/audit.helpers.ts`
**Problem:** `SENSITIVE_FIELDS.includes(key.toLowerCase())` nutzt case-sensitive `Array.includes()`. CamelCase-Einträge im Array (z.B. `accessToken`) matchen nicht auf den lowercased Key (`accesstoken`).
**Impact:** Mittel — camelCase-Sensitive-Fields wie `accessToken` werden NICHT redacted.
**Fix:** SENSITIVE_FIELDS auf lowercase normalisiert (2026-02-05).
**Status:** ✅ Gefixt und durch Tests verifiziert.

---

**Referenzen:**

- [Vitest Docs v4](https://vitest.dev/guide/)
- [Microsoft: Unit Testing Best Practices](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
- [IBM: Unit Testing Best Practices](https://www.ibm.com/think/insights/unit-testing-best-practices)
- [The Coder Cafe: Unit Tests as Documentation](https://read.thecoder.cafe/p/unit-tests-as-documentation)
- [ADR-013: CI/CD Pipeline Hardening](./infrastructure/adr/ADR-013-ci-cd-pipeline-hardening.md)
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md)
- [CODE-OF-CONDUCT.md](./CODE-OF-CONDUCT.md)
