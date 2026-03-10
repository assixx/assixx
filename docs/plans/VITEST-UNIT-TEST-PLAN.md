# Vitest Unit Test Plan — Assixx

**Version:** 1.7.0 | **Branch:** `unit-test` | **Erstellt:** 2026-02-04 | **Letztes Update:** 2026-02-06

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

| Was                | Status                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Vitest installiert | v4.0.18 + `@vitest/coverage-v8` + `@vitest/ui`                               |
| `vitest.config.ts` | **FIXED** — alle 4 Fehler behoben (Phase 0)                                  |
| `vitest.setup.ts`  | Erweitert: `TZ=UTC` für deterministische Date-Tests                          |
| Test-Dateien       | **141 Dateien, 3059 Unit + 19 Frontend = 3078 Tests** — Phase 14 ✅ COMPLETE |
| Vitest API-Tests   | 18 Dateien, 175 Tests (Vitest Integration)                                   |
| CI/CD              | `code-quality-checks.yml` — Unit-Tests als Merge-Gate ✅ (2026-02-05)        |
| Coverage           | **76% Lines, 71.55% Branches, 74.97% Functions, 75.90% Stmts** — v8 Provider |

### npm Scripts (vorhanden)

```bash
pnpm test            # vitest run         → Single-Run
pnpm test:watch      # vitest             → Watch-Mode (Re-Run bei File-Change)
pnpm test:coverage   # vitest run --coverage → Coverage-Report
pnpm test:ui         # vitest --ui --watch → Browser-UI auf http://localhost:5175
```

### Aktueller Zustand bei `pnpm test --project unit --project frontend-unit`

