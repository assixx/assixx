# FEAT: TPM (Total Productive Maintenance) — Execution Masterplan

> **Created:** 2026-02-18
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feature/TPM`
> **Spec:** [brainstorming-TPM.md](./brainstorming-TPM.md)
> **Context:** [TPM-ECOSYSTEM-CONTEXT.md](./TPM-ECOSYSTEM-CONTEXT.md)
> **Verification:** [brainstorming-TPM-Verification.md](./brainstorming-TPM-Verification.md)
> **Author:** SCS + Claude (Senior Engineer)
> **Estimated Sessions:** 25
> **Actual Sessions:** 0 / 25

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

| Version | Datum      | Änderung                                      |
| ------- | ---------- | --------------------------------------------- |
| 0.1.0   | 2026-02-18 | Initial Draft — 6 Phasen, 25 Sessions geplant |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `feature/TPM` checked out
- [ ] Keine pending Migrations (aktueller Stand: Migration 040 `kvp-multi-team-machine`)
- [ ] DATABASE-MIGRATION-GUIDE.md gelesen
- [ ] brainstorming-TPM-Verification.md gelesen
- [ ] Abhängige Features fertig: Machines ✅, Shifts ✅, Vacation ✅, Notifications ✅, Permission Registry ✅

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
| `PermissionRegistryService`     | TPM-Permission-Registrierung (ADR-020)            | 2     |                |
| `TenantFeatureGuard`            | `@TenantFeature('tpm')` auf allen Controllern     | 2     |                |
| `navigation-config.ts`          | Lean Management → TPM Sidebar-Eintrag             | 5     |                |
| `Breadcrumb.svelte`             | TPM URL-Mappings + Intermediate + Dynamic Routes  | 5     |                |
| `notification.store.svelte.ts`  | `tpm: number` Counter + SSE Mapping               | 5     |                |
| `DashboardService`              | `fetchTpmCount()` in `fetchAllCounts()`           | 2     |                |
| `machine_maintenance_history`   | Bridge: TPM-Abschluss → History-Eintrag           | 2     |                |
| `ActivityLoggerService`         | Audit Trail für alle TPM-Mutationen               | 2     |                |

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

| Datei                                                  | Änderung                                                       | Phase |
| ------------------------------------------------------ | -------------------------------------------------------------- | ----- |
| `frontend/src/routes/(app)/_lib/navigation-config.ts`  | `badgeType` Union + `'tpm'`, TPM NavItems in alle 3 Menüs      | 5     |
| `frontend/src/lib/components/Breadcrumb.svelte`        | `urlMappings` + `intermediateBreadcrumbs` + `dynamicRoutes` für TPM | 5     |
| `frontend/src/lib/stores/notification.store.svelte.ts` | `tpm: number` + SSE Mapping                                    | 5     |

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
- [ ] `uuid CHAR(36)` mit UUIDv7 (für API-Routen)
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS Policy mit `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON table TO app_user`
- [ ] `GRANT USAGE, SELECT ON SEQUENCE table_id_seq TO app_user`
- [ ] `is_active INTEGER NOT NULL DEFAULT 1`
- [ ] `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` + Trigger
- [ ] `up()` UND `down()` implementiert
- [ ] Passende Indexes

---

### Step 1.1: Session 1 — TPM Core Tables [PENDING]

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

### Step 1.2: Session 2 — TPM Card Tables [PENDING]

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
   - `machine_id FK → machines(id)` — Denormalisiert für Performance
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

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_cards"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_card_templates"
```

---

### Step 1.3: Session 3 — TPM Execution + Config Tables + Feature Flag [PENDING]

**Migration A:** `XXXXXXXX_tpm-execution-tables.ts`

1. Tabelle `tpm_card_executions`:
   - `id SERIAL PK`, `uuid CHAR(36)`, `tenant_id FK`
   - `card_id FK → tpm_cards(id) ON DELETE CASCADE`
   - `executed_by FK → users(id)` — Wer hat erledigt?
   - `execution_date DATE NOT NULL`
   - `documentation TEXT` — Pflicht bei Freigabe-Karten
   - `approval_status VARCHAR(20) DEFAULT 'none'` — none | pending | approved | rejected
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
   - `created_at`
   - CHECK: `file_size <= 5242880` (5MB)

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
   VALUES ('tpm', 'TPM / Wartung', 'Total Productive Maintenance — Kamishibai Board, Wartungspläne, Intervall-Karten', 'lean_management', 0, 1)
   ON CONFLICT (code) DO NOTHING;
   ```

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_card_executions"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_escalation_config"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT * FROM features WHERE code = 'tpm';"
```

