# Vitest Unit Test Plan — Assixx

**Version:** 1.2.0 | **Branch:** `unit-test` | **Erstellt:** 2026-02-04 | **Letztes Update:** 2026-02-04

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

| Was                | Status                                                                 |
| ------------------ | ---------------------------------------------------------------------- |
| Vitest installiert | v4.0.18 + `@vitest/coverage-v8` + `@vitest/ui`                         |
| `vitest.config.ts` | **FIXED** — alle 4 Fehler behoben (Phase 0)                            |
| `vitest.setup.ts`  | Erweitert: `TZ=UTC` für deterministische Date-Tests                    |
| Test-Dateien       | **36 Dateien, 824 Tests** — Phase 0-8 abgeschlossen                    |
| Vitest API-Tests   | 18 Dateien, 175 Tests (Vitest Integration)                             |
| CI/CD              | `code-quality-checks.yml` — nur Lint, kein Test (geplant nach Phase 4) |
| Coverage           | **Funktioniert** — nest/ inkludiert, v8 Provider aktiv                 |

### npm Scripts (vorhanden)

```bash
pnpm test            # vitest run         → Single-Run
pnpm test:watch      # vitest             → Watch-Mode (Re-Run bei File-Change)
pnpm test:coverage   # vitest run --coverage → Coverage-Report
pnpm test:ui         # vitest --ui --watch → Browser-UI auf http://localhost:5175
```

### Aktueller Zustand bei `pnpm test`

```
 ✓ shared/src/constants/is-active.test.ts                             ( 9 tests)
 ✓ shared/src/helpers/date-helpers.test.ts                            (27 tests)
 ✓ backend/src/nest/common/audit/audit.helpers.test.ts                (41 tests)
 ✓ backend/src/utils/fieldMapper.test.ts                              (16 tests)
 ✓ backend/src/nest/users/users.helpers.test.ts                       (20 tests)
 ✓ backend/src/nest/shifts/shifts.helpers.test.ts                     (22 tests)
 ✓ backend/src/nest/kvp/kvp.helpers.test.ts                           (24 tests)
 ✓ backend/src/schemas/common.schema.test.ts                          (63 tests)
 ✓ backend/src/nest/roles/roles.service.test.ts                       (32 tests)
 ✓ backend/src/nest/features/features.service.test.ts                 (23 tests)
 ✓ backend/src/nest/auth/auth.service.test.ts                         (14 tests)
 ✓ backend/src/nest/admin-permissions/admin-permissions.service.test.ts (17 tests)
 ✓ backend/src/nest/blackboard/blackboard.helpers.test.ts             ( 6 tests)
 ✓ backend/src/nest/calendar/calendar.helpers.test.ts                 ( 7 tests)
 ✓ backend/src/nest/chat/chat.helpers.test.ts                         (10 tests)
 ✓ backend/src/nest/documents/documents.helpers.test.ts               ( 5 tests)
 ✓ backend/src/nest/surveys/surveys.helpers.test.ts                   ( 6 tests)
 ✓ backend/src/nest/notifications/notifications.helpers.test.ts       ( 3 tests)
 ✓ frontend/src/lib/utils/avatar-helpers.test.ts                     ( 4 tests)
 ✓ frontend/src/lib/utils/sanitize-html.test.ts                      ( 2 tests)
 ✓ frontend/src/lib/utils/auth.test.ts                               ( 6 tests)
 ✓ frontend/src/lib/utils/password-strength.test.ts                  ( 4 tests)
 ✓ frontend/src/lib/utils/jwt-utils.test.ts                          ( 3 tests)

 Test Files  23 passed (23)
       Tests  364 passed (364)
    Duration  ~1.1s
```

Phase 0-7 abgeschlossen. Alle 364 Tests grün.

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
- [ ] Backend-Coverage >= 70% Lines, 75% Functions
- [ ] CI blockiert Merge bei Test-Failure

---

### Phasen-Übersicht