```
 === SHARED (Phase 2) ===
 ✓  unit  shared/src/constants/is-active.test.ts                                     ( 9 tests)
 ✓  unit  shared/src/helpers/date-helpers.test.ts                                    (27 tests)

 === UTILS & SCHEMAS (Phase 1, 3) ===
 ✓  unit  backend/src/utils/fieldMapper.test.ts                                      (16 tests)
 ✓  unit  backend/src/schemas/common.schema.test.ts                                  (63 tests)

 === HELPERS (Phase 4, 6) ===
 ✓  unit  backend/src/nest/common/audit/audit.helpers.test.ts                        (41 tests)
 ✓  unit  backend/src/nest/users/users.helpers.test.ts                               (27 tests)
 ✓  unit  backend/src/nest/shifts/shifts.helpers.test.ts                             (22 tests)
 ✓  unit  backend/src/nest/kvp/kvp.helpers.test.ts                                   (24 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard.helpers.test.ts                     ( 6 tests)
 ✓  unit  backend/src/nest/calendar/calendar.helpers.test.ts                         ( 7 tests)
 ✓  unit  backend/src/nest/chat/chat.helpers.test.ts                                 (10 tests)
 ✓  unit  backend/src/nest/documents/documents.helpers.test.ts                       ( 5 tests)
 ✓  unit  backend/src/nest/surveys/surveys.helpers.test.ts                           ( 6 tests)
 ✓  unit  backend/src/nest/notifications/notifications.helpers.test.ts               ( 3 tests)

 === DTOs (Phase 8) ===
 ✓  unit  backend/src/nest/auth/dto/auth.dto.test.ts                                 (20 tests)
 ✓  unit  backend/src/nest/users/dto/users.dto.test.ts                               (54 tests)
 ✓  unit  backend/src/nest/calendar/dto/calendar.dto.test.ts                         (42 tests)
 ✓  unit  backend/src/nest/departments/dto/departments.dto.test.ts                   (23 tests)
 ✓  unit  backend/src/nest/teams/dto/teams.dto.test.ts                               (26 tests)
 ✓  unit  backend/src/nest/notifications/dto/notifications.dto.test.ts               (26 tests)
 ✓  unit  backend/src/nest/blackboard/dto/blackboard.dto.test.ts                     (37 tests)
 ✓  unit  backend/src/nest/machines/dto/machines.dto.test.ts                         (42 tests)
 ✓  unit  backend/src/nest/surveys/dto/surveys.dto.test.ts                           (29 tests)
 ✓  unit  backend/src/nest/documents/dto/documents.dto.test.ts                       (20 tests)
 ✓  unit  backend/src/nest/kvp/dto/kvp.dto.test.ts                                  (42 tests)
 ✓  unit  backend/src/nest/shifts/dto/shifts.dto.test.ts                             (66 tests)
 ✓  unit  backend/src/nest/settings/dto/settings.dto.test.ts                         (33 tests)

 === SERVICES Phase 5 ===
 ✓  unit  backend/src/nest/roles/roles.service.test.ts                               (32 tests)
 ✓  unit  backend/src/nest/features/features.service.test.ts                         (23 tests)
 ✓  unit  backend/src/nest/auth/auth.service.test.ts                                 (14 tests)
 ✓  unit  backend/src/nest/admin-permissions/admin-permissions.service.test.ts        (17 tests)

 === SERVICES Phase 9 ===
 ✓  unit  backend/src/nest/logs/log-formatters.service.test.ts                       (28 tests)
 ✓  unit  backend/src/nest/config/config.service.test.ts                             (14 tests)
 ✓  unit  backend/src/nest/common/audit/audit-metadata.service.test.ts               ( 8 tests)
 ✓  unit  backend/src/nest/common/audit/audit-logging.service.test.ts                ( 5 tests)
 ✓  unit  backend/src/nest/logs/log-retention.service.test.ts                        ( 8 tests)
 ✓  unit  backend/src/nest/machines/asset-team.service.test.ts                     ( 5 tests)
 ✓  unit  backend/src/nest/shifts/rotation-generator.service.test.ts                 ( 6 tests)
 ✓  unit  backend/src/nest/audit-trail/audit-trail.service.test.ts                   (30 tests)
 ✓  unit  backend/src/nest/shifts/rotation-pattern.service.test.ts                   (17 tests)
 ✓  unit  backend/src/nest/kvp/kvp.service.test.ts                                   (50 tests)
 ✓  unit  backend/src/nest/documents/documents.service.test.ts                       (19 tests)
 ✓  unit  backend/src/nest/surveys/surveys.service.test.ts                           (64 tests)

 === SERVICES Phase 10 ===
 ✓  unit  backend/src/nest/reports/reports.service.test.ts                           (16 tests)
 ✓  unit  backend/src/nest/settings/settings.service.test.ts                         (38 tests)
 ✓  unit  backend/src/nest/plans/plans.service.test.ts                               (12 tests)
 ✓  unit  backend/src/nest/shifts/shifts.service.test.ts                             (47 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-entries.service.test.ts             (68 tests)
 ✓  unit  backend/src/nest/users/user-availability.service.test.ts                   (24 tests)
 ✓  unit  backend/src/nest/notifications/notifications.service.test.ts               (14 tests)
 ✓  unit  backend/src/nest/calendar/calendar.service.test.ts                         (18 tests)
 ✓  unit  backend/src/nest/chat/chat-conversations.service.test.ts                   (12 tests)
 ✓  unit  backend/src/nest/surveys/survey-access.service.test.ts                     (17 tests)
 ✓  unit  backend/src/nest/machines/machines.service.test.ts                         (12 tests)
 ✓  unit  backend/src/nest/signup/signup.service.test.ts                             (20 tests)
 ✓  unit  backend/src/nest/chat/chat-messages.service.test.ts                        (13 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard.service.test.ts                     (10 tests)

 === SERVICES Phase 11 (47 new files) ===
 ✓  unit  backend/src/nest/users/users.service.test.ts                               (21 tests)
 ✓  unit  backend/src/nest/teams/teams.service.test.ts                               (22 tests)
 ✓  unit  backend/src/nest/departments/departments.service.test.ts                   (13 tests)
 ✓  unit  backend/src/nest/logs/logs.service.test.ts                                 (10 tests)
 ✓  unit  backend/src/nest/areas/areas.service.test.ts                               (11 tests)
 ✓  unit  backend/src/nest/surveys/survey-responses.service.test.ts                  (16 tests)
 ✓  unit  backend/src/nest/root/root.service.test.ts                                 (14 tests)
 ✓  unit  backend/src/nest/shifts/shift-plans.service.test.ts                        (12 tests)
 ✓  unit  backend/src/nest/chat/chat.service.test.ts                                 (13 tests)
 ✓  unit  backend/src/nest/kvp/kvp-categories.service.test.ts                        (13 tests)
 ✓  unit  backend/src/nest/role-switch/role-switch.service.test.ts                   (10 tests)
 ✓  unit  backend/src/nest/shifts/rotation.service.test.ts                           (10 tests)
 ✓  unit  backend/src/nest/shifts/rotation-history.service.test.ts                   ( 8 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-confirmations.service.test.ts       ( 9 tests)
 ✓  unit  backend/src/nest/machines/asset-maintenance.service.test.ts              ( 7 tests)
 ✓  unit  backend/src/nest/dashboard/dashboard.service.test.ts                       ( 4 tests)
 ✓  unit  backend/src/nest/root/root-deletion.service.test.ts                        (14 tests)
 ✓  unit  backend/src/nest/root/root-admin.service.test.ts                           (10 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-access.service.test.ts              (15 tests)
 ✓  unit  backend/src/nest/logs/unified-logs.service.test.ts                         ( 7 tests)
 ✓  unit  backend/src/nest/surveys/survey-statistics.service.test.ts                 ( 6 tests)
 ✓  unit  backend/src/nest/calendar/calendar-overview.service.test.ts                ( 7 tests)
 ✓  unit  backend/src/nest/chat/scheduled-message-processor.service.test.ts          ( 5 tests)
 ✓  unit  backend/src/nest/logs/partition-manager.service.test.ts                    ( 7 tests)
 ✓  unit  backend/src/nest/chat/chat-scheduled.service.test.ts                       (13 tests)
 ✓  unit  backend/src/nest/notifications/notification-statistics.service.test.ts     ( 4 tests)
 ✓  unit  backend/src/nest/calendar/calendar-creation.service.test.ts                (12 tests)
 ✓  unit  backend/src/nest/documents/document-access.service.test.ts                 (15 tests)
 ✓  unit  backend/src/nest/shifts/rotation-assignment.service.test.ts                (11 tests)
 ✓  unit  backend/src/nest/calendar/calendar-permission.service.test.ts              (14 tests)
 ✓  unit  backend/src/nest/auth/connection-ticket.service.test.ts                    ( 9 tests)
 ✓  unit  backend/src/nest/surveys/survey-questions.service.test.ts                  ( 8 tests)
 ✓  unit  backend/src/nest/common/services/activity-logger.service.test.ts           ( 7 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-attachments.service.test.ts         ( 6 tests)
 ✓  unit  backend/src/nest/root/root-tenant.service.test.ts                          ( 5 tests)
 ✓  unit  backend/src/nest/kvp/kvp-confirmations.service.test.ts                     ( 6 tests)
 ✓  unit  backend/src/nest/notifications/notification-feature.service.test.ts        ( 4 tests)
 ✓  unit  backend/src/nest/kvp/kvp-attachments.service.test.ts                       ( 6 tests)
 ✓  unit  backend/src/nest/notifications/notification-preferences.service.test.ts    ( 6 tests)
 ✓  unit  backend/src/nest/common/audit/audit-request-filter.service.test.ts         (12 tests)
 ✓  unit  backend/src/nest/shifts/shift-swap.service.test.ts                         ( 6 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-archive.service.test.ts             ( 6 tests)
 ✓  unit  backend/src/nest/blackboard/blackboard-comments.service.test.ts            ( 6 tests)
 ✓  unit  backend/src/nest/kvp/kvp-comments.service.test.ts                          ( 7 tests)
 ✓  unit  backend/src/nest/documents/document-storage.service.test.ts                ( 9 tests)
 ✓  unit  backend/src/nest/feature-visits/feature-visits.service.test.ts             ( 5 tests)
 ✓  unit  backend/src/nest/documents/document-notification.service.test.ts           (11 tests)

 === PHASE 13 — Batch E: Shared Package ===
 ✓  unit  shared/src/constants/availability.test.ts                                 ( 9 tests)  [Phase 13E]
 ✓  unit  shared/src/constants/roles.test.ts                                        ( 6 tests)  [Phase 13E]

 === PHASE 13 — Batch B: Helpers/Utils/Constants (11 files, 247 tests) ===
 ✓  unit  backend/src/nest/machines/machines.helpers.test.ts                        (70 tests)  [Phase 13B]
 ✓  unit  backend/src/nest/common/audit/audit.constants.test.ts                    (42 tests)  [Phase 13B]
 ✓  unit  backend/src/nest/root/root.helpers.test.ts                               (38 tests)  [Phase 13B]
 ✓  unit  backend/src/utils/featureCheck.test.ts                                   (16 tests)  [Phase 13B]
 ✓  unit  backend/src/utils/pathSecurity.test.ts                                   (22 tests)  [Phase 13B]
 ✓  unit  backend/src/utils/eventBus.test.ts                                       (14 tests)  [Phase 13B]
 ✓  unit  backend/src/nest/calendar/calendar-export.utils.test.ts                  (18 tests)  [Phase 13B]
 ✓  unit  backend/src/utils/employeeIdGenerator.test.ts                            ( 9 tests)  [Phase 13B]
 ✓  unit  backend/src/utils/dbWrapper.test.ts                                      ( 8 tests)  [Phase 13B]

 === PHASE 13 — Batch A: Untested DTOs (13 modules, 359 tests) ===
 ✓  unit  backend/src/nest/chat/dto/chat.dto.test.ts                               (58 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/logs/dto/logs.dto.test.ts                               (32 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/audit-trail/dto/audit-trail.dto.test.ts                 (34 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/root/dto/root.dto.test.ts                               (56 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/areas/dto/areas.dto.test.ts                             (28 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/signup/dto/signup.dto.test.ts                           (24 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/admin-permissions/dto/admin-permissions.dto.test.ts     (30 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/reports/dto/reports.dto.test.ts                         (22 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/features/dto/features.dto.test.ts                       (14 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/dashboard/dto/dashboard.dto.test.ts                     (11 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/roles/dto/roles.dto.test.ts                             (13 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/plans/dto/plans.dto.test.ts                             (14 tests)  [Phase 13A]
 ✓  unit  backend/src/nest/feature-visits/dto/feature-visits.dto.test.ts           (11 tests)  [Phase 13A]

 === PHASE 13 — Batch D: Helper-Deepening (4 files, +85 new tests) ===
 ✓  unit  backend/src/nest/documents/documents.helpers.test.ts                     (28 tests)  [deepened 5→28]
 ✓  unit  backend/src/nest/calendar/calendar.helpers.test.ts                       (30 tests)  [deepened 7→30]
 ✓  unit  backend/src/nest/chat/chat.helpers.test.ts                               (38 tests)  [deepened 10→38]
 ✓  unit  backend/src/nest/notifications/notifications.helpers.test.ts             (14 tests)  [deepened 3→14]

 === PHASE 13 — Batch C: Legacy Services → NestJS (8/8 done, 170 tests, MIGRATED to nest/) ===
 ✓  unit  backend/src/nest/tenant-deletion/tenant-deletion.helpers.test.ts         (13 tests)  [Phase 13C → migrated]
 ✓  unit  backend/src/nest/database/database.service.test.ts                       (25 tests)  [Phase 13C]
 ✓  unit  backend/src/nest/hierarchy-permission/hierarchy-permission.service.test.ts (22 tests) [Phase 13C → migrated]
 ✓  unit  backend/src/nest/tenant-deletion/tenant-deletion.service.test.ts         (32 tests)  [Phase 13C → migrated]
 ✓  unit  backend/src/nest/tenant-deletion/tenant-deletion-executor.service.test.ts (21 tests) [Phase 13C → migrated]
 ✓  unit  backend/src/nest/tenant-deletion/tenant-deletion-exporter.service.test.ts (24 tests) [Phase 13C → migrated]
 ✓  unit  backend/src/nest/tenant-deletion/tenant-deletion-analyzer.service.test.ts (18 tests) [Phase 13C → migrated]
 ✓  unit  backend/src/nest/tenant-deletion/tenant-deletion-audit.service.test.ts   (17 tests)  [Phase 13C → migrated]

 === FRONTEND (Phase 7) ===
 ✓  frontend-unit  frontend/src/lib/utils/avatar-helpers.test.ts                     ( 4 tests)
 ✓  frontend-unit  frontend/src/lib/utils/sanitize-html.test.ts                      ( 2 tests)
 ✓  frontend-unit  frontend/src/lib/utils/auth.test.ts                               ( 6 tests)
 ✓  frontend-unit  frontend/src/lib/utils/password-strength.test.ts                  ( 4 tests)
 ✓  frontend-unit  frontend/src/lib/utils/jwt-utils.test.ts                          ( 3 tests)

 Test Files  142 passed (142)  [unit]  |  5 passed (5) [frontend-unit]
       Tests  2715 passed (2715) [unit]  |  19 passed (19) [frontend-unit]
    Duration  ~7.9s (unit)
```

Phase 0-13 COMPLETE. All batches (A, B, C, D, E) done.
2715 Unit + 19 Frontend = 2734 Tests grün. Coverage: 68.77% Lines, 63.37% Branches, 68.97% Functions, 68.72% Stmts.

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

- `frontend/test/mocks/app-environment.ts` — Mock für `$app/environment` (browser=false)
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