### Phase 1 — Definition of Done

- [ ] 4 Migrationsdateien mit `up()` AND `down()`
- [ ] Dry-Run bestanden: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] Alle Migrationen erfolgreich angewendet
- [ ] 8 neue Tabellen + 3 ENUMs existieren
- [ ] RLS Policies auf allen 8 Tabellen (8/8 verifiziert)
- [ ] GRANTs für `app_user` auf allen Tabellen
- [ ] Feature 'tpm' in `features` Tabelle
- [ ] Backend kompiliert fehlerfrei
- [ ] Bestehende Tests laufen weiterhin durch
- [ ] Backup vorhanden vor Migrationen
- [ ] `./scripts/sync-customer-migrations.sh` ausgeführt
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

---

## Phase 2: Backend Module

> **Abhängigkeit:** Phase 1 complete
> **Referenz-Module:** `backend/src/nest/vacation/` (Approval), `backend/src/nest/kvp/` (Colors)

---

### Step 2.1: Session 4 — Module Skeleton + Types + Permissions [PENDING]

**Neue Dateien:**

1. `backend/src/nest/tpm/tpm.types.ts` (~200 Zeilen)
   - Alle DB Row Interfaces (TpmMaintenancePlanRow, TpmCardRow, TpmCardExecutionRow, etc.)
   - Alle API Response Interfaces (TpmPlan, TpmCard, TpmCardExecution, etc.)
   - Interval-Order Mapping
   - Card-Code Generation Utility Types

2. `backend/src/nest/tpm/tpm.permissions.ts` (~40 Zeilen)
   - `TPM_PERMISSIONS: PermissionCategoryDef` mit 4 Modulen:
     - `tpm-plans` (canRead, canWrite, canDelete)
     - `tpm-cards` (canRead, canWrite, canDelete)
     - `tpm-executions` (canRead, canWrite)
     - `tpm-reports` (canRead)

3. `backend/src/nest/tpm/tpm-permission.registrar.ts` (~15 Zeilen)
   - `VacationPermissionRegistrar` Pattern: OnModuleInit → register()

4. `backend/src/nest/tpm/tpm.module.ts` (~80 Zeilen)
   - Imports: FeatureCheckModule
   - Providers: Registrar + alle Services (zunächst leer, wird Session für Session gefüllt)
   - Controllers: (zunächst leer)

5. Registrierung in `backend/src/nest/app.module.ts`

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.2: Session 5 — DTOs [PENDING]

**Neue Dateien:** 11 DTO-Dateien in `backend/src/nest/tpm/dto/`

Alle DTOs nutzen Zod + `createZodDto()` Pattern.

| DTO                               | Felder                                                                                                          | Validierung                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `common.dto.ts`                   | UuidParam, PaginationQuery, IntervalTypeParam                                                                   | Shared Schemas                             |
| `create-maintenance-plan.dto.ts`  | machineUuid, name, baseWeekday(0-6), baseRepeatEvery(1-4), baseTime, shiftPlanRequired, notes                   | Weekday range, time format                 |
| `update-maintenance-plan.dto.ts`  | Partial of create                                                                                               | .partial()                                 |
| `create-card.dto.ts`              | planUuid, cardRole, intervalType, title, description, locationDescription, requiresApproval, customIntervalDays | intervalType+customIntervalDays Validation |
| `update-card.dto.ts`              | Partial of create                                                                                               | .partial()                                 |
| `complete-card.dto.ts`            | documentation?, photos? (multipart)                                                                             | Required if card.requires_approval         |
| `respond-execution.dto.ts`        | action('approved'\|'rejected'), responseNote?                                                                   | Note required if rejected                  |
| `create-time-estimate.dto.ts`     | planUuid, intervalType, staffCount, prepMinutes, execMinutes, followupMinutes                                   | All >= 0                                   |
| `update-escalation-config.dto.ts` | escalationAfterHours(1-720), notifyTeamLead, notifyDepartmentLead                                               | Hours range                                |
| `update-color-config.dto.ts`      | statusKey, colorHex, label                                                                                      | Hex regex `/^#[0-9a-f]{6}$/i`              |
| `index.ts`                        | Barrel export                                                                                                   | —                                          |

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.3: Session 6 — Plans Service + Interval Service [PENDING]