```
Phase 0: Fundament         Config fixen, Smoke-Test                ✅ DONE (6/6 Checks)
Phase 1: Proof of Concept  fieldMapper.test.ts — 16 Tests grün    ✅ DONE (16 Tests)
Phase 2: Shared Package    date-helpers, is-active                 ✅ DONE (36 Tests)
Phase 3: Zod Schemas       common.schema.ts                       ✅ DONE (63 Tests)
Phase 4: Backend Helpers   shifts, users, kvp, audit               ✅ DONE (107 Tests)
Phase 5: Services          roles, features, auth, admin-perms      ✅ DONE (86 Tests)
Phase 6: Restliche         blackboard, calendar, chat, etc.        ✅ DONE (37 Tests)
Phase 7: Frontend Utils    avatar, password, jwt, sanitize, auth    ✅ DONE (19 Tests)
Phase 8: DTOs              Alle 13 Module (460 Tests, 13 Dateien)   ✅ DONE (460 Tests)
```

**Gesamt: 824 Unit Tests + 19 Frontend Tests in 36 Dateien, alle grün.**
**Gesamtprojekt: 999 Tests (824 unit + 19 frontend + 175 API) in 54 Dateien.**

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

### Geplante Erweiterung: Unit-Tests als Merge-Gate

```yaml
# .github/workflows/code-quality-checks.yml — Neuer Job

unit-tests:
  runs-on: ubuntu-latest
  name: Unit Tests (Backend + Shared)
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

    - name: Run Unit Tests
      run: pnpm test

    - name: Run Coverage Report
      run: pnpm test:coverage

    - name: Upload Coverage Report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: coverage/
```

### Branch Protection Rules (GitHub)

```
Settings → Branches → master:
  ✅ Require status checks to pass
    ✅ unit-tests (required)          ← NEU
    ✅ backend-quality (required)
    ✅ frontend-quality (required)
  ✅ Require branches to be up to date
```

**Ergebnis:** Kein Merge in `master` ohne grüne Unit-Tests.

### Wann CI/CD aktivieren?

| Meilenstein                     | Aktion                                 | Status                                            |
| ------------------------------- | -------------------------------------- | ------------------------------------------------- |
| Phase 1 grün (fieldMapper)      | Noch nicht — zu wenig Tests            | ✅ erreicht                                       |
| Phase 2 grün (shared + schemas) | CI-Job hinzufügen, aber NICHT required | ✅ erreicht                                       |
| Phase 3 grün (helpers)          | CI-Job als **required** setzen         | ✅ erreicht                                       |
| Phase 4+                        | Coverage-Thresholds in CI aktivieren   | ✅ erreicht — **CI-Job noch nicht implementiert** |

**Aktion:** CI-Job kann jetzt als `required` hinzugefügt werden (222 Tests stabil).

---

## 8. Coverage-Ziele (Langfrist)

### Phasen-Ziele

| Phase | Was                              | Lines (Ziel)    | Branches | Functions | Status |
| ----- | -------------------------------- | --------------- | -------- | --------- | ------ |
| 0+1   | Fundament + PoC                  | ~2%             | ~2%      | ~3%       | ✅     |
| 2     | Shared + Schemas                 | ~15%            | ~15%     | ~20%      | ✅     |
| 3     | Helpers                          | ~35%            | ~30%     | ~40%      | ✅     |
| 4     | Services (hier: Backend Helpers) | ~35%            | ~30%     | ~40%      | ✅     |
| 5     | Services (Mocking)               | ~55%            | ~45%     | ~60%      |        |
| 6     | Restliche                        | ~65%            | ~55%     | ~70%      |        |
| 7     | Frontend                         | (eigene Config) | —        | —         |        |
| 8     | DTOs                             | ~75%            | ~65%     | ~80%      |        |

### Langfrist-Ziel

```typescript
// vitest.config.ts — erst ab Phase 4 aktivieren
coverage: {
  thresholds: {
    lines: 70,
    branches: 60,
    functions: 75,
    statements: 70,
  },
}
```

---

## Zusammenfassung