| #   | Service                         | Lines | Tests | Typ                                       | Status |
| --- | ------------------------------- | ----- | ----- | ----------------------------------------- | ------ |
| 1   | `log-formatters.service.ts`     | 265   | 28    | Pure Logik (TXT/CSV/JSON Formatter)       | ✅     |
| 2   | `config.service.ts`             | 220   | 14    | Zod Validation, computed Getters          | ✅     |
| 3   | `audit-metadata.service.ts`     | 108   | 8     | Request-Metadata, fire-and-forget         | ✅     |
| 4   | `audit-logging.service.ts`      | 199   | 5     | Fire-and-forget, error extraction         | ✅     |
| 5   | `log-retention.service.ts`      | 363   | 8     | Retention days validation, min enforce    | ✅     |
| 6   | `asset-team.service.ts`         | 118   | 5     | Row mapper, team validation               | ✅     |
| 7   | `rotation-generator.service.ts` | 621   | 6     | Schichttyp-Algorithmus, Weekend-Skip      | ✅     |
| 8   | `audit-trail.service.ts`        | 824   | 30    | CSV, row mapper, access control, stats    | ✅     |
| 9   | `rotation-pattern.service.ts`   | 332   | 17    | Config parsing, date fmt, UUID, CRUD      | ✅     |
| 10  | `kvp.service.ts`                | 915   | 50    | Dashboard, permissions, visibility (P12)  | ✅     |
| 11  | `documents.service.ts`          | 844   | 19    | Access ctrl, stats, scope filter, UUID    | ✅     |
| 12  | `surveys.service.ts`            | 774   | 64    | parseIdParam, UUID, templates, CRUD (P12) | ✅     |

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
| 4   | `shifts.service.ts`             | 725   | 47    | DB-mocked, schedule logic (Phase 12)  | ✅     |
| 5   | `blackboard-entries.service.ts` | 548   | 68    | DB-mocked, archive, access ctrl (P12) | ✅     |
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
- [x] Coverage-Thresholds erhöht: 25% (Lines, Functions, Branches, Statements)

---

### Phase 11: Backend Service Tests — All Remaining Services (Coverage Push)

> **Ziel:** ALLE verbleibenden untesteten Services systematisch abarbeiten. Coverage von ~28% auf ~53% heben. Jeder Service im Projekt hat mindestens 1 Testdatei.

**Strategie:** Batch-weise (4 Services pro Batch), nach LOC sortiert (größte zuerst). Jeder Batch: Lesen → Schreiben → Verifizieren → Nächster Batch. 12 Batches insgesamt.

| #   | Service                                  | Tests | Typ                                    | Status |
| --- | ---------------------------------------- | ----- | -------------------------------------- | ------ |
| 1   | `users.service.ts`                       | 21    | DB-mocked, CRUD, avatar, search        | ✅     |
| 2   | `teams.service.ts`                       | 22    | DB-mocked, member mgmt, hierarchy      | ✅     |
| 3   | `departments.service.ts`                 | 13    | DB-mocked, lead assignment             | ✅     |
| 4   | `logs.service.ts`                        | 10    | DB-mocked, query builder, export       | ✅     |
| 5   | `areas.service.ts`                       | 11    | DB-mocked, CRUD, lead assignment       | ✅     |
| 6   | `survey-responses.service.ts`            | 16    | DB-mocked, submit, stats, validation   | ✅     |
| 7   | `root.service.ts`                        | 14    | DB-mocked, tenant CRUD, features       | ✅     |
| 8   | `shift-plans.service.ts`                 | 12    | DB-mocked, plan CRUD, assignment       | ✅     |
| 9   | `chat.service.ts`                        | 13    | Facade/delegation to sub-services      | ✅     |
| 10  | `kvp-categories.service.ts`              | 13    | DB-mocked, hierarchy, defaults         | ✅     |
| 11  | `role-switch.service.ts`                 | 10    | DB-mocked, role validation             | ✅     |
| 12  | `rotation.service.ts`                    | 10    | DB-mocked, rotation CRUD               | ✅     |
| 13  | `rotation-history.service.ts`            | 8     | DB-mocked, history CRUD                | ✅     |
| 14  | `blackboard-confirmations.service.ts`    | 9     | DB-mocked, UUID resolution             | ✅     |
| 15  | `asset-maintenance.service.ts`           | 7     | DB-mocked, maintenance CRUD            | ✅     |
| 16  | `dashboard.service.ts`                   | 4     | DB-mocked, aggregate queries           | ✅     |
| 17  | `root-deletion.service.ts`               | 14    | DB-mocked, cascading deletion          | ✅     |
| 18  | `root-admin.service.ts`                  | 10    | DB-mocked, admin CRUD                  | ✅     |
| 19  | `blackboard-access.service.ts`           | 15    | DB-mocked, access control, visibility  | ✅     |
| 20  | `unified-logs.service.ts`                | 7     | Pool-mocked, partition queries         | ✅     |
| 21  | `survey-statistics.service.ts`           | 6     | DB-mocked, stats aggregation           | ✅     |
| 22  | `calendar-overview.service.ts`           | 7     | DB-mocked, dashboard events            | ✅     |
| 23  | `scheduled-message-processor.service.ts` | 5     | DB-mocked, cron, concurrency guard     | ✅     |
| 24  | `partition-manager.service.ts`           | 7     | Pool-mocked, partition management      | ✅     |
| 25  | `chat-scheduled.service.ts`              | 13    | CLS-mocked, scheduled messages         | ✅     |
| 26  | `notification-statistics.service.ts`     | 4     | DB-mocked, stats aggregation           | ✅     |
| 27  | `calendar-creation.service.ts`           | 12    | DB-mocked, pure helpers, UUID          | ✅     |
| 28  | `document-access.service.ts`             | 15    | DB-mocked, access control, 9 scopes    | ✅     |
| 29  | `rotation-assignment.service.ts`         | 11    | DB-mocked, validation, UPSERT          | ✅     |
| 30  | `calendar-permission.service.ts`         | 14    | DB-mocked, pure clause builders        | ✅     |
| 31  | `connection-ticket.service.ts`           | 9     | Redis-mocked, TTL, UUID validation     | ✅     |
| 32  | `survey-questions.service.ts`            | 8     | DB-mocked, options, assignments        | ✅     |
| 33  | `activity-logger.service.ts`             | 7     | Fire-and-forget, never throws          | ✅     |
| 34  | `blackboard-attachments.service.ts`      | 6     | Delegation to DocumentsService         | ✅     |
| 35  | `root-tenant.service.ts`                 | 5     | DB-mocked, storage breakdown           | ✅     |
| 36  | `kvp-confirmations.service.ts`           | 6     | DB-mocked, UPSERT, visibility          | ✅     |
| 37  | `notification-feature.service.ts`        | 4     | Fire-and-forget, never throws          | ✅     |
| 38  | `kvp-attachments.service.ts`             | 6     | DB-mocked, UUID, null uploaded_at      | ✅     |
| 39  | `notification-preferences.service.ts`    | 6     | DB-mocked, JSON parse, UPSERT          | ✅     |
| 40  | `audit-request-filter.service.ts`        | 12    | Pure logic, fake timers, throttle      | ✅     |
| 41  | `shift-swap.service.ts`                  | 6     | DB-mocked, filters, status update      | ✅     |
| 42  | `blackboard-archive.service.ts`          | 6     | Cron, error resilience, manual trigger | ✅     |
| 43  | `blackboard-comments.service.ts`         | 6     | DB-mocked, UUID resolution             | ✅     |
| 44  | `kvp-comments.service.ts`                | 7     | DB-mocked, role-based visibility       | ✅     |
| 45  | `document-storage.service.ts`            | 9     | fs-mocked, path traversal protection   | ✅     |
| 46  | `feature-visits.service.ts`              | 5     | DB-mocked, UPSERT, Map return          | ✅     |
| 47  | `document-notification.service.ts`       | 11    | Pure switch + fire-and-forget          | ✅     |

**Phase 11 Gesamt:** 452 Tests in 47 Dateien ✅ COMPLETE

**Mocking-Patterns (Phase 11 — neue Varianten):**

```typescript
// Redis constructor mock (connection-ticket.service.ts):
const { mockRedisInstance } = vi.hoisted(() => ({
  mockRedisInstance: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
  },
}));
vi.mock('ioredis', () => ({
  default: vi.fn(function FakeRedis() { return mockRedisInstance; }),
}));

// CLS-dependent services (chat-scheduled.service.ts):
const mockCls = {
  get: vi.fn((key: string) => {
    if (key === 'tenantId') return 10;
    if (key === 'userId') return 5;
    return undefined;
  }),
};

// Pool-based services (partition-manager.service.ts, unified-logs.service.ts):
const mockPool = { query: vi.fn() };
mockPool.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

// Fire-and-forget (activity-logger, notification-feature):
// Service catches errors internally — test it doesn't throw
mockDb.query.mockRejectedValueOnce(new Error('DB down'));
await service.log(...); // Should NOT throw

// Fake timers (audit-request-filter.service.ts):
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });
vi.advanceTimersByTime(6000); // Advance past throttle window
```

**Erkenntnisse Phase 11:**

- **`vi.mock()` hoisting:** Factory functions are hoisted to top — variables used inside MUST be wrapped with `vi.hoisted()`. Forgetting this causes `ReferenceError: Cannot access before initialization`.
- **Redis constructor mock:** `vi.fn().mockImplementation(() => obj)` does NOT work as constructor. Must use `vi.fn(function FakeName() { return obj; })` with named function expression (NOT arrow function).
- **Pool vs DatabaseService:** Pool-based services (partition-manager, unified-logs) return `{ rows: [...] }`, not `T[]` directly. Different mock shape required.
- **Concurrency guards:** `ScheduledMessageProcessorService.processAtMinute()` uses `isProcessing` boolean — second concurrent call skips entirely (0 additional queries, not reduced queries).
- **Pure switch testing:** `mapAccessScopeToRecipient()` — test ALL switch branches including default `null` return. Edge cases: missing `ownerUserId` → `null` despite `personal` scope.
- **Fire-and-forget services:** ActivityLoggerService and NotificationFeatureService catch errors internally via try/catch — verify they don't throw on DB failure.

