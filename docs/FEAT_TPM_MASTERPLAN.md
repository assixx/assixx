# FEAT: TPM (Total Productive Maintenance) — Execution Masterplan

> **Created:** 2026-02-18
> **Version:** 1.15.0 (Step 3.4 DONE — Unit Tests Notification + Escalation / PHASE 3 COMPLETE)
> **Status:** IN PROGRESS — Phase 4, nächster Step: 4.1 (API Tests Plans + Cards)
> **Branch:** `feature/TPM`
> **Spec:** [brainstorming-TPM.md](./brainstorming-TPM.md)
> **Context:** [TPM-ECOSYSTEM-CONTEXT.md](./TPM-ECOSYSTEM-CONTEXT.md)
> **Verification:** [brainstorming-TPM-Verification.md](./brainstorming-TPM-Verification.md)
> **Author:** SCS + Claude (Senior Engineer)
> **Estimated Sessions:** 29
> **Actual Sessions:** 18 / 29

---

## MUST READ — Pflichtlektüre VOR jeder Session

| #   | Dokument                                                                 | Warum                                          |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| 1   | [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md)             | Migration-Syntax, RLS, GRANTs, Backup-Workflow |
| 2   | [TYPESCRIPT-STANDARDS.md](./TYPESCRIPT-STANDARDS.md)                     | Kein `any`, `??` statt `\|\|`, Zod DTOs        |
| 3   | [brainstorming-TPM-Verification.md](./brainstorming-TPM-Verification.md) | Alle Andockpunkte zum Ecosystem                |

---

## Golden Rules — TPM-spezifisch

1. **Modulare Dateien:** Max **300 Zeilen** pro Service/Component (Ziel), Hard-Limit **800** (ESLint). Blank Lines + Comments zählen nicht.
2. **Single Responsibility:** Jede Datei hat EINE Aufgabe. Lieber 15 kleine Services als 3 Monster-Services.
3. **Max 60 Zeilen pro Funktion** (Backend), **80** für DB-Layer und Svelte-Components.
4. **Kleine Sessions:** Max ~400k Tokens. Ein klares Ziel pro Session.
5. **Session-End-Check (MANDATORY):**

```bash
# NACH JEDER SESSION — KEIN SKIP!
pnpm run validate:all    # type-check + eslint + prettier
pnpm test                # unit + api tests
```