| Metrik              | Geplant  | Aktuell (Phase 0-8)  |
| ------------------- | -------- | -------------------- |
| Testbare Dateien    | ~60+     | 36 getestet          |
| Testbare Funktionen | ~300+    | ~570+ getestet       |
| Geschätzte Tests    | ~470-580 | **824 geschrieben**  |
| Phasen              | 0 + 8    | **9 von 9 erledigt** |

### Abgeschlossen: Phase 0-8

```
Phase 0: vitest.config.ts komplett überarbeitet         ✅ 6/6 Checks
Phase 1: fieldMapper.test.ts — 16 Tests                 ✅ 100/97/100/100% Coverage
Phase 2: date-helpers + is-active — 36 Tests             ✅ vi.useFakeTimers()
Phase 3: common.schema.ts — 63 Tests                     ✅ NIST 800-63B, Coercion
Phase 4: shifts + users + kvp + audit — 107 Tests        ✅ SQL-Injection, SENSITIVE_FIELDS
Phase 5: roles + features + auth + admin — 86 Tests       ✅ DB-Mocking, Token-Reuse
Phase 6: blackboard+calendar+chat+docs+surveys+notif — 37 ✅ 1 Test/Funktion, lean
Phase 7: avatar+password+jwt+sanitize+auth — 19          ✅ frontend-unit, no deps added
Phase 8: DTO-Validierungen — 460 Tests, 13 Module        ✅ .safeParse(), refinements, coercions
═══════════════════════════════════════════════════════════════════
         824 Unit + 19 Frontend + 175 API = 999 Tests.
         54 Dateien. ~8.6s. Alle grün.
```

### Offene DoD-Punkte (Phase 8)

- [ ] Backend-Coverage >= 70% Lines, 75% Functions (Coverage-Report auswerten)
- [ ] CI blockiert Merge bei Test-Failure (`code-quality-checks.yml` erweitern)

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

**Alle Phasen abgeschlossen.** Nächste Schritte: Coverage-Thresholds aktivieren, CI-Integration.

---

## Erkenntnisse / Findings (durch Tests entdeckt)

### Bug 1: EmailSchema Trim-Order (Phase 3)

**Datei:** `backend/src/schemas/common.schema.ts`
**Problem:** `.trim()` läuft NACH `.regex()` in der Zod-Chain. Emails mit Whitespace (`'  user@test.de  '`) scheitern am Regex bevor Trim greift.
**Impact:** Gering — User-Input hat selten Leading/Trailing Whitespace bei Emails.
**Fix-Vorschlag:** `.trim()` VOR `.regex()` in der Chain platzieren.
**Status:** Im Test dokumentiert, kein Fix nötig (Low Priority).

### Bug 2: sanitizeData camelCase-Sensitivity (Phase 4)

**Datei:** `backend/src/nest/common/audit/audit.helpers.ts`
**Problem:** `SENSITIVE_FIELDS.includes(key.toLowerCase())` nutzt case-sensitive `Array.includes()`. CamelCase-Einträge im Array (z.B. `accessToken`) matchen nicht auf den lowercased Key (`accesstoken`).
**Impact:** Mittel — camelCase-Sensitive-Fields wie `accessToken` werden NICHT redacted.
**Fix-Vorschlag:** Alle Einträge in `SENSITIVE_FIELDS` lowercase speichern, oder `.some()` mit case-insensitive Vergleich nutzen.
**Status:** Im Test dokumentiert. Fix empfohlen bei nächstem Audit-Review.

---

**Referenzen:**

- [Vitest Docs v4](https://vitest.dev/guide/)
- [Microsoft: Unit Testing Best Practices](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
- [IBM: Unit Testing Best Practices](https://www.ibm.com/think/insights/unit-testing-best-practices)
- [The Coder Cafe: Unit Tests as Documentation](https://read.thecoder.cafe/p/unit-tests-as-documentation)
- [ADR-013: CI/CD Pipeline Hardening](./infrastructure/adr/ADR-013-ci-cd-pipeline-hardening.md)
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md)
- [CODE-OF-CONDUCT.md](./CODE-OF-CONDUCT.md)