### Phase 11: Definition of Done

- [x] 47 neue Service-Testdateien erstellt (452 Tests)
- [x] Alle verbleibenden Services getestet (users, teams, departments, logs, areas, surveys, root, shifts, chat, kvp, blackboard, notifications, auth, calendar, documents, feature-visits, dashboard, role-switch, machines)
- [x] Redis-Mocking Pattern dokumentiert (ioredis constructor via named function)
- [x] Pool-Mocking Pattern dokumentiert (partition-manager, unified-logs)
- [x] Fire-and-forget Pattern getestet (activity-logger, notification-feature)
- [x] Fake-Timer Pattern getestet (audit-request-filter throttle window)
- [x] CLS-Mocking Pattern getestet (chat-scheduled, chat-conversations)
- [x] Pure function tests (mapAccessScopeToRecipient, determineOrgTarget, buildAdminOrgLevelFilter, shouldSkipRequest)
- [x] Path traversal protection getestet (document-storage)
- [x] Kein `.only` oder `.skip` im Code
- [x] Coverage: **52.84% Lines, 48.30% Branches, 54.80% Functions, 52.87% Stmts**

---

### Phase 12: Deep Coverage Push — Service Test Deepening

> **Ziel:** Die 4 Services mit niedrigster Coverage × höchster LOC gezielt vertiefen. Coverage von ~53% auf ~58% heben. +184 neue Tests.

**Strategie:** Target-Services identifiziert via Coverage-Report × LOC-Analyse. Jeder Service von ~10-15 Tests auf 47-68 Tests erweitert. Factory-Helpers und Mock-Chains für wiederverwendbare Test-Infrastruktur.

| #   | Service                         | Tests vorher | Tests nachher | Delta | Typ                                       | Status |
| --- | ------------------------------- | ------------ | ------------- | ----- | ----------------------------------------- | ------ |
| 1   | `blackboard-entries.service.ts` | 10           | 68            | +58   | DB-mocked, visibility, org-level, archive | ✅     |
| 2   | `surveys.service.ts`            | 12           | 64            | +52   | UUID, status workflow, validation, access | ✅     |
| 3   | `shifts.service.ts`             | 11           | 47            | +36   | Filters, CSV export, calendar, favorites  | ✅     |
| 4   | `kvp.service.ts`                | 12           | 50            | +38   | Facade, daily limit, status perms, share  | ✅     |

**Phase 12 Gesamt:** +184 Tests (45→229 in 4 Dateien) ✅ COMPLETE

**Mocking-Patterns (Phase 12 — neue Varianten):**

```typescript
// Factory pattern with spread for consistent mock data:
function createMockDbSuggestion(overrides?: Partial<DbSuggestion>): DbSuggestion {
  return {
    id: 1, tenant_id: 1, user_id: 5, title: 'Test',
    status: 'new', is_shared: false, is_archived: false,
    // ALL optional fields explicitly null:
    category_id: null, uuid: null, description: null, ...
    ...overrides,
  };
}

// Reusable mock chain for facade methods (kvp.service.ts):
function mockGetSuggestionByIdChain(mockDb: MockDb, suggestion: DbSuggestion): void {
  // getSuggestionById internally calls getExtendedUserOrgInfo (1 query) + detail query (1 query)
  mockDb.queryOne.mockResolvedValueOnce(TEAM_LEAD_ORG_ROW);  // org info
  mockDb.queryOne.mockResolvedValueOnce(suggestion);          // suggestion detail
}

// Static import mocking (kvp.service.ts uses uuid + eventBus):
vi.mock('uuid', () => ({ v7: vi.fn(() => 'mock-uuid-v7') }));
vi.mock('../../utils/eventBus.js', () => ({
  eventBus: { emit: vi.fn() },
}));
```

**Erkenntnisse Phase 12:**

- **`createMockDbRow(overrides?)` Factory-Pattern:** Spread-basierte Factory vermeidet Wiederholung und stellt sicher, dass alle optionalen Felder `null` sind (nicht `undefined`).
- **`mockGetSuggestionByIdChain()` Helper:** Wiederverwendbar für Facade-Methoden die intern `getSuggestionById` aufrufen (2 DB-Queries: org info + detail).
- **Static Import Mocking:** `vi.mock('uuid')` und `vi.mock('../../utils/eventBus.js')` nötig für Module die diese auf Top-Level importieren.
- **Blackboard visibility tests:** `not.toContain('AND e.org_level =')` statt `not.toContain('org_level')` — Base-SELECT enthält `e.org_level` als Spalte.
- **Survey status workflow:** `validateSurveyUpdate` Conflict-Check gilt für ALLE Rollen — Root hat keine Ausnahme.

### Phase 12: Definition of Done

- [x] 4 Service-Testdateien vertieft (+184 Tests)
- [x] Factory-Helpers erstellt (createMockDbSuggestion, createMockDbShift, createMockDbFavorite, createMockDbEntry)
- [x] Mock-Chain-Helper erstellt (mockGetSuggestionByIdChain)
- [x] Static Import Mocking (uuid, eventBus)
- [x] Kein `.only` oder `.skip` im Code
- [x] Coverage: **58.22% Lines, 54.50% Branches, 59.84% Functions, 58.06% Stmts**
- [x] Coverage-Thresholds erhöht: 45% (Lines, Functions, Branches, Statements)

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
Phase 11: Service Tests III 47 Services, 452 Tests                      ✅ DONE (47/47 Services)
Phase 12: Deep Coverage     4 Services, +184 Tests (deepened)            ✅ DONE (4/4 Services)
Phase 13: Foundation        DTOs, Helpers, Legacy Svcs (~580-715 Tests)   ⏳ NEXT → ~68% Coverage
Phase 14: Deep Coverage II  Service-Deepening, Infra (+344 Tests)         ✅ DONE → ~75% Coverage
```

**Gesamt: 1839 Unit Tests + 19 Frontend Tests in 109 Dateien, alle grün.**
**Gesamtprojekt: 2033 Tests (1839 unit + 19 frontend + 175 API) in 127 Dateien.**
**Ziel Phase 14: ~2750-2970 Tests, ~75% Coverage.**

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
if (...) expect(...)         // vitest/no-conditional-expect → Type-Assertion statt if
expect() in try/catch        // Gleiche Regel — Silent Pass Gefahr
```

**Zod `.safeParse()` Pattern (PFLICHT):**

```typescript
// ✅ SO — Type-Assertion, kein if
const result = Schema.safeParse(input);
expect(result.success).toBe(true);
const data = (result as { success: true; data: Record<string, unknown> }).data;
expect(data.field).toBe('value');

// ❌ NICHT SO — expect im if = ESLint-Fehler + Silent-Pass-Gefahr
if (result.success) expect(result.data.field).toBe('value');
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
        version: 10.32.0

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
      uses: actions/upload-artifact@v7
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
Settings → Branches → main:
  ✅ Require status checks to pass
    ✅ Unit Tests (Backend + Shared + Frontend) (required)
    ✅ Backend & Shared (TypeScript, ESLint, Prettier) (required)
    ✅ Frontend (Svelte Check, ESLint, Prettier, Stylelint) (required)
  ✅ Require branches to be up to date
```

**Ergebnis:** Kein Merge in `main` ohne grüne Unit-Tests + Quality Checks.

> **Hinweis:** Branch Protection erfordert GitHub Team Plan ($4/User/Monat) für private Repos.

### CI/CD Meilensteine

| Meilenstein                     | Aktion                                 | Status                                              |
| ------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Phase 1 grün (fieldMapper)      | Noch nicht — zu wenig Tests            | ✅ erreicht                                         |
| Phase 2 grün (shared + schemas) | CI-Job hinzufügen, aber NICHT required | ✅ erreicht                                         |
| Phase 3 grün (helpers)          | CI-Job als **required** setzen         | ✅ erreicht                                         |
| Phase 4+                        | Coverage-Thresholds in CI aktivieren   | ✅ erreicht — **CI-Job implementiert (2026-02-05)** |

**Status:** CI-Job `unit-tests` läuft in `code-quality-checks.yml` (1858 Tests: 1839 unit + 19 frontend-unit). Branch Protection Rule auf GitHub konfiguriert.

---

## 8. Coverage-Ziele

### Aktueller Stand (2026-02-06, Phase 13 in progress)

- **Coverage:** **64.93% Lines, 60.95% Branches, 65.95% Functions, 64.88% Statements**
- **Alle Services getestet:** Jeder NestJS-Service hat mindestens 1 Testdatei
- **Phase 13 Fortschritt:** Batch E ✅, B ✅, A ✅, D ✅, C 🔄 (3/8 legacy services)
- **Gut getestet:** Helpers (100%), Schemas (93%), DTOs (100%), Constants (100%), 73+ Services (50-100%)
- **Deepened (Phase 12):** blackboard-entries (68), surveys (64), kvp (50), shifts (47)
- **Deepened (Phase 13D):** documents (5→28), calendar (7→30), chat (10→38), notifications (3→14)