6. **Kein Quick Fix. Keine Abkürzung. KISS.**

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-02-18 | Initial Draft — 6 Phasen, 25 Sessions geplant                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 0.2.0   | 2026-02-18 | Validation Review: 7 Fehler + 5 Inkonsistenzen gefixt, E17 Shift-Grid Toggle ergänzt → 29 Sessions, 4 ENUMs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 1.0.0   | 2026-02-18 | Phase 1 COMPLETE: 4 Migrationen (041-044), 8 Tabellen, 4 ENUMs, RLS 8/8, GRANTs 32, Feature Flag, 4400 Tests bestanden                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.1.0   | 2026-02-19 | Step 2.1 DONE: Module Skeleton — tpm.types.ts (381 Zeilen), tpm.permissions.ts, tpm-permission.registrar.ts, tpm.module.ts, app.module.ts Import                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.2.0   | 2026-02-19 | Step 2.2 DONE: DTOs — 11+2 Dateien in dto/ (common, create/update plan, create/update card, complete-card, respond-execution, create-time-estimate, update-escalation-config, update-color-config, create/update-template, index)                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.3.0   | 2026-02-19 | Step 2.3 DONE: Plans Service — tpm-plans.service.ts (235 Z.), tpm-plans-interval.service.ts (178 Z.), tpm-plans.helpers.ts (74 Z.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 1.4.0   | 2026-02-19 | Step 2.4 DONE: Config Services — tpm-time-estimates.service.ts (179 Z.), tpm-templates.service.ts (195 Z.), tpm-color-config.service.ts (128 Z.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.5.0   | 2026-02-19 | Step 2.5 DONE: Cards + Status — tpm-cards.helpers.ts (87 Z.), tpm-cards.service.ts (468 Z.), tpm-card-status.service.ts (176 Z.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.6.0   | 2026-02-19 | Step 2.6 DONE: Cascade + Duplicate — tpm-card-cascade.service.ts (121 Z.), tpm-card-duplicate.service.ts (114 Z.)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 1.7.0   | 2026-02-19 | Step 2.7 DONE: Slot Assistant — tpm-slot-assistant.service.ts (486 Z.), 4 Datenquellen, E15-Validierung                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 1.7.1   | 2026-02-19 | RLS-Audit (ADR-019): 4 Mutations nutzten `db.query()` statt `tenantTransaction()` — gefixt in tpm-templates.service.ts, tpm-time-estimates.service.ts, tpm-color-config.service.ts (2×). DB-Layer 8/8 sauber, Service-Layer jetzt 100% ADR-019-konform                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.8.0   | 2026-02-19 | Step 2.8 DONE: Executions + Approval — tpm-executions.helpers.ts (78 Z.), tpm-executions.service.ts (405 Z.), tpm-approval.service.ts (346 Z.), tpm.module.ts updated (13/15 Services)                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 1.9.0   | 2026-02-19 | Step 2.9 DONE: Notification + Escalation — eventBus.ts TpmEvent + 5 Emitter, tpm-notification.service.ts (222 Z., Dual-Pattern ADR-004), tpm-escalation.service.ts (230 Z., @Cron 5min + FOR UPDATE SKIP LOCKED), tpm.module.ts (15/15 Services)                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 1.10.0  | 2026-02-19 | Step 2.10 DONE: Controllers Plans + Cards — tpm-plans.controller.ts (220 Z., 9 Endpoints), tpm-cards.controller.ts (186 Z., 6 Endpoints), 5 Query-DTOs (1 Klasse/Datei), tpm.module.ts (2/4 Controller). D12: check-duplicate Route geändert zu POST /cards/check-duplicate (body: planUuid) statt /cards/:uuid/check-duplicate                                                                                                                                                                                                                                                                                                                                  |
| 1.11.0  | 2026-02-19 | Step 2.11 DONE / PHASE 2 COMPLETE: tpm-executions.controller.ts (190 Z., 6 Endpoints), tpm-config.controller.ts (160 Z., 9 Endpoints), tpm-dashboard.service.ts (40 Z.), 2 neue DTOs (CreateExecution, ListExecutionsQuery). Integrations: notifications.controller.ts (5 TPM SSE Events + registerTpmHandlers()), dashboard.service.ts (fetchTpmCount), dashboard-counts.dto.ts (tpm: CountItemSchema), machine-availability.service.ts (createFromTpmPlan), machine-maintenance.service.ts (createFromTpmExecution), tpm-escalation.service.ts (getConfig + updateConfig + UPSERT). tpm.module.ts: 4/4 Controller, 16 Services. 4400 Tests, 0 ESLint/TS Errors |
| 1.11.1  | 2026-02-19 | ActivityEntityType-Fix: 3 neue Types (`tpm_plan`, `tpm_card`, `tpm_execution`) in `activity-logger.service.ts` hinzugefügt. 9 Logger-Calls in 4 Services gefixt (`'machine'` → feature-spezifisch). Ref: HOW-TO-INTEGRATE-FEATURE.md §2.7                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.12.0  | 2026-02-19 | Step 3.1 DONE: Unit Tests Plans + Config — 5 Testdateien, 81 Tests (tpm-plans.service 26, tpm-plans-interval.service 21, tpm-time-estimates.service 11, tpm-templates.service 13, tpm-color-config.service 10). ESLint 0, Type-Check 0, 4481 Tests gesamt                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1.13.0  | 2026-02-19 | Step 3.2 DONE: Unit Tests Cards + Cascade + Duplicate — 4 Testdateien, 88 Tests (tpm-cards.service 31, tpm-card-status.service 22, tpm-card-cascade.service 22, tpm-card-duplicate.service 13). State Machine komplett getestet, R1-Performance-Test (Batch-SQL für 2400 Karten), ILIKE-Escaping, Intervall-Order alle 8 Typen. ESLint 0, Type-Check 0, 4569 Tests gesamt |
| 1.14.0  | 2026-02-19 | Step 3.3 DONE: Unit Tests Slot Assistant + Executions + Approval — 3 Testdateien, 63 Tests (tpm-slot-assistant.service 20, tpm-executions.service 19, tpm-approval.service 24). Slot-Konflikte (4 Datenquellen), Execution-Lifecycle (Flow A/B, Foto-Limit), Approval-Chain (ConflictException, ForbiddenException, FOR UPDATE Lock, Activity Logger). ESLint 0, Type-Check 0, 4632 Tests gesamt |
| 1.15.0  | 2026-02-19 | Step 3.4 DONE / PHASE 3 COMPLETE: Unit Tests Notification + Escalation — 2 Testdateien, 46 Tests (tpm-notification.service 22, tpm-escalation.service 24). Dual-Pattern (EventBus + DB persistent notifications), vi.hoisted für Module-Level eventBus Mock, Cron-Escalation (isProcessing Guard, FOR UPDATE SKIP LOCKED, Startup Recovery, Team Lead Resolution), Config CRUD (getConfig defaults, updateConfig UPSERT), machineName-Fallback, Silent Error Catch. ESLint 0, Type-Check 0, 4678 Tests gesamt |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (alle Container healthy)
- [x] DB Backup erstellt (`full_backup_pre_tpm_20260218_222747.dump`)
- [x] Branch `feature/TPM` checked out
- [x] Keine pending Migrations (aktueller Stand: Migration 044 `tpm-config-and-feature`)
- [x] DATABASE-MIGRATION-GUIDE.md gelesen
- [x] brainstorming-TPM-Verification.md gelesen
- [x] Abhängige Features fertig: Machines ✅, Shifts ✅, Vacation ✅, Notifications ✅, Permission Registry ✅

### 0.2 Risk Register

| #   | Risiko                                                           | Impact  | Wahrscheinlichkeit | Mitigation                                                                    | Verifikation                                                               |
| --- | ---------------------------------------------------------------- | ------- | ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| R1  | Intervall-Kaskade: Jährlich fällig → 50+ Karten gleichzeitig ROT | Hoch    | Mittel             | Batch-SQL `UPDATE WHERE interval_order <= X` statt Einzelupdates              | Performance-Test mit 2400 Karten (20 Maschinen × 8 Intervalle × 15 Karten) |
| R2  | Slot-Assistant: 4 Datenquellen → langsame Abfrage                | Mittel  | Mittel             | Dedizierter Service mit optimierten JOINs, keine N+1 Queries                  | API-Response-Time < 500ms bei 20 Maschinen                                 |
| R3  | Schichtplan-Änderung NACH Wartungsplan → Inkonsistenz            | Hoch    | Hoch               | Event-basiert: Shift-Änderung → Check auf betroffene TPM-Pläne → Notification | Unit Test: Schichtplan-Änderung triggert Warnung                           |
| R4  | Card-Flip Animation: 50+ Karten gleichzeitig → Performance       | Niedrig | Mittel             | CSS `transform` ist GPU-beschleunigt. Lazy Loading pro Board-Sektion          | Browser-Performance-Test mit 60 Karten                                     |
| R5  | Custom Card Templates: JSONB Flexibilität vs. Typsicherheit      | Mittel  | Niedrig            | V1: Festes Schema + max 3 Custom-Felder (JSONB). V2: Template-Builder         | Zod-Validierung auf JSONB-Inhalt                                           |
| R6  | Cron-Eskalation: Race Condition bei Container-Restart            | Mittel  | Niedrig            | `FOR UPDATE SKIP LOCKED` + `isProcessing` Guard (Chat-Pattern)                | Unit Test: Paralleler Cron-Run → kein Duplikat                             |
| R7  | Foto-Upload bei Durchführung: Dateigröße, Storage                | Niedrig | Mittel             | Max 5 Fotos × 5MB = 25MB pro Execution. UUIDv7 Dateinamen                     | API-Test: Upload > 5MB → 413                                               |

### 0.3 Ecosystem Integration Points

| Bestehendes System              | Art der Integration                               | Phase | Verifiziert am |
| ------------------------------- | ------------------------------------------------- | ----- | -------------- |
| `machine_teams` + `user_teams`  | Zugriffskette Employee → Team → Machine           | 2     |                |
| `MachineAvailabilityService`    | `createFromTpmPlan()` — Auto-Status 'maintenance' | 2     |                |
| `ShiftsService`                 | Slot-Assistant liest Schichtpläne                 | 2     |                |
| `UserAvailabilityService`       | Slot-Assistant prüft Urlaub/Krank                 | 2     |                |
| `EventBus`                      | 5 neue typed Emit-Methoden für TPM-Events         | 2     |                |
| `NotificationsController` (SSE) | TPM Event-Handler registrieren                    | 2     |                |
| `NotificationFeatureService`    | Persistent Notifications für TPM                  | 2     |                |
| `PermissionRegistryService`     | TPM-Permission-Registrierung (ADR-020)            | 2     | 2026-02-19 ✅  |
| `TenantFeatureGuard`            | `@TenantFeature('tpm')` auf allen Controllern     | 2     |                |
| `navigation-config.ts`          | Lean Management → TPM Sidebar-Eintrag             | 5     |                |
| `Breadcrumb.svelte`             | TPM URL-Mappings + Intermediate + Dynamic Routes  | 5     |                |
| `notification.store.svelte.ts`  | `tpm: number` Counter + SSE Mapping               | 5     |                |
| `DashboardService`              | `fetchTpmCount()` in `fetchAllCounts()`           | 2     |                |
| `machine_maintenance_history`   | Bridge: TPM-Abschluss → History-Eintrag           | 2     |                |
| `ActivityLoggerService`         | Audit Trail für alle TPM-Mutationen               | 2     | 2026-02-19 ✅  |

---

## File Size Budget

> **Regel:** Jede Datei hat EIN klares Ziel. Wenn du mehr als 300 Zeilen brauchst, splitte.

### Backend — Neue Dateien (~30 Dateien)

```
backend/src/nest/tpm/                        ← Neues Modul
├── tpm.module.ts                            (~80 Zeilen)
├── tpm.types.ts                             (~200 Zeilen)
├── tpm.permissions.ts                       (~40 Zeilen)
├── tpm-permission.registrar.ts              (~15 Zeilen)
├── dto/
│   ├── index.ts                             (~25 Zeilen — Barrel Export)
│   ├── common.dto.ts                        (~50 Zeilen — Shared Schemas)
│   ├── create-maintenance-plan.dto.ts       (~40 Zeilen)
│   ├── update-maintenance-plan.dto.ts       (~30 Zeilen)
│   ├── create-card.dto.ts                   (~50 Zeilen)
│   ├── update-card.dto.ts                   (~30 Zeilen)
│   ├── complete-card.dto.ts                 (~30 Zeilen)
│   ├── respond-execution.dto.ts             (~25 Zeilen)
│   ├── create-time-estimate.dto.ts          (~30 Zeilen)
│   ├── update-escalation-config.dto.ts      (~25 Zeilen)
│   └── update-color-config.dto.ts           (~25 Zeilen)
├── tpm-plans.service.ts                     (~250 Zeilen — Plan CRUD)
├── tpm-plans-interval.service.ts            (~200 Zeilen — Intervall-Berechnung)
├── tpm-time-estimates.service.ts            (~150 Zeilen — SOLL-Zeit CRUD)
├── tpm-templates.service.ts                 (~150 Zeilen — Vorlagen CRUD)
├── tpm-color-config.service.ts              (~120 Zeilen — Farben CRUD)
├── tpm-cards.service.ts                     (~280 Zeilen — Karten CRUD)
├── tpm-card-status.service.ts               (~220 Zeilen — Status-Transitionen ROT/GRÜN/GELB)
├── tpm-card-cascade.service.ts              (~150 Zeilen — Intervall-Kaskade)
├── tpm-card-duplicate.service.ts            (~100 Zeilen — Duplikat-Erkennung)
├── tpm-slot-assistant.service.ts            (~250 Zeilen — 4-Datenquellen-Abfrage)
├── tpm-executions.service.ts                (~220 Zeilen — Durchführungs-CRUD)
├── tpm-approval.service.ts                  (~180 Zeilen — Freigabe/Ablehnung)
├── tpm-notification.service.ts              (~220 Zeilen — EventBus + DB Dual)
├── tpm-escalation.service.ts                (~150 Zeilen — @Cron Scheduler)
├── tpm-dashboard.service.ts                 (~100 Zeilen — Count für Dashboard)
├── tpm-plans.controller.ts                  (~200 Zeilen)
├── tpm-cards.controller.ts                  (~250 Zeilen)
├── tpm-executions.controller.ts             (~180 Zeilen)
└── tpm-config.controller.ts                 (~150 Zeilen)
```

### Backend — Geänderte Dateien

| Datei                                                        | Änderung                         | Phase |
| ------------------------------------------------------------ | -------------------------------- | ----- |
| `backend/src/nest/app.module.ts`                             | `TpmModule` Import               | 2     |
| `backend/src/utils/eventBus.ts`                              | 5 TPM Emit-Methoden + Interfaces | 2     |
| `backend/src/nest/notifications/notifications.controller.ts` | TPM SSE Handler                  | 2     |
| `backend/src/nest/dashboard/dashboard.service.ts`            | `fetchTpmCount()`                | 2     |
| `backend/src/nest/dashboard/dto/dashboard-counts.dto.ts`     | `tpm: CountItemSchema`           | 2     |
| `backend/src/nest/machines/machine-availability.service.ts`  | `createFromTpmPlan()`            | 2     |
| `backend/src/nest/machines/machine-maintenance.service.ts`   | Bridge: TPM → History            | 2     |

### Frontend — Neue Dateien (~35 Dateien)

```
frontend/src/routes/(app)/
├── (admin)/lean-management/tpm/
│   ├── +page.svelte                         (~300 Zeilen — Admin Dashboard)
│   ├── +page.server.ts                      (~80 Zeilen)
│   ├── _lib/
│   │   ├── api.ts                           (~120 Zeilen)
│   │   ├── types.ts                         (~150 Zeilen)
│   │   ├── constants.ts                     (~80 Zeilen)
│   │   ├── state.svelte.ts                  (~30 Zeilen — Re-Export)
│   │   ├── state-data.svelte.ts             (~80 Zeilen)
│   │   ├── state-ui.svelte.ts               (~60 Zeilen)
│   │   ├── PlanOverview.svelte              (~250 Zeilen)
│   │   ├── PlanTable.svelte                 (~200 Zeilen)
│   │   └── NextMaintenanceInfo.svelte       (~120 Zeilen)
│   ├── plan/[uuid]/
│   │   ├── +page.svelte                     (~250 Zeilen)
│   │   ├── +page.server.ts                  (~60 Zeilen)
│   │   └── _lib/
│   │       ├── PlanForm.svelte              (~250 Zeilen)
│   │       ├── SlotAssistant.svelte         (~200 Zeilen)
│   │       └── EmployeeAssignment.svelte    (~180 Zeilen)
│   ├── cards/[uuid]/
│   │   ├── +page.svelte                     (~200 Zeilen)
│   │   ├── +page.server.ts                  (~60 Zeilen)
│   │   └── _lib/
│   │       ├── CardForm.svelte              (~200 Zeilen)
│   │       ├── CardList.svelte              (~180 Zeilen)
│   │       └── DuplicateWarning.svelte      (~100 Zeilen)
│   └── config/
│       ├── +page.svelte                     (~200 Zeilen)
│       ├── +page.server.ts                  (~60 Zeilen)
│       └── _lib/
│           ├── ColorConfig.svelte           (~150 Zeilen)
│           ├── EscalationConfig.svelte      (~150 Zeilen)
│           └── TemplateManager.svelte       (~200 Zeilen)
└── (shared)/lean-management/tpm/
    ├── +page.svelte                         (~200 Zeilen — Employee Overview)
    ├── +page.server.ts                      (~80 Zeilen)
    ├── _lib/
    │   ├── api.ts                           (~80 Zeilen)
    │   ├── types.ts                         (~100 Zeilen)
    │   ├── MachineList.svelte               (~180 Zeilen)
    │   └── MaintenanceStatus.svelte         (~120 Zeilen)
    └── board/[uuid]/
        ├── +page.svelte                     (~300 Zeilen)
        ├── +page.server.ts                  (~80 Zeilen)
        └── _lib/
            ├── KamishibaiBoard.svelte       (~300 Zeilen)
            ├── KamishibaiSection.svelte     (~200 Zeilen)
            ├── KamishibaiCard.svelte        (~250 Zeilen)
            ├── CardFlip.svelte              (~100 Zeilen)
            ├── CardDetail.svelte            (~200 Zeilen)
            ├── ExecutionForm.svelte         (~200 Zeilen)
            ├── ApprovalPanel.svelte         (~150 Zeilen)
            ├── PhotoUpload.svelte           (~150 Zeilen)
            └── BoardFilter.svelte           (~120 Zeilen)
```

### Frontend — Geänderte Dateien

| Datei                                                              | Änderung                                                            | Phase |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- | ----- |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`              | `badgeType` Union + `'tpm'`, TPM NavItems in alle 3 Menüs           | 5     |
| `frontend/src/lib/components/Breadcrumb.svelte`                    | `urlMappings` + `intermediateBreadcrumbs` + `dynamicRoutes` für TPM | 5     |
| `frontend/src/lib/stores/notification.store.svelte.ts`             | `tpm: number` + SSE Mapping                                         | 5     |
| `frontend/src/routes/(app)/(admin)/shifts/_lib/WeekGrid.svelte`    | Toggle + TPM ⚙️-Blöcke in Grid-Cells (E17)                          | 5     |
| `frontend/src/routes/(app)/(admin)/shifts/_lib/api.ts`             | `fetchTpmMaintenanceDates()` API-Call                               | 5     |
| `frontend/src/routes/(app)/(admin)/shifts/_lib/state-ui.svelte.ts` | `showTpmEvents: boolean` Toggle-State                               | 5     |

### Database — Neue Dateien (4-5 Migrations)

| Datei                                                    | Inhalt                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| `database/migrations/XXXXXXXX_tpm-core-tables.ts`        | ENUMs + tpm_maintenance_plans + tpm_time_estimates      |
| `database/migrations/XXXXXXXX_tpm-card-tables.ts`        | tpm_card_templates + tpm_cards                          |
| `database/migrations/XXXXXXXX_tpm-execution-tables.ts`   | tpm_card_executions + tpm_card_execution_photos         |
| `database/migrations/XXXXXXXX_tpm-config-and-feature.ts` | tpm_escalation_config + tpm_color_config + Feature Flag |

---

## Phase 1: Database Migrations

> **Abhängigkeit:** Keine (erste Phase)
> **Letzte Migration:** `20260218000040_kvp-multi-team-machine.ts` → nächste ist 041+
> **MUST READ:** [DATABASE-MIGRATION-GUIDE.md](./DATABASE-MIGRATION-GUIDE.md)

### Mandatory Checklist pro Tabelle (Multi-Tenant!)

- [ ] `id SERIAL PRIMARY KEY` (SERIAL weil Audit-/Tracking-Tabellen, NICHT UUID PK)
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `uuid CHAR(36)` mit UUIDv7 (für API-Routen) — **Ausnahme:** Config-Tabellen ohne individuelle API-Routen (siehe Hinweis unten)
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS Policy mit `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON table TO app_user`
- [ ] `GRANT USAGE, SELECT ON SEQUENCE table_id_seq TO app_user`
- [ ] `is_active INTEGER NOT NULL DEFAULT 1` — **Ausnahme:** Config-/Photo-Tabellen mit CASCADE-Delete (siehe Hinweis unten)
- [ ] `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` + Trigger (siehe unten)
- [ ] `up()` UND `down()` implementiert
- [ ] Passende Indexes

### updated_at Trigger (EINMAL erstellen, auf alle Tabellen anwenden)

```sql
-- In der ERSTEN Migration erstellen (falls noch nicht vorhanden):
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Pro Tabelle mit updated_at anwenden:
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON <table_name>
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

Trigger muss auf JEDE Tabelle mit `updated_at` angewendet werden:
`tpm_maintenance_plans`, `tpm_time_estimates`, `tpm_card_templates`, `tpm_cards`, `tpm_card_executions`, `tpm_escalation_config`, `tpm_color_config` (7 von 8 Tabellen — `tpm_card_execution_photos` hat nur `created_at`).

### Checklist-Ausnahmen (bewusste Abweichungen)

| Tabelle                     | Kein `uuid` | Kein `is_active` | Begründung                                                                                  |
| --------------------------- | ----------- | ---------------- | ------------------------------------------------------------------------------------------- |
| `tpm_escalation_config`     | ✅          | ✅               | 1 Row pro Tenant, Zugriff via Tenant-Context, UPSERT statt Soft-Delete                      |
| `tpm_color_config`          | ✅          | ✅               | Zugriff via `(tenant_id, status_key)`, UPSERT/DELETE statt Soft-Delete, `resetToDefaults()` |
| `tpm_card_execution_photos` | —           | ✅               | CASCADE-Delete mit Execution, Fotos sind immutabel (nur `created_at`, kein `updated_at`)    |

---

### Step 1.1: Session 1 — TPM Core Tables [DONE]

**Migration:** `XXXXXXXX_tpm-core-tables.ts`

**Was passiert:**

1. ENUMs erstellen:

   ```sql
   CREATE TYPE tpm_interval_type AS ENUM (
     'daily', 'weekly', 'monthly', 'quarterly',
     'semi_annual', 'annual', 'long_runner', 'custom'
   );

   CREATE TYPE tpm_card_status AS ENUM (
     'green', 'red', 'yellow', 'overdue'
   );

   CREATE TYPE tpm_card_role AS ENUM (
     'operator', 'maintenance'
   );

   CREATE TYPE tpm_approval_status AS ENUM (
     'none', 'pending', 'approved', 'rejected'
   );
   ```

2. Tabelle `tpm_maintenance_plans`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `machine_id FK → machines(id)` — 1 Plan pro Maschine
   - `name VARCHAR(255)` — z.B. "Wartungsplan P17"
   - `base_weekday INTEGER` (0=Mo...6=So) — Basis-Wochentag
   - `base_repeat_every INTEGER DEFAULT 1` — z.B. "jeden 2. Donnerstag"
   - `base_time TIME` — Basis-Uhrzeit
   - `shift_plan_required BOOLEAN DEFAULT true` — E15: Schichtplan muss existieren
   - `notes TEXT`
   - `created_by FK → users(id)`, `is_active`, `created_at`, `updated_at`
   - UNIQUE: `(tenant_id, machine_id)` WHERE `is_active = 1`
   - Indexes: tenant_id, machine_id, is_active

3. Tabelle `tpm_time_estimates`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `plan_id FK → tpm_maintenance_plans(id) ON DELETE CASCADE`
   - `interval_type tpm_interval_type NOT NULL`
   - `staff_count INTEGER NOT NULL DEFAULT 1`
   - `preparation_minutes INTEGER NOT NULL DEFAULT 0`
   - `execution_minutes INTEGER NOT NULL DEFAULT 0`
   - `followup_minutes INTEGER NOT NULL DEFAULT 0`
   - `is_active`, `created_at`, `updated_at`
   - UNIQUE: `(plan_id, interval_type)` WHERE `is_active = 1`

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_maintenance_plans"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_time_estimates"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM pg_policies WHERE tablename LIKE 'tpm_%';"
```

---

### Step 1.2: Session 2 — TPM Card Tables [DONE]

**Migration:** `XXXXXXXX_tpm-card-tables.ts`

**Was passiert:**

1. Tabelle `tpm_card_templates`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `name VARCHAR(255)` — Template-Name
   - `description TEXT`
   - `default_fields JSONB NOT NULL DEFAULT '{}'` — Custom-Felder-Schema
   - `is_default BOOLEAN DEFAULT false` — System-Default oder Custom
   - `is_active`, `created_at`, `updated_at`

2. Tabelle `tpm_cards`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `plan_id FK → tpm_maintenance_plans(id) ON DELETE CASCADE`
   - `machine_id FK → machines(id)` — **Denormalisiert für Performance** (siehe ⚠️ unten)
   - `template_id FK → tpm_card_templates(id)` — Nullable
   - `card_code VARCHAR(10) NOT NULL` — z.B. "BT1", "IV13"
   - `card_role tpm_card_role NOT NULL` — operator | maintenance
   - `interval_type tpm_interval_type NOT NULL`
   - `interval_order INTEGER NOT NULL` — 1=daily...8=custom (für Kaskade)
   - `title VARCHAR(255) NOT NULL` — z.B. "Sichtprüfung"
   - `description TEXT` — Detaillierte Anleitung
   - `location_description TEXT` — Örtlichkeit (Text)
   - `location_photo_url VARCHAR(500)` — Örtlichkeit (Foto-URL)
   - `requires_approval BOOLEAN DEFAULT false` — E9: Freigabe-Pflicht
   - `status tpm_card_status NOT NULL DEFAULT 'green'`
   - `current_due_date DATE` — Wann ist die Karte aktuell fällig?
   - `last_completed_at TIMESTAMPTZ` — Wann zuletzt erledigt?
   - `last_completed_by FK → users(id)`
   - `sort_order INTEGER DEFAULT 0` — Reihenfolge auf dem Board
   - `custom_fields JSONB DEFAULT '{}'` — V1: max 3 Custom-Felder
   - `custom_interval_days INTEGER` — Nur bei interval_type='custom'
   - `is_active`, `created_by FK → users(id)`, `created_at`, `updated_at`
   - Indexes: (tenant_id, plan_id), (tenant_id, machine_id, status), (interval_order), (current_due_date)
   - CHECK: `(interval_type = 'custom' OR custom_interval_days IS NULL)` — Verhindert Daten-Müll (z.B. weekly-Karte mit custom_interval_days=45)

   **⚠️ Denormalisierung `machine_id`:** `tpm_cards.machine_id` ist eine bewusste Denormalisierung von `tpm_maintenance_plans.machine_id` für schnelle Board-Queries (`WHERE machine_id = X AND status = 'red'`). **Konsistenz wird im Service-Layer erzwungen:** `tpm-cards.service.ts:createCard()` setzt `machine_id` automatisch aus `plan.machine_id` — kein manuelles Setzen erlaubt. Der Wert wird NIEMALS direkt via API aktualisiert.

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_cards"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_card_templates"
```

---

### Step 1.3: Session 3 — TPM Execution + Config Tables + Feature Flag [DONE]

**Migration A:** `XXXXXXXX_tpm-execution-tables.ts`

1. Tabelle `tpm_card_executions`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `card_id FK → tpm_cards(id) ON DELETE CASCADE`
   - `executed_by FK → users(id)` — Wer hat erledigt?
   - `execution_date DATE NOT NULL`
   - `documentation TEXT` — Pflicht bei Freigabe-Karten
   - `approval_status tpm_approval_status NOT NULL DEFAULT 'none'`
   - `approved_by FK → users(id)` — Wer hat freigegeben?
   - `approved_at TIMESTAMPTZ`
   - `approval_note TEXT` — Kommentar bei Ablehnung
   - `custom_data JSONB DEFAULT '{}'`
   - `created_at`, `updated_at`
   - Index: (tenant_id, card_id, execution_date DESC)

2. Tabelle `tpm_card_execution_photos`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `execution_id FK → tpm_card_executions(id) ON DELETE CASCADE`
   - `file_path VARCHAR(500) NOT NULL`
   - `file_name VARCHAR(255) NOT NULL`
   - `file_size INTEGER NOT NULL`
   - `mime_type VARCHAR(100) NOT NULL`
   - `sort_order INTEGER DEFAULT 0`
   - `created_at` (kein `updated_at` — Fotos sind immutabel)
   - kein `is_active` — CASCADE-Delete mit Execution (siehe Checklist-Ausnahmen)
   - CHECK: `file_size <= 5242880` (5MB)
   - **Max 5 Fotos pro Execution:** Service-Level Enforcement in `tpm-executions.service.ts:addPhoto()` — `SELECT COUNT(*) ... >= 5 → BadRequestException`. Kein DB-Trigger nötig, da nur über Service-Layer zugänglich.

**Migration B:** `XXXXXXXX_tpm-config-and-feature.ts`

3. Tabelle `tpm_escalation_config`:
   - `id SERIAL PK`, `tenant_id FK` (UNIQUE)
   - `escalation_after_hours INTEGER NOT NULL DEFAULT 48` — Std. bis Eskalation
   - `notify_team_lead BOOLEAN DEFAULT true`
   - `notify_department_lead BOOLEAN DEFAULT false`
   - `created_at`, `updated_at`
   - UNIQUE: `(tenant_id)` — 1 Config pro Tenant

4. Tabelle `tpm_color_config`:
   - `id SERIAL PK`, `tenant_id FK`
   - `status_key VARCHAR(20) NOT NULL` — green, red, yellow, overdue
   - `color_hex VARCHAR(7) NOT NULL` — z.B. "#22c55e"
   - `label VARCHAR(50) NOT NULL` — z.B. "Erledigt"
   - `created_at`, `updated_at`
   - UNIQUE: `(tenant_id, status_key)`

5. Feature Flag:
   ```sql
   INSERT INTO features (code, name, description, category, base_price, is_active)
   VALUES ('tpm', 'TPM / Wartung', 'Total Productive Maintenance — Kamishibai Board, Wartungspläne, Intervall-Karten', 'enterprise', 0, 1)
   ON CONFLICT (code) DO NOTHING;
   ```

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_card_executions"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_escalation_config"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM features WHERE code = 'tpm';"
```

### Phase 1 — Definition of Done

- [x] 4 Migrationsdateien mit `up()` AND `down()` — 041, 042, 043, 044
- [x] Dry-Run bestanden: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [x] Alle Migrationen erfolgreich angewendet
- [x] 8 neue Tabellen + 4 ENUMs existieren
- [x] RLS Policies auf allen 8 Tabellen (8/8 verifiziert)
- [x] GRANTs für `app_user` auf allen Tabellen (32 GRANTs)
- [x] Feature 'tpm' in `features` Tabelle (id=14, enterprise)
- [x] Backend kompiliert fehlerfrei (type-check OK)
- [x] Bestehende Tests laufen weiterhin durch (4400/4400)
- [x] Backup vorhanden vor Migrationen (`full_backup_pre_tpm_20260218_222747.dump`)
- [x] `./scripts/sync-customer-migrations.sh` ausgeführt (45 Migrationen)
- [x] `pnpm run validate:all` ✅ (0 errors)
- [x] `pnpm test` ✅ (215 files, 4400 tests)

---

## Phase 2: Backend Module

> **Abhängigkeit:** Phase 1 complete
> **Referenz-Module:** `backend/src/nest/vacation/` (Approval), `backend/src/nest/kvp/` (Colors)

---

### Step 2.1: Session 4 — Module Skeleton + Types + Permissions [DONE]

**Ergebnis:** 5 Dateien erstellt, 1 modifiziert. Type-Check 0, ESLint 0, 3530 Tests bestanden.

1. `backend/src/nest/tpm/tpm.types.ts` (381 Zeilen — größer als Budget weil alle 8 Row-Typen + 8 API-Typen + 7 Constants)
   - 4 Enums: TpmIntervalType, TpmCardStatus, TpmCardRole, TpmApprovalStatus
   - 8 DB Row Interfaces (1:1 Migration-Mapping)
   - 8 API Response Interfaces (camelCase)
   - Constants: INTERVAL_ORDER_MAP, INTERVAL_LABELS, STATUS_LABELS, ROLE_LABELS, CARD_CODE_PREFIX, DEFAULT_COLORS, MAX_PHOTOS_PER_EXECUTION, MAX_PHOTO_FILE_SIZE

2. `backend/src/nest/tpm/tpm.permissions.ts` (39 Zeilen)
   - 4 Module: tpm-plans (RWD), tpm-cards (RWD), tpm-executions (RW), tpm-reports (R)

3. `backend/src/nest/tpm/tpm-permission.registrar.ts` (19 Zeilen)
   - OnModuleInit → registry.register(TPM_PERMISSIONS)

4. `backend/src/nest/tpm/tpm.module.ts` (inkrementell erweitert)
   - Imports: FeatureCheckModule

5. `backend/src/nest/app.module.ts` — TpmModule registriert

---

### Step 2.2: Session 5 — DTOs [DONE]

**Ergebnis:** 11 Dateien erstellt (+ 2 Template-DTOs nachgereicht in Session 7). Type-Check 0, ESLint 0, 3530 Tests bestanden.

Alle DTOs nutzen Zod + `createZodDto()` Pattern. 1 ESLint-Fix (`sonarjs/prefer-single-boolean-return` in update-card.dto.ts).

| DTO                               | Zeilen | Felder                                                                                                          | Validierung                                    |
| --------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `common.dto.ts`                   | 85     | UuidParam, Enums, Page/Limit, HexColor, Time, Weekday, Minutes, StaffCount                                      | Shared Schemas                                 |
| `create-maintenance-plan.dto.ts`  | 35     | machineUuid, name, baseWeekday(0-6), baseRepeatEvery(1-52), baseTime, shiftPlanRequired, notes                  | Weekday range, time HH:MM                      |
| `update-maintenance-plan.dto.ts`  | 35     | Alle Felder optional                                                                                            | Gleiche Constraints                            |
| `create-card.dto.ts`              | 67     | planUuid, cardRole, intervalType, title, description, locationDescription, requiresApproval, customIntervalDays | Cross-Field: customIntervalDays ↔ intervalType |
| `update-card.dto.ts`              | 70     | Alle Felder optional                                                                                            | Cross-Field: customIntervalDays ↔ intervalType |
| `complete-card.dto.ts`            | 24     | documentation?, customData                                                                                      | Service enforces mandatory docs                |
| `respond-execution.dto.ts`        | 39     | action('approved'\|'rejected'), approvalNote?                                                                   | Note required if rejected                      |
| `create-time-estimate.dto.ts`     | 28     | planUuid, intervalType, staffCount, preparationMinutes, executionMinutes, followupMinutes                       | All >= 0, staffCount >= 1                      |
| `update-escalation-config.dto.ts` | 19     | escalationAfterHours(1-720), notifyTeamLead, notifyDepartmentLead                                               | Hours range                                    |
| `update-color-config.dto.ts`      | 20     | statusKey, colorHex, label                                                                                      | Hex regex `/^#[\da-f]{6}$/i`                   |
| `create-template.dto.ts`          | 25     | name, description, defaultFields, isDefault                                                                     | (nachgereicht in Session 7)                    |
| `update-template.dto.ts`          | 26     | Alle Felder optional                                                                                            | (nachgereicht in Session 7)                    |
| `index.ts`                        | 66     | Barrel export aller DTOs + Schemas                                                                              | —                                              |

---

### Step 2.3: Session 6 — Plans Service + Interval Service [DONE]

**Ergebnis:** 3 Dateien erstellt (+ Helpers extrahiert). Type-Check 0, ESLint 0, 3530 Tests bestanden.

**Architektur-Entscheidungen:**

- Helpers-Datei extrahiert (`tpm-plans.helpers.ts`) — machines.helpers.ts Pattern
- `tenantTransaction()` für Mutationen, `db.query()` für Reads
- `FOR UPDATE` Lock bei update/delete (Race-Condition-Schutz)
- Activity Logging nach Transaction (fire-and-forget `void`)
- `exactOptionalPropertyTypes`-konform: optionale Properties nur bei vorhandenen JOIN-Daten gesetzt

1. `tpm-plans.service.ts` (235 Zeilen)
   - `createPlan(tenantId, userId, dto)` → INSERT + resolveMachineId + ensureNoPlanForMachine
   - `updatePlan(tenantId, userId, planUuid, dto)` → lockPlanByUuid + dynamic SET
   - `getPlan(tenantId, planUuid)` → SELECT mit Machine+User JOINs
   - `listPlans(tenantId, page, pageSize)` → Paginiert mit COUNT + JOINs
   - `deletePlan(tenantId, userId, planUuid)` → Soft-Delete (is_active=4)
   - `getPlanByMachineId(tenantId, machineId)` → Für Slot-Assistant (returns null)

2. `tpm-plans-interval.service.ts` (178 Zeilen)
   - `getNextOccurrence(weekday, repeatEvery, fromDate)` → Nächster passender Wochentag (TPM weekday → JS weekday Konvertierung)
   - `calculateIntervalDate(baseDate, intervalType, customDays?)` → daily/weekly/monthly/.../custom
   - `calculateNextDueDates(baseWeekday, baseRepeatEvery, fromDate, intervalTypes?, customDays?)` → Batch für alle Intervalle, sortiert nach Datum
   - Reine Logik, keine DB-Abhängigkeit, `@Injectable()` für DI

3. `tpm-plans.helpers.ts` (74 Zeilen — Bonus, nicht im Plan)
   - `TpmPlanJoinRow` Interface (erweitert Row um JOIN-Spalten)
   - `mapPlanRowToApi()` — snake_case → camelCase
   - `buildPlanUpdateFields()` — dynamischer SET-Clause Builder

---

### Step 2.4: Session 7 — Config Services (Time Estimates + Templates + Colors) [DONE]

**Ergebnis:** 3 Services + 2 nachgereichte Template-DTOs erstellt. Type-Check 0, ESLint 0, 3530 Tests bestanden.

**Architektur-Entscheidungen:**

- UPSERT Pattern (`INSERT ... ON CONFLICT DO UPDATE`) für Time Estimates + Color Config
- Default-Merge Pattern für Colors: DB-Overrides → Map, dann `DEFAULT_COLORS` als Fallback
- Soft-Delete (is_active=4) für Templates + Time Estimates
- Hard-DELETE für Color Config (resetToDefaults löscht echte Rows, getColors liefert dann Defaults)
- Computed `totalMinutes` = preparation + execution + followup (nicht in DB gespeichert)
- `FOR UPDATE` Lock bei Template-Updates (Race-Condition-Schutz)
- Template-DTOs nachgereicht (fehlten im Step 2.2 Plan)

1. `tpm-time-estimates.service.ts` (179 Zeilen)
   - `setEstimate(tenantId, dto)` → UPSERT mit `ON CONFLICT (plan_id, interval_type) WHERE is_active = 1`
   - `getEstimatesForPlan(tenantId, planUuid)` → JOIN auf plans für UUID-Auflösung
   - `getEstimateForInterval(tenantId, planUuid, intervalType)` → Einzeln (returns null)
   - `deleteEstimate(tenantId, estimateUuid)` → Soft-Delete (is_active=4)
   - Private: `resolvePlanId(client, tenantId, planUuid)` → UUID → ID

2. `tpm-templates.service.ts` (195 Zeilen)
   - `createTemplate(tenantId, dto)` → INSERT mit `JSON.stringify(dto.defaultFields)` für JSONB
   - `updateTemplate(tenantId, templateUuid, dto)` → Dynamic SET mit idx-Counter + FOR UPDATE Lock
   - `listTemplates(tenantId)` → WHERE is_active=1, ORDER BY is_default DESC, name ASC
   - `getTemplate(tenantId, templateUuid)` → NotFoundException wenn nicht gefunden
   - `deleteTemplate(tenantId, templateUuid)` → Soft-Delete (is_active=4)

3. `tpm-color-config.service.ts` (128 Zeilen)
   - `getColors(tenantId)` → Merge: DB-Rows als Map + DEFAULT_COLORS Fallback für ['green','red','yellow','overdue']
   - `updateColor(tenantId, dto)` → UPSERT: `ON CONFLICT (tenant_id, status_key) DO UPDATE`
   - `resetToDefaults(tenantId)` → `DELETE FROM tpm_color_config WHERE tenant_id = $1` + Return Defaults

4. `dto/create-template.dto.ts` (25 Zeilen — nachgereicht)
   - name, description?, defaultFields (Record<string, unknown>), isDefault

5. `dto/update-template.dto.ts` (26 Zeilen — nachgereicht)
   - Alle Felder optional

---

### Step 2.5: Session 8 — Cards Service + Card Status Service [DONE]

**Ergebnis:** 3 Dateien erstellt (+ Helpers extrahiert). Type-Check 0, ESLint 0, 4137 Tests bestanden.

**Architektur-Entscheidungen:**

- Helpers-Datei extrahiert (`tpm-cards.helpers.ts`) — `tpm-plans.helpers.ts` Pattern
- `machine_id` wird automatisch aus `plan.machine_id` gesetzt (Denormalisierung im Service erzwungen)
- `interval_order` wird automatisch aus `INTERVAL_ORDER_MAP` gesetzt
- `card_code` wird auto-generiert: Prefix (BT/IV) + Sequenznummer pro Plan+Rolle
- `sort_order` wird auto-inkrementiert pro Plan
- Card-Status-Service: Alle Methoden akzeptieren `PoolClient` für Transaction-Composability
- Status-State-Machine mit `VALID_TRANSITIONS` Map und `assertTransition()` Guard
- Methoden `approveCard`/`rejectCard` statt `resetCardAfterApproval`/`resetCardAfterRejection` (Intent > Implementierung)
- `executeCardInsert` als Private Helper extrahiert (ESLint max-lines-per-function: 60)
- `buildFilterClauses` als Module-Level Pure Function mit `addFilter` Closure (no-useless-assignment)

1. `tpm-cards.helpers.ts` (87 Zeilen)
   - `TpmCardJoinRow` Interface (erweitert TpmCardRow um JOIN-Spalten)
   - `mapCardRowToApi()` — snake_case → camelCase
   - `buildCardUpdateFields()` — dynamischer SET-Clause Builder

2. `tpm-cards.service.ts` (468 Zeilen — über Budget wegen Pagination-Infrastruktur + 8 Methoden)
   - `createCard(tenantId, dto, createdBy)` → INSERT + Auto-CardCode + Auto-MachineId
   - `updateCard(tenantId, userId, cardUuid, dto)` → FOR UPDATE + interval_order Rekalkulation
   - `getCard(tenantId, cardUuid)` → SELECT mit 5 JOINs (Plan, Machine, Template, 2× Users)
   - `listCardsForMachine(tenantId, machineUuid, filters)` → Paginiert + Filter (status, intervalType, cardRole)
   - `listCardsForPlan(tenantId, planUuid, filters)` → Paginiert + Filter
   - `deleteCard(tenantId, userId, cardUuid)` → Soft-Delete (is_active=4)
   - `getCardsByStatus(tenantId, status, pagination)` → Für Dashboard
   - Private: resolvePlanIds, generateCardCode, getNextSortOrder, lockCardByUuid, executeCardInsert, executePaginatedQuery

3. `tpm-card-status.service.ts` (176 Zeilen)
   - `setCardDue(client, tenantId, cardId, dueDate)` → green → red
   - `markCardCompleted(client, tenantId, cardId, userId)` → red/overdue → green (Flow A) ODER yellow (Flow B)
   - `markCardOverdue(client, tenantId, cardId)` → red → overdue
   - `approveCard(client, tenantId, cardId, executedBy)` → yellow → green
   - `rejectCard(client, tenantId, cardId)` → yellow → red
   - Private: lockCardById, assertTransition

---

### Step 2.6: Session 9 — Card Cascade + Duplicate Detection [DONE]

**Neue Dateien:**

1. `tpm-card-cascade.service.ts` (~150 Zeilen)
   - `triggerCascade(tenantId, machineId, triggerIntervalOrder, dueDate)` → Batch-UPDATE alle Karten mit `interval_order <= triggerIntervalOrder`
   - `getCascadePreview(tenantId, machineId, triggerIntervalOrder)` → Zeigt welche Karten betroffen wären (für UI-Preview)
   - `getIntervalOrder(intervalType)` → daily=1, weekly=2, ..., custom=8
   - SQL: `UPDATE tpm_cards SET status = 'red', current_due_date = $3 WHERE machine_id = $1 AND interval_order <= $2 AND status = 'green' AND is_active = 1`

2. `tpm-card-duplicate.service.ts` (~100 Zeilen)
   - `checkDuplicate(tenantId, machineId, title, intervalType)` → Sucht ähnliche Karten in kürzeren Intervallen
   - `findSimilarCards(tenantId, machineId, searchText)` → ILIKE-Suche
   - Return: `{ hasDuplicate: boolean, existingCards: TpmCard[] }`

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.7: Session 10 — Slot Availability Assistant [DONE]

**Neue Datei:**

`tpm-slot-assistant.service.ts` (~250 Zeilen)

**Methoden:**

- `getAvailableSlots(tenantId, machineId, startDate, endDate)` → Kombiniert 4 Datenquellen
- `checkSlotAvailability(tenantId, machineId, date, time)` → Boolean + Konflikte
- `getTeamAvailability(tenantId, teamId, date)` → Welche MA sind verfügbar?

**4 Datenquellen (via bestehende Services):**

1. `ShiftsService.findAll({ machineId, date })` → Maschine belegt?
2. `MachineAvailabilityService.getMachineAvailabilityForDateRange()` → Geplante Ausfallzeit?
3. `UserAvailabilityService.getUserAvailabilityBatch()` → MA im Urlaub/Krank?
4. `tpm_maintenance_plans` + `tpm_cards` → Schon geplante TPM-Slots?

**Abhängigkeiten:** ShiftsService, MachineAvailabilityService, UserAvailabilityService, DatabaseService

**E15-Validierung:** `validateShiftPlanExists(tenantId, machineId, date)` → Prüft ob Schichtplan für den Zeitraum existiert

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.8: Session 11 — Executions + Approval Services [DONE]

**Ergebnis:** 3 Dateien erstellt (+ Helpers extrahiert), 1 modifiziert. Type-Check 0, ESLint 0, 4400 Tests bestanden.

**Architektur-Entscheidungen:**

- Helpers-Datei extrahiert (`tpm-executions.helpers.ts`) — tpm-plans.helpers.ts / tpm-cards.helpers.ts Pattern
- `tenantTransaction()` für Mutationen, `db.query()` für Reads
- `FOR UPDATE` Lock bei Execution-Mutations (Race-Condition-Schutz bei parallelem Approve/Reject)
- `lockPendingExecution()` validiert `approval_status = 'pending'` → `ConflictException` bei Doppelbearbeitung
- Approval-Berechtigung: Team-Lead des Maschinen-Teams ODER Admin (`has_full_access = 1`)
- Activity Logging nach Transaction (fire-and-forget `void`) — `logCreate`/`logUpdate` mit entity `'machine'`
- Documentation-Pflicht bei `requires_approval=true` im Service-Layer validiert
- Photo-Limit (max 5) im Service-Layer enforced via `getPhotoCount()`
- `insertExecution` als Private Helper extrahiert (ESLint max-lines-per-function: 60)

1. `tpm-executions.helpers.ts` (78 Zeilen)
   - `TpmExecutionJoinRow` Interface (erweitert TpmCardExecutionRow um JOIN-Spalten)
   - `mapExecutionRowToApi()` — snake_case → camelCase
   - `mapPhotoRowToApi()` — Photo-Mapping

2. `tpm-executions.service.ts` (405 Zeilen — über Budget wegen 6 Public + 5 Private Methoden + Pagination)
   - `createExecution(tenantId, cardUuid, userId, dto)` → INSERT + Status-Update via CardStatusService
   - `getExecution(tenantId, executionUuid)` → SELECT mit Card+User JOINs
   - `listExecutionsForCard(tenantId, cardUuid, page, pageSize)` → Paginierte Historie
   - `listPendingApprovals(tenantId, page, pageSize)` → Alle pending Executions
   - `addPhoto(tenantId, executionUuid, fileData)` → Photo INSERT (max 5, enforced)
   - `getPhotos(tenantId, executionUuid)` → Photo LIST sorted by sort_order
   - Private: lockCardByUuid, lockExecutionByUuid, getPhotoCount, validateDocumentation, insertExecution

3. `tpm-approval.service.ts` (346 Zeilen — über Budget wegen Approval-Chain-Queries + resolveCardMachineId)
   - `approveExecution(tenantId, executionUuid, approverId, dto)` → Transaction + FOR UPDATE + yellow→green
   - `rejectExecution(tenantId, executionUuid, approverId, dto)` → Transaction + FOR UPDATE + yellow→red
   - `canUserApprove(tenantId, userId, cardId)` → Boolean: Team-Lead oder Admin?
   - Private: lockPendingExecution, validateApprover, fetchExecution, resolveCardMachineId
   - Pattern: 1:1 aus `vacation.service.ts:respondToRequest()`
   - Notification + History Bridge: wird in Step 2.9/2.11 angebunden

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check  # 0 Errors ✅
pnpm exec eslint backend/src/nest/tpm/           # 0 Errors ✅
pnpm test                                         # 215 files, 4400 tests ✅
```

---

### Step 2.9: Session 12 — Notification + Escalation Services [DONE]

**Neue Dateien:**

1. `tpm-notification.service.ts` (~220 Zeilen)
   - Dual-Pattern: EventBus (SSE) + DB (persistent)
   - `notifyMaintenanceDue(tenantId, card, assignedUsers)` → Karte ROT
   - `notifyMaintenanceOverdue(tenantId, card, teamLeadId)` → Eskalation
   - `notifyMaintenanceCompleted(tenantId, card, executedBy)` → Karte GRÜN/GELB
   - `notifyApprovalRequired(tenantId, card, execution, approverIds)` → Karte GELB
   - `notifyApprovalResult(tenantId, execution, approved)` → Freigabe/Ablehnung
   - Abhängigkeit: DatabaseService, eventBus

2. `tpm-escalation.service.ts` (~150 Zeilen)
   - `@Cron(CronExpression.EVERY_5_MINUTES, { timeZone: 'Europe/Berlin' })` — Alle 5 Min prüfen
   - `onModuleInit()` — Startup-Recovery
   - `processOverdueCards()` — `FOR UPDATE SKIP LOCKED` + `isProcessing` Guard
   - SQL: `SELECT * FROM tpm_cards WHERE status = 'red' AND current_due_date < NOW() - INTERVAL '${hours} hours'`
   - Pro überfällige Karte: `notifyMaintenanceOverdue()` + Status auf 'overdue'
   - Abhängigkeit: TpmNotificationService, TpmCardStatusService, DatabaseService

**Geänderte Dateien:**

3. `backend/src/utils/eventBus.ts` — 5 neue Emit-Methoden + TpmEvent Interfaces

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.10: Session 13 — Controllers (Plans + Cards) [DONE]

**Neue Dateien:**

1. `tpm-plans.controller.ts` (~220 Zeilen)

| Method | Route                              | Guard                | Beschreibung                                           |
| ------ | ---------------------------------- | -------------------- | ------------------------------------------------------ |
| POST   | `/tpm/plans`                       | canWrite(tpm-plans)  | Plan erstellen                                         |
| GET    | `/tpm/plans`                       | canRead(tpm-plans)   | Alle Pläne (paginiert)                                 |
| GET    | `/tpm/plans/:uuid`                 | canRead(tpm-plans)   | Einzelner Plan                                         |
| PATCH  | `/tpm/plans/:uuid`                 | canWrite(tpm-plans)  | Plan aktualisieren                                     |
| DELETE | `/tpm/plans/:uuid`                 | canDelete(tpm-plans) | Plan soft-deleten                                      |
| GET    | `/tpm/plans/:uuid/time-estimates`  | canRead(tpm-plans)   | Zeitschätzungen                                        |
| POST   | `/tpm/plans/:uuid/time-estimates`  | canWrite(tpm-plans)  | Zeitschätzung setzen                                   |
| GET    | `/tpm/plans/:uuid/available-slots` | canRead(tpm-plans)   | Slot-Assistant                                         |
| GET    | `/tpm/plans/:uuid/board`           | canRead(tpm-plans)   | Board-Daten (alle Karten einer Maschine via Plan-UUID) |

2. `tpm-cards.controller.ts` (~250 Zeilen)

| Method | Route                        | Guard                | Beschreibung                                            |
| ------ | ---------------------------- | -------------------- | ------------------------------------------------------- |
| POST   | `/tpm/cards`                 | canWrite(tpm-cards)  | Karte erstellen                                         |
| GET    | `/tpm/cards`                 | canRead(tpm-cards)   | Alle Karten (Filter: machineUuid, status, intervalType) |
| GET    | `/tpm/cards/:uuid`           | canRead(tpm-cards)   | Einzelne Karte                                          |
| PATCH  | `/tpm/cards/:uuid`           | canWrite(tpm-cards)  | Karte aktualisieren                                     |
| DELETE | `/tpm/cards/:uuid`           | canDelete(tpm-cards) | Karte soft-deleten                                      |
| POST   | `/tpm/cards/check-duplicate` | canRead(tpm-cards)   | Duplikat-Prüfung (D12: body statt :uuid)                |

Alle Controller: `@TenantFeature('tpm')` + `@RequirePermission(FEAT, MOD, ACTION)` pro Endpoint

**Ergebnis:** 4 Dateien erstellt (2 Controller + 5 Query-DTOs á 1 Klasse/Datei), 2 modifiziert (tpm.module.ts, dto/index.ts). Type-Check 0, ESLint 0, 4400 Tests bestanden.

**Architektur-Entscheidungen:**

- Separate Controller-Klassen `TpmPlansController` + `TpmCardsController` (je ein Base-Path: `tpm/plans`, `tpm/cards`)
- `@TenantFeature('tpm')` auf Klasse, `@RequirePermission()` pro Endpoint (KVP-Pattern, kein class-level UseGuards)
- 5 Query-DTOs in Einzeldateien (max-classes-per-file: 1 ESLint-Regel)
- D12: `check-duplicate` Route auf `POST /tpm/cards/check-duplicate` (body: `{ planUuid, title, intervalType }`) statt `POST /tpm/cards/:uuid/check-duplicate` — vermeidet UUID-Ambiguität, Plan-UUID im Body statt Path
- `buildFilters()` als Module-Level Pure Function — `exactOptionalPropertyTypes`-konform via `| undefined` in Parameter-Typ
- Slot-Assistant: Plan-UUID → `getPlan()` → `machineId` → `getAvailableSlots()` (kein direkter DB-Zugriff im Controller)
- Board-Endpoint nutzt `listCardsForPlan()` (nicht `listCardsForMachine()`) — Plan-UUID ist der natürliche Entry Point
- Cards-Liste: Fallthrough-Logik `machineUuid > planUuid > status`, sonst BadRequestException

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check  # 0 Errors ✅
pnpm exec eslint backend/src/nest/tpm/           # 0 Errors ✅
pnpm test                                         # 215 files, 4400 tests ✅
```

---

### Step 2.11: Session 14 — Controllers (Executions + Config) + Module Assembly + Integrations [DONE]

**Neue Dateien:**

1. `tpm-executions.controller.ts` (~180 Zeilen)

| Method | Route                               | Guard                    | Beschreibung          |
| ------ | ----------------------------------- | ------------------------ | --------------------- |
| POST   | `/tpm/executions`                   | canWrite(tpm-executions) | Durchführung melden   |
| GET    | `/tpm/executions/pending-approvals` | canRead(tpm-executions)  | Offene Freigaben      |
| GET    | `/tpm/executions/:uuid`             | canRead(tpm-executions)  | Einzelne Durchführung |
| POST   | `/tpm/executions/:uuid/respond`     | canWrite(tpm-executions) | Freigabe/Ablehnung    |
| POST   | `/tpm/executions/:uuid/photos`      | canWrite(tpm-executions) | Foto hochladen        |
| GET    | `/tpm/executions/:uuid/photos`      | canRead(tpm-executions)  | Fotos abrufen         |

2. `tpm-config.controller.ts` (~150 Zeilen)

| Method | Route                         | Guard                | Beschreibung        |
| ------ | ----------------------------- | -------------------- | ------------------- |
| GET    | `/tpm/config/escalation`      | canRead(tpm-plans)   | Eskalations-Config  |
| PATCH  | `/tpm/config/escalation`      | canWrite(tpm-plans)  | Eskalation anpassen |
| GET    | `/tpm/config/colors`          | canRead(tpm-cards)   | Farb-Config         |
| PATCH  | `/tpm/config/colors`          | canWrite(tpm-cards)  | Farbe ändern        |
| POST   | `/tpm/config/colors/reset`    | canWrite(tpm-cards)  | Farben auf Default  |
| GET    | `/tpm/config/templates`       | canRead(tpm-cards)   | Vorlagen            |
| POST   | `/tpm/config/templates`       | canWrite(tpm-cards)  | Vorlage erstellen   |
| PATCH  | `/tpm/config/templates/:uuid` | canWrite(tpm-cards)  | Vorlage ändern      |
| DELETE | `/tpm/config/templates/:uuid` | canDelete(tpm-cards) | Vorlage löschen     |

3. `tpm-dashboard.service.ts` (~100 Zeilen)
   - `getTpmCount(userId, tenantId)` → Ungelesene TPM-Notifications zählen

**Geänderte Dateien:**

4. `tpm.module.ts` — Alle Services + Controllers registrieren
5. `app.module.ts` — `TpmModule` Import
6. `notifications.controller.ts` — TPM SSE Handler registrieren
7. `dashboard.service.ts` — `fetchTpmCount()` in `fetchAllCounts()`
8. `dashboard-counts.dto.ts` — `tpm: CountItemSchema`
9. `machine-availability.service.ts` — `createFromTpmPlan()` Methode
10. `machine-maintenance.service.ts` — Bridge: TPM → History

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
# Backend neustarten und Endpoints testen:
doppler run -- docker-compose restart backend
curl -s http://localhost:3000/api/v2/tpm/plans | jq '.'
```

### Phase 2 — Definition of Done

- [x] `TpmModule` registriert in `app.module.ts` ✅ (Session 4)
- [x] 15 Services implementiert und injiziert (15/15 — Plans, PlanInterval, TimeEstimates, Templates, ColorConfig, PermissionRegistrar, Cards, CardStatus, CardCascade, CardDuplicate, SlotAssistant, Executions, Approval, Notification, Escalation)
- [x] 4 Controller mit 30 Endpoints total (4/4 — Plans 9, Cards 6, Executions 6, Config 9) ✅ (Session 13+14)
- [x] Permission Registrar registriert bei Module Init ✅ (Session 4)
- [x] `@TenantFeature('tpm')` auf allen Controllern ✅ (Session 13+14)
- [x] `db.tenantTransaction()` für alle tenant-scoped Mutations ✅ (Session 6-7, RLS-Audit-Fix in 1.7.1: 4 Methoden korrigiert)
- [x] KEIN Double-Wrapping (ADR-007) ✅
- [x] EventBus: 5 neue TPM Emit-Methoden ✅ (Session 12)
- [x] SSE-Handler für TPM registriert ✅ (Session 14, registerTpmHandlers())
- [x] Dashboard: TPM Count integriert ✅ (Session 14, fetchTpmCount + CountItemSchema)
- [x] Machine Availability: `createFromTpmPlan()` funktioniert ✅ (Session 14)
- [x] Machine Maintenance History: Bridge funktioniert ✅ (Session 14, createFromTpmExecution)
- [x] Alle DTOs nutzen Zod + `createZodDto()` ✅ (Session 5+7+14, 15 Dateien)
- [x] ESLint 0 Errors ✅ (durchgehend)
- [x] Type-Check 0 Errors ✅ (durchgehend)
- [x] `pnpm run validate:all` ✅ (ESLint container ajv Issue — lokal OK)
- [x] `pnpm test` ✅ (215 Dateien, 4400 Tests — durchgehend)

---

## Phase 3: Unit Tests

> **Abhängigkeit:** Phase 2 complete
> **Pattern:** `backend/src/nest/vacation/vacation.service.test.ts`

### Step 3.1: Session 15 — Tests Plans + Config Services [DONE]

**Ergebnis:** 5 Testdateien erstellt, 81 Tests. ESLint 0, Type-Check 0, 4481 Tests gesamt.

**Dateien (co-located, Projekt-Konvention):**

- `backend/src/nest/tpm/tpm-plans.service.test.ts` (26 Tests — getPlan, listPlans, getPlanByMachineId, createPlan, updatePlan, deletePlan)
- `backend/src/nest/tpm/tpm-plans-interval.service.test.ts` (21 Tests — getNextOccurrence, calculateIntervalDate alle 8 Typen, calculateNextDueDates)
- `backend/src/nest/tpm/tpm-time-estimates.service.test.ts` (11 Tests — setEstimate UPSERT, getEstimatesForPlan, getEstimateForInterval, deleteEstimate)
- `backend/src/nest/tpm/tpm-templates.service.test.ts` (13 Tests — listTemplates, getTemplate, createTemplate JSONB, updateTemplate FOR UPDATE, deleteTemplate)
- `backend/src/nest/tpm/tpm-color-config.service.test.ts` (10 Tests — getColors default-merge, updateColor UPSERT, resetToDefaults DELETE)

**Szenarien abgedeckt:** CRUD Happy Path, NotFoundException, ConflictException, FOR UPDATE Lock, Soft-Delete (is_active=4), UPSERT ON CONFLICT, UUIDv7-Generierung, Activity Logger Calls, Dynamic SET Clause, Default-Merge Pattern, UUID Trimming, Pagination Offset, Null-Handling

**Abweichung vom Plan:** Masterplan sagt `__tests__/` Verzeichnis — Projekt-Konvention ist co-located (90+ bestehende Tests). Co-located gewählt.

---

### Step 3.2: Session 16 — Tests Cards + Cascade + Duplicate [DONE]

**Ergebnis:** 4 Testdateien erstellt, 88 Tests. ESLint 0, Type-Check 0, 4569 Tests gesamt.

**Dateien (co-located, Projekt-Konvention):**

- `backend/src/nest/tpm/tpm-cards.service.test.ts` (31 Tests — getCard, listCardsForMachine/ForPlan/ByStatus, createCard auto-machineId/cardCode/intervalOrder/sortOrder, updateCard intervalOrder-recalc, deleteCard)
- `backend/src/nest/tpm/tpm-card-status.service.test.ts` (22 Tests — setCardDue green→red, markCardCompleted Flow A/B red+overdue, markCardOverdue, approveCard yellow→green, rejectCard yellow→red, alle ungültigen Transitionen, NotFoundException)
- `backend/src/nest/tpm/tpm-card-cascade.service.test.ts` (22 Tests — triggerCascade Batch-SQL/affectedCount/dueDateFormat, getCascadePreview, getIntervalOrder alle 8 Typen, Performance 2400 Karten < 500ms)
- `backend/src/nest/tpm/tpm-card-duplicate.service.test.ts` (13 Tests — checkDuplicate ILIKE/intervalOrder/escaping, findSimilarCards title+description, escapeLikePattern %, _, \)

**Szenarien abgedeckt:** State Machine (8 gültige + 6 ungültige Transitionen), CardCode-Generierung (BT/IV Prefix + Sequenznummer), Intervall-Kaskade (Batch-SQL, CTE mit RETURNING), Duplikat-Erkennung (ILIKE, Interval-Order-Filter, Special-Char-Escaping), Denormalisierung (machine_id auto-set), FOR UPDATE Lock, Soft-Delete, Activity Logger, Pagination, Performance R1-Mitigation

**Abweichung vom Plan:** Masterplan sagt `__tests__/` Verzeichnis — Projekt-Konvention ist co-located (Step 3.1 Pattern beibehalten). Test-Counts höher als geplant: 88 statt ~70.

---

### Step 3.3: Session 17 — Tests Slot Assistant + Executions + Approval [DONE]

**Neue Dateien:**

- `backend/src/nest/tpm/tpm-slot-assistant.service.test.ts` (20 Tests)
- `backend/src/nest/tpm/tpm-executions.service.test.ts` (19 Tests)
- `backend/src/nest/tpm/tpm-approval.service.test.ts` (24 Tests)

**Ergebnis:** 63 Tests, ESLint 0, Type-Check 0, 4632 Tests gesamt. Slot-Konflikte (4 Datenquellen, MAX_RANGE_DAYS=90, combined conflicts), Execution-Lifecycle (Flow A/B, documentation validation, Foto-Limit max 5, sort_order), Approval-Chain (ConflictException bei Doppel-Bearbeitung, ForbiddenException bei fehlender Berechtigung, FOR UPDATE Lock, Activity Logger, approve+reject full flow)

---

### Step 3.4: Session 18 — Tests Notification + Escalation [DONE]

**Ergebnis:** 2 Testdateien erstellt, 46 Tests. ESLint 0, Type-Check 0, 4678 Tests gesamt.

**Dateien (co-located, Projekt-Konvention):**

- `backend/src/nest/tpm/tpm-notification.service.test.ts` (22 Tests — notifyMaintenanceDue EventBus+DB per user, notifyMaintenanceOverdue escalation, notifyMaintenanceCompleted SSE-only, notifyApprovalRequired per approver, notifyApprovalResult approved/rejected, machineName fallback, silent error catch, UUIDv7, metadata JSON)
- `backend/src/nest/tpm/tpm-escalation.service.test.ts` (24 Tests — getConfig DB+defaults, updateConfig UPSERT/ON CONFLICT/tenantTransaction, handleEscalation candidates/FOR UPDATE SKIP LOCKED/markCardOverdue/notifyTeamLead/no team lead skip/isProcessing guard/error recovery/concurrent lock skip/continue on failure, onModuleInit startup recovery, resolveTeamLead SQL verification)

**Szenarien abgedeckt:** Dual-Notification (EventBus + DB persistent), vi.hoisted für Module-Level eventBus Mock, Cron-Escalation (isProcessing Guard, FOR UPDATE SKIP LOCKED, Startup Recovery via onModuleInit), Config CRUD (getConfig default fallback, updateConfig UPSERT), Team Lead Resolution (teams + machine_teams JOIN), machineName conditional spread, Silent Error Catch (fire-and-forget), Error Recovery (isProcessing reset in finally), Concurrent Instance Safety (SKIP LOCKED returns empty → skip card)

**Abweichung vom Plan:** Masterplan sagt `__tests__/` Verzeichnis — Projekt-Konvention ist co-located (Step 3.1-3.3 Pattern beibehalten). Test-Counts höher als geplant: 46 statt ~27.

### Phase 3 — Definition of Done

- [x] > = 220 Unit Tests total (278 actual: 81+88+63+46)
- [x] Alle Tests grün: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/tpm/`
- [x] Jeder ConflictException / BadRequestException Pfad abgedeckt
- [x] Intervall-Kaskade getestet (alle Levels)
- [x] Race Condition getestet (paralleler Approve, FOR UPDATE SKIP LOCKED)
- [x] Tenant-Isolation getestet
- [x] Coverage: Alle public Methoden haben mindestens 1 Test
- [x] `pnpm run validate:all` ✅
- [x] `pnpm test` ✅ (229 Dateien, 4678 Tests)

---

## Phase 4: API Integration Tests

> **Abhängigkeit:** Phase 3 complete
> **Pattern:** `backend/test/vacation.api.test.ts`

### Step 4.1: Session 19 — API Tests Plans + Cards [PENDING]

**Neue Datei:** `backend/test/tpm-plans.api.test.ts` (~20 Tests)

- Unauthenticated → 401
- Feature disabled → 403
- Plan CRUD (POST 201, GET 200, PATCH 200, DELETE 200)
- Plan Duplicate → 409
- Card CRUD (POST 201, GET 200, PATCH 200, DELETE 200)
- Card Board Data → 200 (korrekte Struktur)
- Duplicate Check → 200 (mit Warnung)
- Tenant-Isolation: Tenant A sieht nicht Tenant B

### Step 4.2: Session 20 — API Tests Executions + Config [PENDING]

**Neue Datei:** `backend/test/tpm-executions.api.test.ts` (~20 Tests)

- Execution erstellen → 201
- Approval → 200
- Rejection mit Note → 200
- Rejection ohne Note → 400
- Config CRUD (Escalation, Colors, Templates)
- Time Estimates CRUD
- Slot Assistant → 200 (korrekte Struktur)
- Feature-Flag-Gating: ohne 'tpm' → 403

### Phase 4 — Definition of Done

- [ ] > = 40 API Integration Tests
- [ ] Alle Tests grün
- [ ] Tenant-Isolation verifiziert
- [ ] Feature-Flag-Gating verifiziert
- [ ] Pagination verifiziert auf List-Endpoints
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

---

## Phase 5: Frontend

> **Abhängigkeit:** Phase 2 complete (Backend-Endpoints verfügbar)
> **Parallelisierbar:** Phase 5 kann ab Session 21 parallel zu Phase 3+4 (Unit/API Tests) laufen, da Frontend nur Backend-Endpoints braucht, nicht deren Tests.
> **Referenz:** `frontend/src/routes/(app)/(shared)/vacation/`

### Step 5.1: Session 21 — Admin Dashboard + Foundation [PENDING]

**Neue Dateien:**

- `(admin)/lean-management/tpm/+page.server.ts` — Auth + requireFeature + Data Loading
- `(admin)/lean-management/tpm/+page.svelte` — Admin Dashboard
- `(admin)/lean-management/tpm/_lib/api.ts` — apiClient Wrapper
- `(admin)/lean-management/tpm/_lib/types.ts` — TypeScript Interfaces
- `(admin)/lean-management/tpm/_lib/constants.ts` — Deutsche Labels
- `(admin)/lean-management/tpm/_lib/state.svelte.ts` — Re-Export Root
- `(admin)/lean-management/tpm/_lib/state-data.svelte.ts` — Data State ($state)
- `(admin)/lean-management/tpm/_lib/state-ui.svelte.ts` — UI State ($state)
- `(admin)/lean-management/tpm/_lib/PlanOverview.svelte` — Wartungsplanübersicht
- `(admin)/lean-management/tpm/_lib/NextMaintenanceInfo.svelte` — Info-Box

**Geänderte Dateien:**

- `navigation-config.ts`:
  - `badgeType` Union erweitern um `'tpm'` (Zeile 24-31)
  - Neues `TPM_SUBMENU: NavItem[]` Array (Admin: Übersicht + Karten + Konfiguration)
  - `LEAN_ADMIN_SUBMENU` erweitern: TPM-Eintrag mit `featureCode: 'tpm'` + `submenu: TPM_SUBMENU`
  - `employeeMenuItems` → LEAN-Management Submenu: TPM-Eintrag mit `url: '/lean-management/tpm'` + `badgeType: 'tpm'`
- `Breadcrumb.svelte`:
  - `urlMappings` erweitern: `/lean-management/tpm` ('TPM Wartung', 'fa-tools'), `/lean-management/tpm/config` ('TPM Konfiguration', 'fa-cog')
  - `intermediateBreadcrumbs` erweitern: Alle TPM-Subpages → Intermediate = 'TPM Wartung' → `/lean-management/tpm`
  - `dynamicRoutes` erweitern: `/lean-management/tpm/plan/[uuid]` ('Wartungsplan', 'fa-clipboard-list'), `/lean-management/tpm/cards/[uuid]` ('Karten', 'fa-th'), `/lean-management/tpm/board/[uuid]` ('Kamishibai Board', 'fa-columns')
  - `dynamicIntermediateBreadcrumbs` erweitern: Alle dynamischen TPM-Routen → Intermediate = 'TPM Wartung' → `/lean-management/tpm`
- `notification.store.svelte.ts` — `tpm: number` + SSE Mapping

---

### Step 5.2: Session 22 — Admin Plan Creation [PENDING]

**Neue Dateien:**

- `(admin)/lean-management/tpm/plan/[uuid]/+page.server.ts`
- `(admin)/lean-management/tpm/plan/[uuid]/+page.svelte`
- `plan/[uuid]/_lib/PlanForm.svelte` — Formular: Basis-Intervall, Wochentag, Uhrzeit
- `plan/[uuid]/_lib/SlotAssistant.svelte` — Freie Slots visualisieren
- `plan/[uuid]/_lib/EmployeeAssignment.svelte` — MA Multi-Select
- `(admin)/lean-management/tpm/_lib/PlanTable.svelte` — Tabelle: Alle Maschinen × Intervalle

---

### Step 5.3: Session 23 — Admin Card Management [PENDING]

**Neue Dateien:**

- `(admin)/lean-management/tpm/cards/[uuid]/+page.server.ts`
- `(admin)/lean-management/tpm/cards/[uuid]/+page.svelte`
- `cards/[uuid]/_lib/CardForm.svelte` — Karte erstellen/bearbeiten
- `cards/[uuid]/_lib/CardList.svelte` — Kartenliste pro Maschine
- `cards/[uuid]/_lib/DuplicateWarning.svelte` — Duplikat-Warnung Dialog

---

### Step 5.4: Session 24 — Shared Employee Overview + Board [PENDING]

**Neue Dateien:**

- `(shared)/lean-management/tpm/+page.server.ts` — Auth + requireFeature
- `(shared)/lean-management/tpm/+page.svelte` — Employee Maschinen-Übersicht
- `(shared)/lean-management/tpm/_lib/api.ts`
- `(shared)/lean-management/tpm/_lib/types.ts`
- `(shared)/lean-management/tpm/_lib/MachineList.svelte` — Zugewiesene Maschinen
- `(shared)/lean-management/tpm/_lib/MaintenanceStatus.svelte` — Status-Badges

---

### Step 5.5: Session 25 — Kamishibai Board [PENDING]

**Neue Dateien:**

- `(shared)/lean-management/tpm/board/[uuid]/+page.server.ts`
- `(shared)/lean-management/tpm/board/[uuid]/+page.svelte`
- `board/[uuid]/_lib/KamishibaiBoard.svelte` — Board-Container mit Sektionen
- `board/[uuid]/_lib/KamishibaiSection.svelte` — Eine Intervall-Sektion (z.B. "Wöchentlich Bediener")
- `board/[uuid]/_lib/KamishibaiCard.svelte` — Einzelne Karte mit Card-Flip
- `board/[uuid]/_lib/CardFlip.svelte` — CSS 3D Transform Component
- `board/[uuid]/_lib/BoardFilter.svelte` — Filter: Alle/Bediener/Instandhaltung/Nur Offene

---

### Step 5.6: Session 26 — Card Detail + Execution + Approval UI [PENDING]

**Neue Dateien:**

- `board/[uuid]/_lib/CardDetail.svelte` — Detailansicht einer Karte (Modal/Panel)
- `board/[uuid]/_lib/ExecutionForm.svelte` — Durchführung melden (Text + Fotos)
- `board/[uuid]/_lib/ApprovalPanel.svelte` — Freigabe/Ablehnung für Admin
- `board/[uuid]/_lib/PhotoUpload.svelte` — Foto-Upload Component (max 5 × 5MB)
- `board/[uuid]/_lib/TimeEstimateForm.svelte` — SOLL-Zeit anzeigen/bearbeiten

---

### Step 5.7: Session 27 — Config UI + Integration [PENDING]

**Neue Dateien:**

- `(admin)/lean-management/tpm/config/+page.server.ts`
- `(admin)/lean-management/tpm/config/+page.svelte`
- `config/_lib/ColorConfig.svelte` — Farb-Picker mit Hex-Validation
- `config/_lib/EscalationConfig.svelte` — Eskalations-Stunden + Notify-Toggles
- `config/_lib/TemplateManager.svelte` — Vorlagen CRUD

### Step 5.8: Session 28 — Shift-Grid TPM Wartungstermine Toggle [PENDING]

> **Entscheidung E17:** Shift-Modul bekommt Toggle für TPM-Wartungstermine im Wochen-Grid.
> **Abhängigkeit:** Phase 2 (Backend-Endpoints für TPM-Pläne verfügbar)
> **Pattern:** Machine Availability wird bereits als farbige Zellen im Shift-Grid angezeigt — TPM nutzt identisches Pattern.

**User Story:** Als Schichtplaner will ich beim Erstellen des Schichtplans sehen, wann TPM-Wartungen geplant sind, damit ich die Instandhaltungsschichten um die Wartungstermine herum planen kann.

**Visuelle Darstellung im Shift-Grid:**

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Schichtplan KW 08 / 2026                          │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Montag   │ Dienstag │ Mittwoch │Donnerstag│ Freitag  │   Samstag    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ FS 06-14 │ FS 06-14 │ FS 06-14 │ FS 06-14 │ FS 06-14 │              │
│          │┌────────┐│          │          │          │              │
│          ││⚙️ TPM   ││          │          │          │              │
│          ││Monatl. ││          │          │          │              │
│          ││P17     ││          │          │          │              │
│          ││09:15   ││          │          │          │              │
│          │└────────┘│          │          │          │              │
│ SS 14-22 │ SS 14-22 │ SS 14-22 │ SS 14-22 │ SS 14-22 │              │
│          │          │          │┌────────┐│          │              │
│          │          │          ││⚙️ TPM   ││          │              │
│          │          │          ││Viertlj.││          │              │
│          │          │          ││SP08    ││          │              │
│          │          │          ││07:00   ││          │              │
│          │          │          │└────────┘│          │              │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘
  [✓] Wartungstermine anzeigen    [✓] Machine Availability anzeigen
```

**TPM-Block im Grid-Cell zeigt:**

- ⚙️ Icon + "TPM" Label
- Intervall-Typ (Täglich, Wöchentlich, Monatlich, Vierteljährlich, ...)
- Maschinen-Name (z.B. "P17", "SP08")
- Geplante Uhrzeit
- Farbcodierung: gleiche Farben wie im Kamishibai Board (tenant-konfigurierbar via `tpm_color_config`)

**Geänderte Dateien:**

| Datei                                                              | Änderung                                                   | Zeilen |
| ------------------------------------------------------------------ | ---------------------------------------------------------- | ------ |
| `frontend/src/routes/(app)/(admin)/shifts/_lib/WeekGrid.svelte`    | Toggle-Checkbox + TPM-Blöcke in Grid-Cells rendern         | ~40    |
| `frontend/src/routes/(app)/(admin)/shifts/_lib/api.ts`             | `fetchTpmMaintenanceDates(machineIds, startDate, endDate)` | ~20    |
| `frontend/src/routes/(app)/(admin)/shifts/_lib/state-ui.svelte.ts` | `showTpmEvents: boolean` Toggle-State ($state)             | ~5     |

**Backend-Endpoint (bereits vorhanden nach Phase 2):**

- `GET /tpm/plans` mit Filter `?startDate=&endDate=` — liefert alle Pläne mit berechneten Terminen
- Kein neuer Backend-Code nötig — Frontend ruft bestehende Endpoints ab

**Verifikation:**

```bash
# Frontend lint + type check
cd frontend && pnpm exec svelte-check && pnpm exec eslint src/
```

---

### Phase 5 — Definition of Done

- [ ] Admin Dashboard rendert mit Wartungsplanübersicht
- [ ] Plan-Erstellung funktioniert (Basis-Intervall, Slot-Assistant)
- [ ] Karten-Management funktioniert (CRUD, Duplikat-Warnung)
- [ ] Employee sieht nur eigene Maschinen (Team-basiert)
- [ ] Kamishibai Board rendert mit allen Sektionen
- [ ] Card-Flip Animation funktioniert (ROT ↔ GRÜN)
- [ ] Freigabe-Flow funktioniert (ROT → GELB → GRÜN/ROT)
- [ ] Config-Seite funktioniert (Farben, Eskalation, Vorlagen)
- [ ] Svelte 5 Runes ($state, $derived, $effect) verwendet
- [ ] apiClient generic = DATA Shape (nicht Wrapper)
- [ ] svelte-check 0 Errors, 0 Warnings
- [ ] ESLint 0 Errors
- [ ] Navigation Config aktualisiert (Sidebar: alle 3 Rollen, badgeType 'tpm')
- [ ] Breadcrumb.svelte: Alle TPM-Routen gemappt (urlMappings + intermediate + dynamic)
- [ ] Notification Badge funktioniert
- [ ] Responsive Design (Mobile + Desktop)
- [ ] Deutsche Labels überall
- [ ] Shift-Grid: TPM Toggle funktioniert (⚙️-Blöcke mit Intervall, Maschine, Uhrzeit)
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

---

## Phase 6: Integration + Polish

> **Abhängigkeit:** Phase 5 complete

### Step 6.1: Session 29 — E2E + Polish + ADR [PENDING]

**Integrationen verifizieren:**

- [ ] Machine Availability: Auto-Status 'maintenance' bei aktivem Plan
- [ ] Shift-Grid: TPM ⚙️-Blöcke sichtbar wenn Toggle aktiv (implementiert in Session 28)
- [ ] Notification Badge: TPM-Counter im Sidebar
- [ ] SSE: Live-Updates bei Kartenänderungen
- [ ] Dashboard: TPM-Count in `/dashboard/counts`
- [ ] Audit Logging: Alle Mutationen geloggt
- [ ] Machine History Bridge: TPM-Abschluss → History-Eintrag
- [ ] Permission: Employee sieht nur eigene Maschinen, Admin RWX

**Dokumentation:**

- [ ] ADR schreiben: TPM Architecture (Interval Cascade, Card Status Machine, Slot Assistant)
- [ ] FEATURES.md aktualisiert
- [ ] Customer-Migrations synchronisiert: `./scripts/sync-customer-migrations.sh`

### Phase 6 — Definition of Done

- [ ] Alle Integrationen funktionieren end-to-end
- [ ] ADR geschrieben
- [ ] FEATURES.md aktualisiert
- [ ] Keine offenen TODOs im Code
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

---

## Session Tracking

| Session | Phase | Beschreibung                                                       | Status  | Datum      |
| ------- | ----- | ------------------------------------------------------------------ | ------- | ---------- |
| 1       | 1     | Migration: ENUMs + Plans + Time Estimates                          | DONE    | 2026-02-18 |
| 2       | 1     | Migration: Card Templates + Cards                                  | DONE    | 2026-02-18 |
| 3       | 1     | Migration: Executions + Photos + Config + Feature Flag             | DONE    | 2026-02-18 |
| 4       | 2     | Module Skeleton + Types + Permissions                              | DONE    | 2026-02-19 |
| 5       | 2     | DTOs (13 Dateien inkl. Template-DTOs)                              | DONE    | 2026-02-19 |
| 6       | 2     | Plans Service + Interval Service + Helpers                         | DONE    | 2026-02-19 |
| 7       | 2     | Config Services (Time Estimates + Templates + Colors)              | DONE    | 2026-02-19 |
| 8       | 2     | Cards Service + Card Status Service                                | DONE    | 2026-02-19 |
| 9       | 2     | Card Cascade + Duplicate Detection                                 | DONE    | 2026-02-19 |
| 10      | 2     | Slot Availability Assistant                                        | DONE    | 2026-02-19 |
| 11      | 2     | Executions + Approval Services                                     | DONE    | 2026-02-19 |
| 12      | 2     | Notification + Escalation Services + EventBus                      | DONE    | 2026-02-19 |
| 13      | 2     | Controllers (Plans + Cards)                                        | DONE    | 2026-02-19 |
| 14      | 2     | Controllers (Executions + Config) + Module Assembly + Integrations | DONE    | 2026-02-19 |
| 15      | 3     | Unit Tests — Plans + Config Services (81 Tests)                    | DONE    | 2026-02-19 |
| 16      | 3     | Unit Tests — Cards + Cascade + Duplicate (~70 Tests)               | PENDING |            |
| 17      | 3     | Unit Tests — Slot Assistant + Executions + Approval (~55 Tests)    | PENDING |            |
| 18      | 3     | Unit Tests — Notification + Escalation (~27 Tests)                 | PENDING |            |
| 19      | 4     | API Tests — Plans + Cards (~20 Tests)                              | PENDING |            |
| 20      | 4     | API Tests — Executions + Config (~20 Tests)                        | PENDING |            |
| 21      | 5     | Frontend: Admin Dashboard + Foundation                             | PENDING |            |
| 22      | 5     | Frontend: Admin Plan Creation                                      | PENDING |            |
| 23      | 5     | Frontend: Admin Card Management                                    | PENDING |            |
| 24      | 5     | Frontend: Shared Employee Overview                                 | PENDING |            |
| 25      | 5     | Frontend: Kamishibai Board                                         | PENDING |            |
| 26      | 5     | Frontend: Card Detail + Execution + Approval UI                    | PENDING |            |
| 27      | 5     | Frontend: Config UI + Final Integration                            | PENDING |            |
| 28      | 5     | Frontend: Shift-Grid TPM Wartungstermine Toggle (E17)              | PENDING |            |
| 29      | 6     | E2E Verification + Polish + ADR                                    | PENDING |            |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Kosten-/Ersatzteil-Tracking** — Kein Lagerbestand, keine Kosten pro Wartung. Spalte `cost` existiert in `machine_maintenance_history` für V2.
2. **Keine Prädiktive Wartung** — Kein Sensor-/Maschinenzähler-basiertes Triggering. Reine Kalenderberechnung. `machine_metrics` Tabelle existiert für V2.
3. **Kein OEE-Dashboard** — Keine Verfügbarkeit × Leistung × Qualität Berechnung. V2 mit `machine_metrics`.
4. **Kein Template-Builder** — V1: Festes Schema + max 3 JSONB Custom-Felder. V2: Drag-and-Drop Template-Builder.
5. **Keine Störmeldungen** — TPM V1 = nur geplante/präventive Wartung. Korrektive (reaktive) Wartung separat.
6. **Kein Offline-Modus** — Shopfloor braucht Netzwerk. V2: Service Worker + Offline Queue.
7. **Keine Maschinengruppen** — Karten sind pro Maschine, nicht pro Maschinentyp. Wenn 10 identische Maschinen → 10× gleiche Karten.

---

## Spec Deviations

| #   | Spec sagt                                   | Tatsächlicher Code          | Entscheidung                                                                                  |
| --- | ------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------- |
| D1  | `tpm.types.ts` ~200 Zeilen                  | 381 Zeilen                  | Alle 8 Row + 8 API Typen + 7 Constants → Überschreitung gerechtfertigt                        |
| D2  | `dto/index.ts` ~25 Zeilen                   | 66 Zeilen                   | 13 DTOs + Schemas → Barrel Export wächst proportional                                         |
| D3  | Kein `tpm-plans.helpers.ts` im Plan         | 74 Zeilen erstellt          | Extracted nach `machines.helpers.ts` Pattern — SRP                                            |
| D4  | `tpm-templates.service.ts` ~150 Zeilen      | 195 Zeilen                  | CRUD + Dynamic SET + FOR UPDATE → leicht über Budget                                          |
| D5  | `tpm-time-estimates.service.ts` ~150 Zeilen | 179 Zeilen                  | UPSERT + resolvePlanId Helper → leicht über Budget                                            |
| D6  | ActivityEntityType 'tpm_plan' erwartet      | Reuse 'machine' Entity-Type | Kein neues Entity-Type hinzugefügt — Plans gehören zu Maschinen                               |
| D7  | Template-DTOs in Step 2.2 geplant           | Nachgereicht in Step 2.4    | Im Plan vergessen, bei Bedarf erstellt                                                        |
| D8  | `tpm-cards.service.ts` ~280 Zeilen          | 468 Zeilen                  | 8 CRUD-Methoden + Pagination-Infrastruktur + 6 Private Helpers → Über Budget, aber alle SRP   |
| D9  | `resetCardAfterApproval/Rejection` Naming   | `approveCard`/`rejectCard`  | Intent-basiert statt Implementierung-basiert — klarer, kürzer                                 |
| D10 | `tpm-slot-assistant.service.ts` ~250 Zeilen | 486 Zeilen                  | 4 Datenquellen × je 1 Query + 3 Pure Helpers + 7 Interface-Types → Komplexität gerechtfertigt |
| D11 | Slot Assistant nutzt bestehende Services    | Direkte DB-Queries          | Vermeidet cross-module Imports (Machines/Users/Shifts) → TpmModule bleibt self-contained      |
| D12 | check-duplicate: GET /cards/:uuid/...       | POST /cards/check-duplicate | Body mit planUuid statt URL-Param — semantisch korrekt (kein idempotenter GET)                |
| D13 | `tpm-dashboard.service.ts` ~100 Zeilen      | 40 Zeilen                   | Nur 1 Methode (getUnreadCount) — einfacher als geplant, kein Padding nötig                    |

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- (wird nach Abschluss ausgefüllt)

### Was lief schlecht

- (wird nach Abschluss ausgefüllt)

### Metriken

| Metrik                    | Geplant | Tatsächlich (Stand Session 14)                                           |
| ------------------------- | ------- | ------------------------------------------------------------------------ |
| Sessions                  | 29      | 15 / 29 (52%) — Phase 3 begonnen                                         |
| Migrationsdateien         | 4       | 4 ✅                                                                     |
| Neue Backend-Dateien      | ~30     | 30 / ~30 (100%) — Phase 2 Backend fertig                                 |
| Neue Frontend-Dateien     | ~35     | 0 / ~35                                                                  |
| Geänderte Dateien         | ~10     | 10 (app.module, notifications, dashboard, machines, tpm-escalation etc.) |
| Unit Tests                | 220+    | 81 / 220+ (37%) — Step 3.1 done                                          |
| API Tests                 | 40+     | 0 (Phase 4)                                                              |
| ESLint Errors bei Release | 0       | 0 ✅ (durchgehend)                                                       |
| Spec Deviations           | 0       | 13 (alle akzeptabel)                                                     |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste PENDING Item, und markiert es als DONE.**