**Neue Dateien:**

1. `tpm-plans.service.ts` (~250 Zeilen)
   - `createPlan(tenantId, dto, createdBy)` → INSERT + UNIQUE check
   - `updatePlan(tenantId, planUuid, dto)` → UPDATE
   - `getPlan(tenantId, planUuid)` → SELECT mit Machine-Info JOIN
   - `listPlans(tenantId, pagination, filters)` → Paginiert, mit Machine-Name + nächste Wartung
   - `deletePlan(tenantId, planUuid)` → Soft-Delete (is_active=4)
   - `getPlanByMachineId(tenantId, machineId)` → Für Slot-Assistant
   - Abhängigkeit: `DatabaseService`

2. `tpm-plans-interval.service.ts` (~200 Zeilen)
   - `calculateNextDueDates(plan, fromDate)` → Berechnet alle Intervall-Termine aus Basis-Wochentag
   - `getNextOccurrence(weekday, repeatEvery, fromDate)` → Nächster passender Wochentag
   - `calculateIntervalDate(baseDate, intervalType)` → Monthly, Quarterly, etc.
   - Reine Logik, keine DB-Abhängigkeit

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.4: Session 7 — Config Services (Time Estimates + Templates + Colors) [PENDING]

**Neue Dateien:**

1. `tpm-time-estimates.service.ts` (~150 Zeilen)
   - `setEstimate(tenantId, dto)` → UPSERT (ON CONFLICT UPDATE)
   - `getEstimatesForPlan(tenantId, planId)` → Alle Intervalle eines Plans
   - `getEstimateForInterval(tenantId, planId, intervalType)` → Einzeln
   - `deleteEstimate(tenantId, estimateUuid)` → DELETE

2. `tpm-templates.service.ts` (~150 Zeilen)
   - `createTemplate(tenantId, dto, createdBy)` → INSERT
   - `updateTemplate(tenantId, uuid, dto)` → UPDATE
   - `listTemplates(tenantId)` → Alle (inkl. Defaults)
   - `getTemplate(tenantId, uuid)` → Einzeln
   - `deleteTemplate(tenantId, uuid)` → Soft-Delete

3. `tpm-color-config.service.ts` (~120 Zeilen)
   - `getColors(tenantId)` → Alle Status-Farben (mit Defaults als Fallback)
   - `updateColor(tenantId, dto)` → UPSERT
   - `resetToDefaults(tenantId)` → DELETE alle Custom-Farben
   - Default: green=#22c55e, red=#ef4444, yellow=#eab308, overdue=#dc2626

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.5: Session 8 — Cards Service + Card Status Service [PENDING]

**Neue Dateien:**

1. `tpm-cards.service.ts` (~280 Zeilen)
   - `createCard(tenantId, dto, createdBy)` → INSERT + Auto-CardCode
   - `updateCard(tenantId, cardUuid, dto)` → UPDATE
   - `getCard(tenantId, cardUuid)` → SELECT mit Plan+Machine JOINs
   - `listCardsForMachine(tenantId, machineUuid, filters)` → Alle Karten einer Maschine
   - `listCardsForPlan(tenantId, planUuid, filters)` → Alle Karten eines Plans
   - `deleteCard(tenantId, cardUuid)` → Soft-Delete
   - `generateCardCode(tenantId, planId, cardRole, intervalType)` → "BT1", "IV13" etc.
   - `getCardsByStatus(tenantId, status, pagination)` → Für Dashboard

2. `tpm-card-status.service.ts` (~220 Zeilen)
   - `setCardDue(tenantId, cardId, dueDate)` → green → red
   - `markCardCompleted(tenantId, cardUuid, userId, dto)` → red → green (Flow A) ODER red → yellow (Flow B)
   - `markCardOverdue(cardId)` → red → overdue (Cron)
   - `resetCardAfterRejection(tenantId, cardUuid)` → yellow → red
   - `resetCardAfterApproval(tenantId, cardUuid)` → yellow → green
   - Alle Transitionen mit Timestamp + User in `tpm_card_executions`

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.6: Session 9 — Card Cascade + Duplicate Detection [PENDING]

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