### Aktive Thresholds (in `vitest.config.ts`)

```typescript
// Floor-Werte — verhindern Regressions, nicht das Ziel
coverage: {
  thresholds: {
    lines: 55,
    functions: 55,
    branches: 50,
    statements: 55,
  },
}
```

> **Wenn Coverage unter diese Werte fällt → CI wird rot → Merge blockiert.**

### Stufenplan

| Stufe        | Wann                     | Lines      | Functions  | Aktion                               |
| ------------ | ------------------------ | ---------- | ---------- | ------------------------------------ |
| **Phase 8**  | Abgeschlossen            | **10%**    | **8%**     | ✅ Thresholds aktiviert (2026-02-05) |
| **Phase 9**  | ✅ DONE (12/12 Services) | **~13%**   | **~11%**   | 145 Tests, 12 Services getestet      |
| **Phase 10** | ✅ DONE (14/14 Services) | **28.3%**  | **28.9%**  | 234 Tests, Thresholds → 25%          |
| **Phase 11** | ✅ DONE (47/47 Services) | **52.84%** | **54.80%** | 452 Tests, alle Services getestet    |
| **Phase 12** | ✅ DONE (4 deepened)     | **58.22%** | **59.84%** | +184 Tests, 4 Services vertieft      |
| **Phase 13** | ✅ DONE (all 5 batches)  | **68.77%** | **68.97%** | +857 Tests, alle Batches A-E done    |
| **Phase 14** | ✅ DONE (A+B+C+D)        | **~75%**   | **~75%**   | +344 Tests, 3059 total, 141 Dateien  |
| Langfrist    | Production-Ready         | **80%**    | **80%**    | Guards, Controller, E2E              |

---

## Zusammenfassung

| Metrik              | Geplant (Phase 14) | Aktuell (Phase 13 ✅) |
| ------------------- | ------------------ | --------------------- |
| Testbare Dateien    | ~220+              | 142 getestet (unit)   |
| Testbare Funktionen | ~2000+             | ~1900+ getestet       |
| Geschätzte Tests    | ~2750-2970         | **2734 geschrieben**  |
| Phasen              | 0-14               | **Phase 13 ✅**       |
| Coverage            | **~75% Lines**     | **68.77% Lines**      |

### Abgeschlossen: Phase 0-13 ✅

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
Phase 11: Service Tests III — 452 Tests, 47 Services            ✅ DONE (47/47 Services)
Phase 12: Deep Coverage — +184 Tests, 4 Services vertieft       ✅ DONE (4/4 Services)
Phase 13: Foundation Broadening — +857 Tests                     ✅ DONE
  Batch E: Shared Package (availability, roles) — 15 Tests         ✅ DONE
  Batch B: Helpers/Utils/Constants — 247 Tests, 11 Dateien         ✅ DONE
  Batch A: Untested DTOs — 359 Tests, 13 Module                    ✅ DONE
  Batch D: Helper-Deepening — +85 Tests, 4 Dateien vertieft       ✅ DONE
  Batch C: Legacy Services — 170 Tests, 8/8 Services              ✅ DONE
    ✅ tenant-deletion.helpers (13), database.service (25), hierarchyPermission (22)
    ✅ tenantDeletion facade (30), executor (21), exporter (24), analyzer (18), audit (17)
════════════════════════════════════════════════════════════════════════════
          2715 Unit + 19 Frontend + 175 API = 2909 Tests.
          142 Unit-Dateien + 5 Frontend-Dateien. ~7.9s (unit). Alle grün.
          Coverage: 68.77% Lines, 63.37% Branches, 68.97% Functions, 68.72% Stmts.
```

### CI/CD — ✅ Implementiert (2026-02-05)

- [x] `unit-tests` Job in `code-quality-checks.yml` (2715 unit + 19 frontend = 2734 tests)
- [x] Coverage-Thresholds aktiv (lines 55%, functions 55%, branches 50%, statements 55%)
- [x] Branch Protection Rules auf GitHub konfiguriert
- [x] `svelte-kit sync` vor Tests in CI (Pflicht)

### Bug-Fixes (2026-02-05)

- [x] `sanitizeData` camelCase-Bug gefixt (SENSITIVE_FIELDS lowercase-Normalisierung)
- [x] `EmailSchema` Trim-Order dokumentiert (Low Priority, kein Fix nötig)

---

### Phase 13: Foundation Broadening — Untested Code Categories

> **Ziel:** Alle bisher komplett untesteten Code-Kategorien abdecken. Coverage von **58% → ~68% Lines**. Geschätzte **~580-700 neue Tests**.
>
> **Philosophie:** Breite vor Tiefe. Jede Datei im Coverage-Scope soll mindestens 1 Test haben. Mechanische Arbeit (DTOs, Constants) zuerst, dann komplexere Legacy-Services.

**Warum 68%?** Die größten Coverage-Lücken waren die **komplett untesteten Dateien** — 87 DTOs, 12 Helpers/Utils, 8 Legacy-Services. Davon sind DTOs, Helpers und 3 Legacy-Services jetzt getestet. **Restlücke:** 5 Legacy-Services (1477 Lines bei 0%) + Coverage-Schwelle von 64.93% → 68% (~3.1% Gap).

---

#### Batch A: Untested DTOs (13 Module, 87 Dateien, ~2,507 Lines)

> **Pattern:** Identisch zu Phase 8 — `.safeParse()` für valid/invalid, `.refine()` cross-field, enum-Werte.
> **Geschätzte Tests:** ~400-480

| #   | Modul               | Dateien | Lines | Schemas | Prio   | Highlights                                                  |
| --- | ------------------- | ------- | ----- | ------- | ------ | ----------------------------------------------------------- |
| A1  | `chat`              | 26      | 619   | 44      | HOCH   | Größtes Modul, 4 type-only files (0 exports), scheduled-msg |
| A2  | `logs`              | 4       | 294   | 8       | HOCH   | `export-logs.dto.ts` 153 Lines mit ExportFormat + LogSource |
| A3  | `audit-trail`       | 6       | 290   | 12      | HOCH   | `get-entries.dto.ts` 90 Lines, complex query filters        |
| A4  | `root`              | 12      | 239   | 24      | MITTEL | 12 Dateien, alle 2-export Schema+Class                      |
| A5  | `areas`             | 6       | 215   | 13      | MITTEL | `create-area.dto.ts` mit AreaTypeSchema enum                |
| A6  | `signup`            | 2       | 209   | 4       | HOCH   | `signup.dto.ts` 149 Lines — Tenant-Registration-Validierung |
| A7  | `admin-permissions` | 10      | 200   | 20      | MITTEL | 10 Param-DTOs, bulk-update, set-permissions                 |
| A8  | `reports`           | 7       | 151   | 14      | MITTEL | `custom-report.dto.ts` mit `.refine()` cross-field          |
| A9  | `features`          | 6       | 92    | 12      | QUICK  | 6 kleine Dateien, je 2 exports                              |
| A10 | `dashboard`         | 1       | 62    | 4       | QUICK  | Nur Zod-Schemas, KEINE DTO-Klassen                          |
| A11 | `roles`             | 2       | 57    | 5       | QUICK  | `RoleEnumSchema`, `role-id-param`                           |
| A12 | `plans`             | 4       | 51    | 8       | QUICK  | Kleinstes Modul, alle simpel                                |
| A13 | `feature-visits`    | 1       | 28    | 3       | QUICK  | `FeatureSchema` enum, `MarkVisitedSchema`                   |

**Reihenfolge:** Quick Wins zuerst (A9-A13 = 290 Lines, ~50 Tests, schnell erledigt), dann HOCH (A1-A3,A6), dann MITTEL (A4,A5,A7,A8).

**Besonderheiten:**

- `chat/` hat 4 Dateien mit 0 Exports (type-only re-exports) → diese überspringen
- `dashboard/` hat keine DTO-Klassen → `.safeParse()` direkt auf Schemas
- `signup.dto.ts` (149 Lines) ist das zweitschwerste einzelne DTO → braucht eigene Testdatei
- `export-logs.dto.ts` (153 Lines) ist das schwerste → ExportFormat + LogSource enums + complex filters

---

#### Batch B: Untested Helpers, Utils & Constants (12 Dateien, ~1,544 Lines)

> **Pattern:** Pure Functions → kein Mocking. Constants → Strukturelle Assertions / Snapshot-Tests.
> **Geschätzte Tests:** ~80-100

| #   | Datei                               | Lines | Exports | Typ                    | Prio   | Highlights                                              |
| --- | ----------------------------------- | ----- | ------- | ---------------------- | ------ | ------------------------------------------------------- |
| B1  | `machines/machines.helpers.ts`      | 326   | 16      | Helper (pure)          | HOCH   | 16 Exports, größter untesteter Helper                   |
| B2  | `audit/audit.constants.ts`          | 286   | 17      | Constants              | HOCH   | SENSITIVE_FIELDS, EXCLUDED_PATHS, ACTION_MAP, SQL_REGEX |
| B3  | `root/root.helpers.ts`              | 208   | 7       | Helper (pure)          | HOCH   | Tenant-Verwaltungs-Logik, Mapper                        |
| B4  | `logger/logger.constants.ts`        | 163   | 7       | Constants              | MITTEL | Log-Level-Mappings, Format-Configs                      |
| B5  | `utils/featureCheck.ts`             | 103   | 2       | Utility                | MITTEL | Feature-Flag-Prüfung                                    |
| B6  | `utils/pathSecurity.ts`             | 101   | 3       | Utility (security!)    | HOCH   | Path-Traversal-Schutz — sicherheitskritisch!            |
| B7  | `utils/eventBus.ts`                 | 99    | 1       | Singleton/EventEmitter | MITTEL | EventBus-Klasse, emit/on/off                            |
| B8  | `calendar/calendar-export.utils.ts` | 88    | 3       | Utility (pure)         | MITTEL | iCal-/CSV-Export-Formatierung                           |
| B9  | `shared/constants/availability.ts`  | 50    | 4       | Constants              | QUICK  | Verfügbarkeits-Status-Mappings                          |
| B10 | `utils/employeeIdGenerator.ts`      | 50    | 1       | Utility (pure)         | QUICK  | Mitarbeiter-ID-Generierung                              |
| B11 | `utils/dbWrapper.ts`                | 48    | 2       | Utility                | QUICK  | DB-Query-Wrapper                                        |
| B12 | `shared/constants/roles.ts`         | 22    | 2       | Constants              | QUICK  | Rollen-Hierarchie-Definition                            |

**Reihenfolge:** Quick Wins (B9-B12 = 170 Lines, ~15 Tests), dann HOCH (B1,B2,B3,B6), dann MITTEL (B4,B5,B7,B8).

**Besonderheiten:**

- `pathSecurity.ts` ist **sicherheitskritisch** — Path-Traversal-Tests MÜSSEN `../`, `..\\`, null-bytes etc. abdecken
- `audit.constants.ts` und `logger.constants.ts` sind großteils Daten-Exports → Strukturelle Tests (`expect(SENSITIVE_FIELDS).toContain('password')`)
- `eventBus.ts` braucht Spy-Setup auf EventEmitter
- `machines.helpers.ts` mit 16 Exports ist der größte Einzelaufwand in diesem Batch

---

#### Batch C: Legacy Services (8 Dateien, ~2,280 Lines)

> **Pattern:** DI-Bypass wie Phase 5-12. Legacy Services haben 0 NestJS-Imports (außer database.service) → reines Constructor-Mocking.
> **Geschätzte Tests:** ~60-80

| #   | Datei                                 | Lines | Async Methods | NestJS? | Prio   | Highlights                                             |
| --- | ------------------------------------- | ----- | ------------- | ------- | ------ | ------------------------------------------------------ |
| C1  | `tenantDeletion.service.ts`           | 510   | 14            | Nein    | HOCH   | Orchestrator/Facade, delegiert an C3-C6                |
| C2  | `hierarchyPermission.service.ts`      | 486   | 11            | Nein    | HOCH   | Komplexe Berechtigungs-Hierarchie, viel Business-Logik |
| C3  | `tenant-deletion-executor.service.ts` | 402   | 9             | Nein    | MITTEL | Kaskadierende Löschung, DB-Transaktionen               |
| C4  | `tenant-deletion-exporter.service.ts` | 280   | 6             | Nein    | MITTEL | Export-Logik vor Löschung                              |
| C5  | `database.service.ts`                 | 256   | 8             | Ja (1)  | MITTEL | Pool-Management, query/queryOne Wrapper                |
| C6  | `tenant-deletion-analyzer.service.ts` | 146   | 3             | Nein    | QUICK  | Analyse-Logik, Dependencies prüfen                     |
| C7  | `tenant-deletion-audit.service.ts`    | 139   | 5             | Nein    | QUICK  | Audit-Trail für Löschungen                             |
| C8  | `tenant-deletion.helpers.ts`          | 61    | 2             | Nein    | QUICK  | Pure Helpers, kleinste Datei                           |

**Reihenfolge:** Quick Wins (C6-C8 = 346 Lines, ~15 Tests), dann HOCH (C1,C2), dann MITTEL (C3-C5).

**Besonderheiten:**

- `tenantDeletion.service.ts` ist ein Facade → delegiert an executor/exporter/analyzer/audit → Delegation-Tests wie Phase 10
- `hierarchyPermission.service.ts` hat komplexe Rekursion (Abteilung→Team→User) → Edge Cases für tiefe Hierarchien
- `database.service.ts` hat 1 NestJS-Import (Pool-Injection) → Pool-Mock wie partition-manager
- `tenant-deletion.helpers.ts` sind pure Functions → kein Mocking nötig, sofort testbar
- Alle Legacy-Services nutzen `execute()` aus `utils/db.ts` statt `DatabaseService` → anderen Mock-Shape!

**Mocking-Pattern für Legacy Services:**

```typescript
import { execute } from '../../utils/db.js';