### Step 2.7: Session 10 — Slot Availability Assistant [PENDING]

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

### Step 2.8: Session 11 — Executions + Approval Services [PENDING]

**Neue Dateien:**

1. `tpm-executions.service.ts` (~220 Zeilen)
   - `createExecution(tenantId, cardUuid, userId, dto)` → INSERT + Status-Update
   - `getExecution(tenantId, executionUuid)` → SELECT mit Card+User JOINs
   - `listExecutionsForCard(tenantId, cardUuid, pagination)` → Historie
   - `listPendingApprovals(tenantId, userId)` → Alle GELB-Karten die der User freigeben kann
   - `addPhoto(tenantId, executionUuid, fileData)` → Photo INSERT (max 5)
   - `getPhotos(tenantId, executionUuid)` → Photo LIST
   - Abhängigkeit: TpmCardStatusService, DatabaseService

2. `tpm-approval.service.ts` (~180 Zeilen)
   - `approveExecution(tenantId, executionUuid, approverId, dto)` → Transaction + FOR UPDATE Lock
   - `rejectExecution(tenantId, executionUuid, approverId, dto)` → Transaction + FOR UPDATE Lock
   - `canUserApprove(tenantId, userId, cardId)` → Prüft: Team-Lead, Deputy-Lead, oder Admin?
   - Pattern: 1:1 aus `vacation.service.ts:respondToRequest()`
   - Post-Transaction: `tpmNotificationService.notifyApprovalResult()`
   - Bridge: Bei Approval → Eintrag in `machine_maintenance_history`

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.9: Session 12 — Notification + Escalation Services [PENDING]

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

### Step 2.10: Session 13 — Controllers (Plans + Cards) [PENDING]

**Neue Dateien:**

1. `tpm-plans.controller.ts` (~200 Zeilen)

| Method | Route                              | Guard                | Beschreibung           |
| ------ | ---------------------------------- | -------------------- | ---------------------- |
| POST   | `/tpm/plans`                       | canWrite(tpm-plans)  | Plan erstellen         |
| GET    | `/tpm/plans`                       | canRead(tpm-plans)   | Alle Pläne (paginiert) |
| GET    | `/tpm/plans/:uuid`                 | canRead(tpm-plans)   | Einzelner Plan         |
| PATCH  | `/tpm/plans/:uuid`                 | canWrite(tpm-plans)  | Plan aktualisieren     |
| DELETE | `/tpm/plans/:uuid`                 | canDelete(tpm-plans) | Plan soft-deleten      |
| GET    | `/tpm/plans/:uuid/time-estimates`  | canRead(tpm-plans)   | Zeitschätzungen        |
| POST   | `/tpm/plans/:uuid/time-estimates`  | canWrite(tpm-plans)  | Zeitschätzung setzen   |
| GET    | `/tpm/plans/:uuid/available-slots` | canRead(tpm-plans)   | Slot-Assistant         |

2. `tpm-cards.controller.ts` (~250 Zeilen)

| Method | Route                              | Guard                | Beschreibung                                            |
| ------ | ---------------------------------- | -------------------- | ------------------------------------------------------- |
| POST   | `/tpm/cards`                       | canWrite(tpm-cards)  | Karte erstellen                                         |
| GET    | `/tpm/cards`                       | canRead(tpm-cards)   | Alle Karten (Filter: machineUuid, status, intervalType) |
| GET    | `/tpm/cards/:uuid`                 | canRead(tpm-cards)   | Einzelne Karte                                          |
| PATCH  | `/tpm/cards/:uuid`                 | canWrite(tpm-cards)  | Karte aktualisieren                                     |
| DELETE | `/tpm/cards/:uuid`                 | canDelete(tpm-cards) | Karte soft-deleten                                      |
| GET    | `/tpm/cards/:uuid/board`           | canRead(tpm-cards)   | Board-Daten für eine Maschine                           |
| POST   | `/tpm/cards/:uuid/check-duplicate` | canRead(tpm-cards)   | Duplikat-Prüfung                                        |