// Legacy services use utils/db execute() — NOT DatabaseService
vi.mock('../../utils/db.js', () => ({
  execute: vi.fn(),
}));

const mockExecute = vi.mocked(execute);

// Or constructor injection where applicable:
const mockDb = { query: vi.fn() };
const service = new TenantDeletionService(mockDb as never);
```

---

#### Batch D: Helper-Deepening (4 existierende Helper-Dateien, niedrige Test-Ratio)

> **Pattern:** Bestehende Test-Dateien erweitern — mehr Edge Cases, mehr Branches.
> **Geschätzte Tests:** ~30-40 neue Tests

| #   | Datei                      | Lines | Aktuelle Tests | Ratio   | Target Tests | Delta |
| --- | -------------------------- | ----- | -------------- | ------- | ------------ | ----- |
| D1  | `documents.helpers.ts`     | 275   | 5              | 1.8/100 | 15           | +10   |
| D2  | `calendar.helpers.ts`      | 309   | 7              | 2.3/100 | 15           | +8    |
| D3  | `chat.helpers.ts`          | 358   | 10             | 2.8/100 | 20           | +10   |
| D4  | `notifications.helpers.ts` | 108   | 3              | 2.8/100 | 8            | +5    |

**Besonderheiten:**

- `documents.helpers.ts` hat DB-Helpers (`getDocumentRow`, `insertDocumentRecord`) die in Phase 6 bewusst ausgelassen wurden → jetzt mit DB-Mocking testen
- `calendar.helpers.ts` hat Filter-Normalisierung → Edge Cases für leere/undefined Filter
- `chat.helpers.ts` hat Row→User-Mapping und Conversation-Mapping → mehr Mapper-Varianten

---

#### Batch E: Shared Package (2 Dateien, 72 Lines)

> **Pattern:** Pure Constants → Strukturelle Tests.
> **Geschätzte Tests:** ~10-15

| #   | Datei                              | Lines | Exports | Tests                                     |
| --- | ---------------------------------- | ----- | ------- | ----------------------------------------- |
| E1  | `shared/constants/availability.ts` | 50    | 4       | Status-Mappings, Label-Korrektheit        |
| E2  | `shared/constants/roles.ts`        | 22    | 2       | Rollen-Definition, Hierarchie-Korrektheit |

---

#### Phase 13: Zusammenfassung

| Batch | Kategorie           | Dateien | Lines     | Geschätzte Tests |
| ----- | ------------------- | ------- | --------- | ---------------- |
| A     | Untested DTOs       | 87      | 2,507     | ~400-480         |
| B     | Helpers/Utils/Const | 12      | 1,544     | ~80-100          |
| C     | Legacy Services     | 8       | 2,280     | ~60-80           |
| D     | Helper-Deepening    | 4       | 1,050     | ~30-40           |
| E     | Shared Package      | 2       | 72        | ~10-15           |
| **∑** | **GESAMT**          | **113** | **7,453** | **~580-715**     |

**Reihenfolge der Batches:** E → B (Quick Wins) → A (mechanisch, hoch-ROI) → D → C (komplex)

#### Phase 13: Definition of Done

- [x] Alle 13 DTO-Module haben Test-Dateien (87 DTOs, 359 Tests) ✅ Batch A
- [x] 11/12 untestete Helper/Utils/Constants haben Tests (247 Tests) ✅ Batch B
- [x] Alle 8 Legacy-Services haben Tests (170 Tests) ✅ Batch C
- [x] 4 existierende Helper-Dateien vertieft (+85 Tests) ✅ Batch D
- [x] Shared Package vollständig getestet (availability, roles) ✅ Batch E
- [x] `pathSecurity.ts` hat Path-Traversal-Schutztests (sicherheitskritisch!) ✅ Batch B
- [x] Coverage: **≥ 68% Lines, ≥ 63% Branches, ≥ 68% Functions, ≥ 68% Stmts** — erreicht 68.77/63.37/68.97/68.72 ✅
- [ ] Coverage-Thresholds erhöht: **65% Lines, 60% Branches, 65% Functions, 65% Stmts**
- [ ] Kein `.only` oder `.skip` im Code
- [ ] Alle Tests grün in CI

---

### Phase 14: Deep Coverage — Service-Deepening & Infrastructure

> **Ziel:** Die 15 Services mit niedrigster Test-Ratio gezielt vertiefen + Infrastructure-Code testen. Coverage von **~68% → ~75% Lines**. Geschätzte **~350-450 neue Tests**.
>
> **Philosophie:** Tiefe vor Breite. Die größten Services mit der dünnsten Testabdeckung systematisch vertiefen. Sicherheitskritische Services (Auth) priorisieren.

**Warum 75%?** Ab 68% sind alle Dateien mindestens einmal getestet (Phase 13). Jetzt fehlt Tiefe — die großen Services haben 1-2 Tests pro 100 Lines statt der empfohlenen 4-5. Phase 14 bringt die Coverage auf ein produktionsreifes Niveau.

---

#### Batch A: Service-Deepening Tier 1 — Kritisch Undertested (Ratio < 1.6) ✅ COMPLETE

> **Kriterium:** Tests-per-100-Lines Ratio unter 1.6. Das sind die fünf Services mit der dünnsten Coverage relativ zu ihrer Größe.
> **Ergebnis:** +145 neue Tests (Ziel war ~160-200)

| #   | Service                         | Lines | Tests vorher | Tests nachher | Delta | Ratio neu | Status |
| --- | ------------------------------- | ----- | ------------ | ------------- | ----- | --------- | ------ |
| A1  | `rotation-generator.service.ts` | 621   | 6            | 33            | +27   | 5.31      | ✅     |
| A2  | `auth.service.ts`               | 786   | 14           | 45            | +31   | 5.73      | ✅     |
| A3  | `reports.service.ts`            | 1,036 | 16           | 52            | +36   | 5.02      | ✅     |
| A4  | `logs.service.ts`               | 687   | 10           | 39            | +29   | 5.68      | ✅     |
| A5  | `unified-logs.service.ts`       | 461   | 7            | 29            | +22   | 6.29      | ✅     |

**Key Patterns eingesetzt:**

- A1: SQL-routing `mockImplementation` für config-based tests, `vi.mock('uuid')`, `vi.useFakeTimers()`
- A2: `vi.hoisted()` für ENV-Vars + bcrypt mocks, `setupLoginMocks()` helper für 6-call login chain
- A3: `mockOverviewQueries()` helper, ROI division-by-zero guard, KVP participation edge cases
- A4: Private helpers via bracket notation (addSearchCondition, buildWhereClause, formatCreatedAt, etc.)
- A5: Cursor-based streaming mocks, RLS context verification, `safeJsonParse` branch coverage

---

#### Batch B: Service-Deepening Tier 2 — Below Average (Ratio 1.6-2.0) ✅ COMPLETE

> **Kriterium:** Tests-per-100-Lines Ratio zwischen 1.6 und 2.0. Große Services mit unterdurchschnittlicher Coverage.
> **Ergebnis:** +100 neue Tests (Ziel war ~100-130)

| #   | Service                         | Lines | Tests vorher | Tests nachher | Delta | Ratio neu | Status |
| --- | ------------------------------- | ----- | ------------ | ------------- | ----- | --------- | ------ |
| B1  | `users.service.ts`              | 1,053 | 21           | 51            | +30   | 4.84      | ✅     |
| B2  | `departments.service.ts`        | 768   | 13           | 34            | +21   | 4.43      | ✅     |
| B3  | `plans.service.ts`              | 699   | 12           | 27            | +15   | 3.86      | ✅     |
| B4  | `chat-conversations.service.ts` | 635   | 12           | 27            | +15   | 4.25      | ✅     |
| B5  | `areas.service.ts`              | 585   | 11           | 30            | +19   | 5.13      | ✅     |

**Key Patterns eingesetzt:**

- B1: `vi.mock('fs')` + `vi.mock('bcryptjs')` for avatar/password, PG constraint `{ code: '23505' }`, 6-mock chains for createUser/updateUser with departmentIds
- B2: `mockNoDependencies()` helper for 11 empty dep checks, legacy `execute()` `[rows, fields]` tuple
- B3: `makePlanRow()` + `makeTenantPlanRow()` factories, 10+ mock chain for upgradePlan, `query` + `queryOne` dual mocking
- B4: CLS mock `{ get: vi.fn((key) => ...) }`, `vi.mock('uuid')`, WhatsApp-style soft-delete idempotency
- B5: `mockNoDependencies()` for 5 dep checks, force-delete with UPDATE vs DELETE strategies, `buildFilteredQuery` private helper coverage

---

#### Batch C: Infrastructure-Tests (3 Dateien, ~481 Lines) ✅ COMPLETE

> **Pattern:** NestJS Execution-Context-Mocking für Pipes/Filters/Interceptors.
> **Ergebnis:** +80 Tests (Ziel war ~30-40)

| #   | Datei                                         | Lines | Typ              | Tests | Highlights                                                   | Status |
| --- | --------------------------------------------- | ----- | ---------------- | ----- | ------------------------------------------------------------ | ------ |
| C1  | `common/filters/all-exceptions.filter.ts`     | 295   | Exception Filter | 43    | ZodError/HttpException/ServiceError/unknown, Sentry, codeMap | ✅     |
| C2  | `common/pipes/zod-validation.pipe.ts`         | 87    | Validation Pipe  | 16    | Constructor/metatype schema, pass-through, zodPipe factory   | ✅     |
| C3  | `common/interceptors/response.interceptor.ts` | 99    | Interceptor      | 21    | Success wrapping, raw pass-through, pagination extraction    | ✅     |

**Key Patterns eingesetzt:**

- C1: `vi.hoisted()` for mockLogger + `vi.fn(function FakeLogger() { return mockLogger; })` for Logger constructor, real ZodError/HttpException instances, `createMockHost()` helper with configurable url/method/headers, `getSentResponse()` extractor, all 11 status code mappings as parameterized test
- C2: Real Zod schemas (no mocks needed), `BadRequestException` catch with `.getResponse()` assertion, nested path testing (user.profile.bio → 'user.profile.bio'), constructor vs metatype schema priority
- C3: RxJS `of()` + `firstValueFrom()` for Observable testing, content-type header mocking (string/number/undefined), pagination extraction (items/entries/data priority)

**Mocking-Pattern für Infrastructure:**

```typescript
// NestJS ExecutionContext mock für Pipes/Filters
const mockContext = {
  switchToHttp: () => ({
    getRequest: () => ({ url: '/api/v2/test', method: 'GET' }),
    getResponse: () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() }),
  }),
  getHandler: () => vi.fn(),
  getClass: () => vi.fn(),
};

// ArgumentsHost mock für ExceptionFilter
const mockHost = {
  switchToHttp: () => ({
    getRequest: () => ({ url: '/test', method: 'POST', ip: '127.0.0.1' }),
    getResponse: () => mockResponse,
  }),
  getType: () => 'http',
};
```

**Bewusst NICHT getestet (Infrastructure):**

- `audit-trail.interceptor.ts` (207 Lines) — Zu komplex, braucht vollständiges Request-Lifecycle-Mocking
- `throttle.decorators.ts` (137 Lines) — Reine NestJS-Decorator-Komposition
- `current-user.decorator.ts`, `tenant.decorator.ts`, `roles.decorator.ts`, `public.decorator.ts` — Reine Decorators, getestet via Integration/API-Tests

---

#### Batch D: Partial Utility Coverage (3 Dateien, ~368 Lines) ✅ COMPLETE

> **Pattern:** Gemocked für externe Dependencies (pino, DB, etc.)
> **Ergebnis:** D1 = +19 Tests (neu), D2/D3 bereits in Phase 13B getestet (10+8 = 18 Tests vorhanden)

| #   | Datei                          | Lines | Prio   | Tests | Highlights                                                        | Status |
| --- | ------------------------------ | ----- | ------ | ----- | ----------------------------------------------------------------- | ------ |
| D1  | `utils/logger.ts`              | 240   | MITTEL | 19    | vi.resetModules+dynamic import, env-based log level, Loki targets | ✅     |
| D2  | `utils/featureCheck.ts`        | 103   | MITTEL | 10    | Bereits in Phase 13B getestet                                     | ✅     |
| D3  | `utils/employeeIdGenerator.ts` | 50    | QUICK  | 8     | Bereits in Phase 13B getestet                                     | ✅     |

**Key Patterns eingesetzt:**

- D1: `vi.hoisted()` for persistent pino mock, `vi.resetModules()` + dynamic `import()` for each env config, `withEnv()` helper for clean env manipulation, testing private functions indirectly via pino options

**Bewusst NICHT getestet (zu hoher Mock-Aufwand, zu wenig ROI):**

- `websocket.ts` (936 Lines) — Braucht Socket.IO-Server-Mock, WebSocket-Lifecycle → E2E
- `utils/emailService.ts` (727 Lines) — SMTP-Dependency → Integration-Test
- `utils/db.ts` (329 Lines) — Pool-Management → getestet indirekt durch alle DB-mocked Tests
- `database/repositories/user.repository.ts` (593 Lines) — Raw-SQL → API/Integration-Tests
- `workers/deletionWorker.ts` (168 Lines) — Worker-Thread-Lifecycle → Integration-Test
- `config/database.ts` (162 Lines) — Konfiguration, einmalig beim Start
- `nest/instrument.ts` (104 Lines) — Sentry-Init, Side-Effect-only

---

#### Phase 14: Zusammenfassung

| Batch | Kategorie        | Services/Dateien | Delta Tests | Status |
| ----- | ---------------- | ---------------- | ----------- | ------ |
| A     | Tier 1 Deepening | 5 Services       | +145 ✅     | DONE   |
| B     | Tier 2 Deepening | 5 Services       | +100 ✅     | DONE   |
| C     | Infrastructure   | 3 Dateien        | +80 ✅      | DONE   |
| D     | Partial Utils    | 3 Dateien        | +19 ✅      | DONE   |
| **∑** | **GESAMT**       | **16**           | **+344**    | **✅** |

**Reihenfolge:** A1→A5 ✅ → B1→B5 ✅ → C1-C3 ✅ → D1-D3 ✅. **PHASE 14 COMPLETE.**

#### Phase 14: Definition of Done

- [x] 5 Tier-1-Services vertieft (rotation-generator, auth, reports, logs, unified-logs) ✅ +145 Tests
- [x] 5 Tier-2-Services vertieft (users, departments, plans, chat-conversations, areas) ✅ +100 Tests
- [x] Exception-Filter getestet (all-exceptions.filter.ts) ✅ 43 Tests
- [x] Validation-Pipe getestet (zod-validation.pipe.ts) ✅ 16 Tests
- [x] Response-Interceptor getestet (response.interceptor.ts) ✅ 21 Tests
- [x] Auth-Service hat ≥ 45 Tests (sicherheitskritisch — jetzt 45 Tests!) ✅
- [x] Coverage: **76% Lines, 71.55% Branches, 74.97% Functions, 75.90% Stmts** ✅ (Ziel ≥75% Lines erreicht!)
- [x] Coverage-Thresholds erhöht: **72% Lines, 65% Branches, 72% Functions, 72% Stmts** ✅ (vitest.config.ts aktualisiert)
- [x] Kein `.only` oder `.skip` im Code ✅ (grep bestätigt)
- [x] Alle Tests grün: **3078 Tests (unit + frontend-unit), 146 Dateien** ✅

---

### Phase 13 + 14: Gesamtübersicht

```
Phase 13 (Foundation Broadening):     857 Tests                         ✅ COMPLETE
  Batch E: Shared Package               15 Tests          ✅ DONE
  Batch B: Helpers/Utils/Constants       247 Tests         ✅ DONE
  Batch A: Untested DTOs, 13 Module      359 Tests         ✅ DONE
  Batch D: Helper-Deepening              +85 Tests         ✅ DONE
  Batch C: Legacy-Services               170 Tests         ✅ DONE (8/8)