Alle Controller: `@TenantFeature('tpm')` + `@UseGuards(JwtAuthGuard, RolesGuard, TenantFeatureGuard)`

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
pnpm run validate:all
```

---

### Step 2.11: Session 14 — Controllers (Executions + Config) + Module Assembly + Integrations [PENDING]

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

- [ ] `TpmModule` registriert in `app.module.ts`
- [ ] 15 Services implementiert und injiziert
- [ ] 4 Controller mit ~25 Endpoints total
- [ ] Permission Registrar registriert bei Module Init
- [ ] `@TenantFeature('tpm')` auf allen Controllern
- [ ] `db.tenantTransaction()` für alle tenant-scoped Queries
- [ ] KEIN Double-Wrapping (ADR-007)
- [ ] EventBus: 5 neue TPM Emit-Methoden
- [ ] SSE-Handler für TPM registriert
- [ ] Dashboard: TPM Count integriert
- [ ] Machine Availability: `createFromTpmPlan()` funktioniert
- [ ] Machine Maintenance History: Bridge funktioniert
- [ ] Alle DTOs nutzen Zod + `createZodDto()`
- [ ] ESLint 0 Errors
- [ ] Type-Check 0 Errors
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

---

## Phase 3: Unit Tests

> **Abhängigkeit:** Phase 2 complete
> **Pattern:** `backend/src/nest/vacation/vacation.service.test.ts`

### Step 3.1: Session 15 — Tests Plans + Config Services [PENDING]

**Neue Dateien:**

- `backend/src/nest/tpm/__tests__/tpm-plans.service.test.ts` (~25 Tests)
- `backend/src/nest/tpm/__tests__/tpm-plans-interval.service.test.ts` (~15 Tests)
- `backend/src/nest/tpm/__tests__/tpm-time-estimates.service.test.ts` (~10 Tests)
- `backend/src/nest/tpm/__tests__/tpm-templates.service.test.ts` (~10 Tests)
- `backend/src/nest/tpm/__tests__/tpm-color-config.service.test.ts` (~8 Tests)

**Szenarien:** CRUD Happy Path, Validierungsfehler, Duplikate, Soft-Delete, Tenant-Isolation

---

### Step 3.2: Session 16 — Tests Cards + Cascade + Duplicate [PENDING]

**Neue Dateien:**

- `backend/src/nest/tpm/__tests__/tpm-cards.service.test.ts` (~25 Tests)
- `backend/src/nest/tpm/__tests__/tpm-card-status.service.test.ts` (~20 Tests)
- `backend/src/nest/tpm/__tests__/tpm-card-cascade.service.test.ts` (~15 Tests)
- `backend/src/nest/tpm/__tests__/tpm-card-duplicate.service.test.ts` (~10 Tests)

**Szenarien:** CardCode-Generierung, Status-Transitionen (alle Flows), Kaskade (jährlich → alle ROT), Duplikat-Erkennung (ILIKE), Ungültige Transitionen → Error

---

### Step 3.3: Session 17 — Tests Slot Assistant + Executions + Approval [PENDING]

**Neue Dateien:**

- `backend/src/nest/tpm/__tests__/tpm-slot-assistant.service.test.ts` (~20 Tests)
- `backend/src/nest/tpm/__tests__/tpm-executions.service.test.ts` (~15 Tests)
- `backend/src/nest/tpm/__tests__/tpm-approval.service.test.ts` (~20 Tests)

**Szenarien:** Slot-Konflikte (MA im Urlaub, Maschine belegt, kein Schichtplan), Approval Happy Path, Rejection mit Note, Paralleler Approve → ConflictException, Deputy-Lead darf freigeben, Foto-Limit (max 5)

---

### Step 3.4: Session 18 — Tests Notification + Escalation [PENDING]

**Neue Dateien:**

- `backend/src/nest/tpm/__tests__/tpm-notification.service.test.ts` (~15 Tests)
- `backend/src/nest/tpm/__tests__/tpm-escalation.service.test.ts` (~12 Tests)

**Szenarien:** Dual-Notification (EventBus + DB), Eskalation nach Frist, Kein Duplikat bei erneutem Cron-Run, isProcessing Guard, Startup-Recovery

### Phase 3 — Definition of Done

- [ ] > = 220 Unit Tests total
- [ ] Alle Tests grün: `docker exec assixx-backend pnpm exec vitest run backend/src/nest/tpm/`
- [ ] Jeder ConflictException / BadRequestException Pfad abgedeckt
- [ ] Intervall-Kaskade getestet (alle Levels)
- [ ] Race Condition getestet (paralleler Approve)
- [ ] Tenant-Isolation getestet
- [ ] Coverage: Alle public Methoden haben mindestens 1 Test
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

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
- [ ] `pnpm run validate:all` ✅
- [ ] `pnpm test` ✅

---

## Phase 6: Integration + Polish

> **Abhängigkeit:** Phase 5 complete

### Step 6.1: Session 28 — E2E + Polish + ADR [PENDING]

**Integrationen verifizieren:**

- [ ] Machine Availability: Auto-Status 'maintenance' bei aktivem Plan
- [ ] Shift-Grid: TPM-Termine als farbige Blöcke (wenn Toggle aktiv)
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

| Session | Phase | Beschreibung                                                       | Status  | Datum |
| ------- | ----- | ------------------------------------------------------------------ | ------- | ----- |
| 1       | 1     | Migration: ENUMs + Plans + Time Estimates                          | PENDING |       |
| 2       | 1     | Migration: Card Templates + Cards                                  | PENDING |       |
| 3       | 1     | Migration: Executions + Photos + Config + Feature Flag             | PENDING |       |
| 4       | 2     | Module Skeleton + Types + Permissions                              | PENDING |       |
| 5       | 2     | DTOs (11 Dateien)                                                  | PENDING |       |
| 6       | 2     | Plans Service + Interval Service                                   | PENDING |       |
| 7       | 2     | Config Services (Time Estimates + Templates + Colors)              | PENDING |       |
| 8       | 2     | Cards Service + Card Status Service                                | PENDING |       |
| 9       | 2     | Card Cascade + Duplicate Detection                                 | PENDING |       |
| 10      | 2     | Slot Availability Assistant                                        | PENDING |       |
| 11      | 2     | Executions + Approval Services                                     | PENDING |       |
| 12      | 2     | Notification + Escalation Services + EventBus                      | PENDING |       |
| 13      | 2     | Controllers (Plans + Cards)                                        | PENDING |       |
| 14      | 2     | Controllers (Executions + Config) + Module Assembly + Integrations | PENDING |       |
| 15      | 3     | Unit Tests — Plans + Config Services (~68 Tests)                   | PENDING |       |
| 16      | 3     | Unit Tests — Cards + Cascade + Duplicate (~70 Tests)               | PENDING |       |
| 17      | 3     | Unit Tests — Slot Assistant + Executions + Approval (~55 Tests)    | PENDING |       |
| 18      | 3     | Unit Tests — Notification + Escalation (~27 Tests)                 | PENDING |       |
| 19      | 4     | API Tests — Plans + Cards (~20 Tests)                              | PENDING |       |
| 20      | 4     | API Tests — Executions + Config (~20 Tests)                        | PENDING |       |
| 21      | 5     | Frontend: Admin Dashboard + Foundation                             | PENDING |       |
| 22      | 5     | Frontend: Admin Plan Creation                                      | PENDING |       |
| 23      | 5     | Frontend: Admin Card Management                                    | PENDING |       |
| 24      | 5     | Frontend: Shared Employee Overview                                 | PENDING |       |
| 25      | 5     | Frontend: Kamishibai Board                                         | PENDING |       |
| 26      | 5     | Frontend: Card Detail + Execution + Approval UI                    | PENDING |       |
| 27      | 5     | Frontend: Config UI + Final Integration                            | PENDING |       |
| 28      | 6     | E2E Verification + Polish + ADR                                    | PENDING |       |

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

| #   | Spec sagt | Tatsächlicher Code | Entscheidung                           |
| --- | --------- | ------------------ | -------------------------------------- |
| —   | —         | —                  | (wird während Implementierung gefüllt) |

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- (wird nach Abschluss ausgefüllt)

### Was lief schlecht

- (wird nach Abschluss ausgefüllt)

### Metriken

| Metrik                    | Geplant | Tatsächlich |
| ------------------------- | ------- | ----------- |
| Sessions                  | 28      |             |
| Migrationsdateien         | 4       |             |
| Neue Backend-Dateien      | ~30     |             |
| Neue Frontend-Dateien     | ~35     |             |
| Geänderte Dateien         | ~10     |             |
| Unit Tests                | 220+    |             |
| API Tests                 | 40+     |             |
| ESLint Errors bei Release | 0       |             |
| Spec Deviations           | 0       |             |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste PENDING Item, und markiert es als DONE.**