Phase 14 (Deep Coverage):             ~295-315 neue Tests → Coverage ~75%
  Batch A: 5 Tier-1 Service-Deepening   +145 Tests        ✅ DONE
  Batch B: 5 Tier-2 Service-Deepening   +100 Tests        ✅ DONE
  Batch C: 3 Infrastructure             +80 Tests         ✅ DONE
  Batch D: 3 Partial Utils              +19 Tests         ✅ DONE (D2/D3 already in Phase 13B)

GESAMT:  ~1201 neue Tests (857 Phase 13 ✅ + 344 Phase 14 ✅)
         → von 1858 auf 3059 Tests (141 Dateien)
         → Coverage: 58% → 65% → 68.77% (Phase 13 ✅) → ~71% (Batch A ✅) → ~73% (Batch B ✅) → ~74% (Batch C ✅) → ~75% (Batch D ✅)
         → Thresholds: 55% → 65% → 72%
```

**Bewusst NICHT in Phase 13/14 (→ v0.4.0 oder später):**

- Controller-Tests (9,160 Lines, excluded from coverage)
- Guard-Tests (434 Lines, excluded from coverage — kein Impact auf 75%-Ziel)
- E2E/Playwright-Tests
- Frontend-Komponenten-Tests
- WebSocket-Tests (936 Lines)
- Email-Service-Tests (727 Lines)
- Worker-Tests (168 Lines)

> **Hinweis zu Guards:** Die 3 Guard-Dateien (jwt-auth, throttler, roles = 434 Lines) sind aus der Coverage **excluded** in `vitest.config.ts`. Sie zu testen würde die Coverage-Metrik NICHT verbessern. Wenn Guard-Tests gewünscht sind, muss zuerst die Exclusion entfernt werden — das erhöht aber auch den Nenner und senkt die Coverage kurzfristig.

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

**Phase 0-13 abgeschlossen. Alle 5 Batches (A, B, C, D, E) complete.**
CI + Coverage-Thresholds aktiv seit 2026-02-05. Coverage von 58% → 68.77% gestiegen (+857 Tests).

**Phase 13 DONE:** 857 Tests, 142 Dateien, Coverage 68.77% Lines / 63.37% Branches / 68.97% Functions / 68.72% Stmts.
**Phase 14 Batch A DONE:** +145 Tests (53→198), 2860 Unit-Tests total, 137 Dateien.
**Phase 14 Batch B DONE:** +100 Tests (69→169), 2960 Unit-Tests total, 137 Dateien.
**Phase 14 Batch C DONE:** +80 Tests (filter 43, pipe 16, interceptor 21), 3040 Unit-Tests total, 140 Dateien.
**Phase 14 Batch D DONE:** +19 Tests (logger 19, featureCheck/employeeId already tested), 3059 Unit-Tests total, 141 Dateien.
**Phase 14 COMPLETE:** +344 Tests (A:145, B:100, C:80, D:19). Von 2715 → 3059 Unit-Tests. 141 Dateien.

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

### Trap 3: `vitest/no-conditional-expect` — NIEMALS `expect()` in `if`-Blöcken (Phase 13) — ✅ GEFIXT

**ESLint-Regel:** `vitest/no-conditional-expect`
**Betroffene Dateien:** 8 DTO- und Helper-Test-Dateien, 27 Stellen
**Problem:** Zod `.safeParse()` gibt ein Discriminated-Union-Ergebnis zurück (`{ success: true, data } | { success: false, error }`). TypeScript erzwingt ein `if (result.success)` bevor `result.data` zugänglich ist. Das führt zu:

```typescript
// ❌ VERBOTEN — ESLint vitest/no-conditional-expect
const result = SomeSchema.safeParse(input);
expect(result.success).toBe(true);
if (result.success) {
  expect(result.data.someField).toBe('expected'); // ← expect in if = LINT ERROR
}
```

**Warum verboten:** Wenn `result.success` wider Erwarten `false` ist, wird der `expect` im `if`-Block **still übersprungen** — der Test wird **grün obwohl er falsch ist**. Das ist ein Silent Pass. Der `expect(result.success).toBe(true)` davor fängt es zwar ab, aber ESLint kann das nicht statisch erkennen.

**Fix — Type-Assertion statt Conditional:**

```typescript
// ✅ KORREKT — kein Conditional, immer ausgeführt
const result = SomeSchema.safeParse(input);
expect(result.success).toBe(true);
const data = (result as { success: true; data: Record<string, unknown> }).data;
expect(data.someField).toBe('expected');
```

**Varianten für spezifische Typen:**

```typescript
// Wenn der Typ bekannt ist (z.B. String-Schema):
const data = (result as { success: true; data: string }).data;
expect(data).toBe('normalized@email.de');

// Wenn mehrere Felder geprüft werden:
const data = (result as { success: true; data: Record<string, unknown> }).data;
expect(data.departmentIds).toEqual([]);
expect(data.permissions).toEqual({ canRead: true, canWrite: false });

// Für Discriminated Unions (nicht-safeParse):
const data = result as { content: string };
expect(data.content).toBe('Hello!');
```

**Regel für die Zukunft:**

1. **NIEMALS** `expect()` in `if`, `else`, `try/catch`, oder Ternary
2. **IMMER** Type-Assertion (`as`) für Zod-safeParse-Ergebnisse
3. **IMMER** `expect(result.success).toBe(true)` VOR der Assertion — das ist der Runtime-Guard
4. Die Type-Assertion ist **nur für TypeScript** — zur Laufzeit greift der `expect(result.success).toBe(true)` darüber

**Status:** ✅ 27 Stellen in 8 Dateien gefixt (2026-02-06).

---

**Referenzen:**

- [Vitest Docs v4](https://vitest.dev/guide/)
- [Microsoft: Unit Testing Best Practices](https://learn.microsoft.com/en-us/dotnet/core/testing/unit-testing-best-practices)
- [IBM: Unit Testing Best Practices](https://www.ibm.com/think/insights/unit-testing-best-practices)
- [The Coder Cafe: Unit Tests as Documentation](https://read.thecoder.cafe/p/unit-tests-as-documentation)
- [ADR-013: CI/CD Pipeline Hardening](./infrastructure/adr/ADR-013-ci-cd-pipeline-hardening.md)
- [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md)
- [CODE-OF-CONDUCT.md](./CODE-OF-CONDUCT.md)
