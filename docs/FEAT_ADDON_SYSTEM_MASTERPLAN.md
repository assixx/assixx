# FEAT: Addon System Refactor — Execution Masterplan

> **Created:** 2026-03-10
> **Version:** 1.1.0 (Phase 1 Complete)
> **Status:** IN PROGRESS — Phase 2 (Backend Refactor)
> **Branch:** `feat/organigramm` (working branch)
> **Spec:** [ADR-033](./infrastructure/adr/ADR-033-addon-based-saas-model.md)
> **Context:** [ADR-032 (Superseded)](./infrastructure/adr/ADR-032-feature-catalog-and-plan-tiers.md)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 10
> **Actual Sessions:** 1 / 10

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                                                                                                |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-03-10 | Initial Draft — Phasen 1-6 geplant                                                                                                                                                                                                      |
| 0.2.0   | 2026-03-10 | DB-IST-Zustand verifiziert, 4 kritische Korrekturen: (K1) tenants FK vor plans DROP, (K2) tenant_addons_status ENUM fehlt, (K3) Spaltennamen in Step 1.3 korrigiert, (K4) Trigger-Funktionen + Legacy-Indexnamen, +4 Risiken (R8-R11)   |
| 0.3.0   | 2026-03-11 | Session 1 Start. Verifizierte Daten korrigiert: tenant_features=40 (2 Tenants: apitest+testfirma), tenant_plans=2, user_feature_permissions=3. Backup erstellt. Phase 1 gestartet.                                                      |
| 1.1.0   | 2026-03-11 | Phase 1 COMPLETE. Alle 3 Migrationen erfolgreich: Step 1.1 (Drops+Renames), Step 1.2 (tenant_addons+Datenmigration 24 Rows), Step 1.3 (Tracking-Renames+tenant_storage). Spec Deviation D1: gen_random_uuid() statt uuid_generate_v7(). |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Refactor vollständig abgeschlossen

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Branch `refactor/addon-system` checked out (von `main`)
- [ ] Keine pending Migrations
- [ ] Bestehende Tests laufen alle durch
- [ ] ADR-033 reviewed und abgesegnet

### 0.2 Risk Register

| #   | Risiko                                             | Impact  | Wahrscheinlichkeit | Mitigation                                                           | Verifikation                                                                                  |
| --- | -------------------------------------------------- | ------- | ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| R1  | FK-Kaskaden bei Tabellen-Drops                     | Hoch    | Mittel             | Reihenfolge: erst abhängige Tabellen droppen, dann Stamm             | Dry-Run jeder Migration + Rollback-Test                                                       |
| R2  | Bestehende Tenant-Daten gehen verloren             | Hoch    | Niedrig            | Datenmigration in eigener Migration, nicht mit Schema mixen          | SELECT COUNT vor/nach Migration vergleichen                                                   |
| R3  | RLS Policies brechen bei Rename                    | Hoch    | Mittel             | Policies droppen und neu anlegen (nicht auf Rename hoffen)           | `SELECT * FROM pg_policies WHERE tablename = 'x'`                                             |
| R4  | Backend kompiliert nicht nach Renames              | Mittel  | Hoch               | Renames in einer Session, Type-Check am Ende                         | `docker exec assixx-backend pnpm run type-check`                                              |
| R5  | Frontend Imports brechen                           | Mittel  | Hoch               | Grep nach alten Imports, systematisch ersetzen                       | `svelte-check` + ESLint nach jedem Rename                                                     |
| R6  | Trigger/Sequences verwaisen nach Drop              | Niedrig | Mittel             | Explizit alle Trigger/Sequences in down() dokumentieren              | `\df` + `\ds` nach Migration                                                                  |
| R7  | Seed-Daten inkonsistent nach Migration             | Mittel  | Mittel             | Seed komplett neu schreiben, nicht patchen                           | Fresh-Install-Test mit neuer Seed                                                             |
| R8  | `tenants.current_plan_id` FK blockiert DROP plans  | Hoch    | Hoch               | FK + Spalten auf tenants VOR plans DROP entfernen (Step 1.1)         | `SELECT * FROM information_schema.table_constraints WHERE constraint_name = 'tenants_ibfk_1'` |
| R9  | `tenant_addons_status` ENUM (alt) kollidiert       | Mittel  | Mittel             | Alten ENUM droppen bevor neuer `tenant_addon_status` erstellt wird   | `SELECT typname FROM pg_type WHERE typname LIKE 'tenant_addon%'`                              |
| R10 | Orphaned Trigger-Funktionen nach DROP              | Niedrig | Hoch               | Explizit DROP FUNCTION für verwaiste Funktionen in Migration         | `SELECT proname FROM pg_proc WHERE proname LIKE '%feature%' OR proname LIKE '%plan%'`         |
| R11 | MySQL-Legacy-Indexnamen (`idx_19243_*`, `_ibfk_*`) | Niedrig | Hoch               | Bei Rename/Recreate saubere Namen vergeben (Migration-Guide-Pflicht) | `SELECT indexname FROM pg_indexes WHERE indexname LIKE 'idx_19%'`                             |

### 0.3 Ecosystem Integration Points

| Bestehendes System          | Art der Integration                               | Phase | Verifiziert am |
| --------------------------- | ------------------------------------------------- | ----- | -------------- |
| TenantFeatureGuard (global) | Rename zu TenantAddonGuard + neue Logik (is_core) | 2     |                |
| PermissionGuard (global)    | featureCode → addonCode in Metadata               | 2     |                |
| PermissionRegistryService   | PermissionCategoryDef.featureCode → addonCode     | 2     |                |
| 21 Permission Registrars    | Alle featureCode Referenzen → addonCode           | 2     |                |
| 10+ Controller Decorators   | @TenantFeature → @RequireAddon                    | 2     |                |
| FeaturesService             | Komplett umschreiben als AddonsService            | 2     |                |
| PlansService/Controller     | Komplett löschen                                  | 2     |                |
| Frontend Layout SSR         | activeFeatures → activeAddons                     | 5     |                |
| Navigation Config           | featureCode → addonCode                           | 5     |                |
| Feature Guard (Frontend)    | requireFeature → requireAddon                     | 5     |                |
| Seed-Daten                  | Komplett neu schreiben                            | 6     |                |
| tenants.current_plan_id FK  | FK + Spalten droppen VOR plans DROP               | 1     |                |
| emailService.ts             | Importiert deprecated feature-check.ts Stub       | 2     |                |

---

## Phase 1: Database Migrations

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** 3 neue Migrationsdateien

### Step 1.1: Tabellen vorbereiten — Drops + Renames ✅ DONE

**Neue Datei:** `database/migrations/{timestamp}_addon-system-rename-tables.ts`

**Was passiert (in dieser Reihenfolge):**

> **VERIFIZIERT 2026-03-10:** IST-Zustand der DB geprüft (Tabellen, FKs, ENUMs, Trigger, Policies, Daten).
> `tenants.current_plan_id` → `plans.id` FK (tenants_ibfk_1) MUSS vor plans DROP entfernt werden.
> `tenant_addons_status` ENUM (alt, 2 Werte) existiert und muss gedroppt werden.
> `features`/`plans`/`plan_features` haben RLS DISABLED (globale Tabellen) — kein Policy-Cleanup nötig.
> `user_feature_permissions.feature_code` ist VARCHAR ohne FK — vereinfacht Rename.
> `feature_visits.feature` ist VARCHAR ohne FK — vereinfacht Rename.

1. ALTER `tenants`: DROP COLUMN `current_plan`, DROP COLUMN `current_plan_id` (entfernt FK `tenants_ibfk_1` auf `plans`)
2. DROP `tenant_addons` (alte Kapazitäts-Tabelle — deprecated, 0 Rows)
3. DROP `plan_features` (abhängig von plans + features, 60 Rows → Seed-Daten, wiederherstellbar)
4. DROP `tenant_plans` (abhängig von plans, 1 Row)
5. DROP `plans` (Stamm-Tabelle, 3 Rows → Seed-Daten, wiederherstellbar)
6. RENAME `features` → `addons`
7. ADD COLUMN `addons.is_core BOOLEAN NOT NULL DEFAULT false`
8. ADD COLUMN `addons.trial_days INTEGER DEFAULT 30`
9. RENAME COLUMN `addons.base_price` → `addons.price_monthly`
10. DROP COLUMN `addons.category` + DROP TYPE `features_category`
11. UPDATE `addons SET is_core = true` WHERE code IN (dashboard, calendar, blackboard, settings, notifications, employees, departments, teams)
12. UPDATE `addons SET price_monthly = 10.00, trial_days = 30` WHERE `is_core = false`
13. UPDATE `addons SET price_monthly = NULL, trial_days = NULL` WHERE `is_core = true`
14. Trigger + Trigger-Funktionen umbenennen:
    - `prevent_features_delete` → `prevent_addons_delete`
    - `on_update_current_timestamp` (auf features) → bleibt (generisch)
    - `update_features_updated_at` → `update_addons_updated_at`
    - Trigger-Funktion `on_update_current_timestamp_features` → `on_update_current_timestamp_addons`
15. Orphaned Trigger-Funktionen droppen (Tabellen sind weg, Funktionen überleben):
    - `DROP FUNCTION IF EXISTS on_update_current_timestamp_plans`
    - `DROP FUNCTION IF EXISTS on_update_current_timestamp_tenant_plans`
    - `DROP FUNCTION IF EXISTS on_update_current_timestamp_tenant_features` (wird in Step 1.2 gedropt)
16. MySQL-Legacy-Indexnamen bereinigen (auf `addons` Tabelle):
    - `idx_19243_primary` → `addons_pkey`
    - `idx_19243_code` → `addons_code_key` (UNIQUE)
    - `idx_19243_idx_category` → DROP (category Spalte wird entfernt)
    - `idx_19243_idx_code` → DROP (redundant mit UNIQUE)
    - `idx_19243_idx_is_active` → `idx_addons_is_active`

**ENUMs zu entfernen (6 Stück):**

- `features_category`
- `tenants_current_plan` (Werte: basic, premium, enterprise — Hinweis: "premium" nicht "professional")
- `tenant_plans_status`
- `tenant_plans_billing_cycle`
- `tenant_addons_addon_type`
- `tenant_addons_status` (alt, nur 2 Werte: active, cancelled — NICHT mit neuem `tenant_addon_status` verwechseln!)

**Mandatory Checklist:**

- [ ] `down()` stellt alle Drops/Renames korrekt wieder her
- [ ] Trigger `prevent_features_delete` → `prevent_addons_delete` umbenennen
- [ ] Trigger-FUNKTIONEN umbenennen (überleben Table-Rename!)
- [ ] Orphaned Trigger-Funktionen droppen (überleben Table-DROP!)
- [ ] Alle FK-Constraints auf `features(id)` → `addons(id)` werden automatisch umbenannt (PostgreSQL RENAME)
- [ ] GRANTs für `app_user` auf `addons` verifizieren (werden vom RENAME übernommen)
- [ ] MySQL-Legacy-Indexnamen bereinigen (DB-Migration-Guide: keine `idx_19xxx_*` Namen)
- [ ] Kein `IF NOT EXISTS` in `up()` (DB-Migration-Guide: FAIL LOUD)
- [ ] RAISE EXCEPTION Pre-Check: Tabellen existieren, Daten wie erwartet

### Step 1.2: Neue tenant_addons Tabelle + Datenmigration ✅ DONE

**Neue Datei:** `database/migrations/{timestamp}_addon-system-tenant-addons.ts`

**Was passiert:**

> **VERIFIZIERT 2026-03-10:** `tenant_addons_status` ENUM (alt, 2 Werte) muss vor `tenant_addon_status`
> (neu, 4 Werte) gedroppt werden — verschiedene Namen aber verwirrend ähnlich.
> **KORRIGIERT 2026-03-11:** `tenant_features` hat **40 Rows** (Tenant 1 apitest + Tenant 3 testfirma, je 20 Features aktiv). Nur non-core Addons migrieren (12 pro Tenant = 24 total).

1. DROP TYPE `tenant_addons_status` (alt — nur active/cancelled, gehörte zur gedropten tenant_addons Tabelle aus Step 1.1)
2. CREATE TYPE `tenant_addon_status` AS ENUM ('trial', 'active', 'expired', 'cancelled')
3. Datenmigration vorbereiten: SELECT aus `tenant_features` in Temp-Tabelle (non-core Addons)
4. DROP `tenant_features` (alte Tabelle)
5. CREATE `tenant_addons` (neue Struktur mit UUID PK, status, trial_dates, payment_reference)
6. Datenmigration: INSERT INTO `tenant_addons` FROM Temp-Tabelle
7. DROP Temp-Tabelle
8. RLS Policy + GRANT
9. Indexes (tenant_id, status)
10. Orphaned Trigger-Funktionen droppen:
    - `DROP FUNCTION IF EXISTS on_update_current_timestamp_tenant_features`

**Mandatory Checklist:**

- [ ] `uuid UUID PRIMARY KEY` (UUIDv7)
- [ ] `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
- [ ] `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- [ ] RLS Policy mit `NULLIF(current_setting('app.tenant_id', true), '')` Pattern
- [ ] `GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_addons TO app_user`
- [ ] `UNIQUE(tenant_id, addon_id)`
- [ ] Partial Index `WHERE is_active = 1`
- [ ] `is_active SMALLINT NOT NULL DEFAULT 1`
- [ ] `up()` UND `down()` implementiert

### Step 1.3: Tracking-Tabellen + tenants + Storage ✅ DONE

**Neue Datei:** `database/migrations/{timestamp}_addon-system-cleanup.ts`

**Was passiert:**

> **VERIFIZIERT 2026-03-10:** Tatsächliche Spaltennamen geprüft.
> `tenants`-Spalten werden bereits in Step 1.1 entfernt (FK-Abhängigkeit auf plans).

1. RENAME `feature_usage_logs` → `addon_usage_logs` + Spalte `feature_id` → `addon_id` (INTEGER FK auf addons.id)
2. RENAME `feature_visits` → `addon_visits` + Spalte `feature` → `addon` (VARCHAR, kein FK)
3. RENAME `user_feature_permissions` → `user_addon_permissions` + Spalte `feature_code` → `addon_code` (VARCHAR, kein FK)
4. UNIQUE Constraint aktualisieren: `uq_user_feature_module` → `uq_user_addon_module` (auf user_addon_permissions)
5. CREATE `tenant_storage` (uuid, tenant_id, storage_limit_gb DEFAULT 100, storage_used_gb DEFAULT 0)
6. INSERT `tenant_storage` für jeden bestehenden Tenant (100GB Default)
7. RLS + GRANT auf alle umbenannten/neuen Tabellen
8. Policies auf umbenannten Tabellen droppen und neu anlegen
9. Trigger-Funktionen auf umbenannten Tabellen aktualisieren:
   - `update_feature_visits_updated_at` → DROP + neu anlegen als `update_addon_visits_updated_at`
   - Trigger `trigger_feature_visits_updated_at` → `trigger_addon_visits_updated_at`
10. MySQL-Legacy-Indexnamen bereinigen auf allen umbenannten Tabellen:
    - `feature_usage_logs`: `idx_19255_*` → `idx_addon_usage_logs_*`
    - `feature_visits`: `idx_feature_visits_*` → `idx_addon_visits_*`
    - `user_feature_permissions`: `idx_ufp_*` → `idx_uap_*`

### Phase 1 — Definition of Done

- [ ] 3 Migrationsdateien mit `up()` AND `down()`
- [ ] Alle Migrationen bestehen Dry-Run: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [ ] Alle Migrationen erfolgreich angewendet
- [ ] `addons` Tabelle existiert mit `is_core`, `price_monthly`, `trial_days` Spalten
- [ ] `tenant_addons` (neu) existiert mit `status`, `trial_started_at`, `trial_ends_at`
- [ ] `tenant_storage` existiert mit Default 100GB pro Tenant
- [ ] `plans`, `plan_features`, `tenant_plans`, alte `tenant_addons` sind gedroppt
- [ ] `tenants.current_plan` und `tenants.current_plan_id` sind entfernt
- [ ] Alle 6 deprecated ENUMs sind gedroppt (features_category, tenants_current_plan, tenant_plans_status, tenant_plans_billing_cycle, tenant_addons_addon_type, tenant_addons_status)
- [ ] RLS Policies auf allen tenant-scoped Tabellen verifiziert
- [ ] Daten korrekt migriert: `SELECT COUNT(*)` auf neuer tenant_addons = erwartete Anzahl
- [ ] Backup vorhanden vor Migrationen

---

## Phase 2: Backend Refactor

> **Abhängigkeit:** Phase 1 complete
> **Umfang:** ~25 Dateien umbenennen/ändern, ~5 Dateien löschen

### Step 2.1: AddonCheckService + Guard + Decorator ✅ DONE

**Renames:**

- `feature-check/feature-check.service.ts` → `addon-check/addon-check.service.ts`
- `feature-check/feature-check.module.ts` → `addon-check/addon-check.module.ts`
- `common/decorators/tenant-feature.decorator.ts` → `common/decorators/require-addon.decorator.ts`
- `common/guards/tenant-feature.guard.ts` → `common/guards/tenant-addon.guard.ts`

**Logik-Änderung in AddonCheckService:**

- `checkTenantAccess()`: Prüft zuerst `addon.is_core` → sofort true
- Dann `tenant_addons` für Status + Trial-Ablauf
- `deactivateAddon()`: Setzt Status + is_active, **löscht KEINE Permissions**

**Abhängigkeiten:** Wird von ALLEN Feature-Modulen importiert

### Step 2.2: AddonsModule (ersetzt FeaturesModule) ✅ DONE

**Renames:**

- `features/features.service.ts` → `addons/addons.service.ts`
- `features/features.controller.ts` → `addons/addons.controller.ts`
- `features/features.module.ts` → `addons/addons.module.ts`
- Alle DTOs in `features/dto/` → `addons/dto/`

**API-Route:** `/features` → `/addons`

**Neue Methoden in AddonsService:**

- `activateAddon()` — Erstellt/aktualisiert tenant_addons Entry (Trial oder Active)
- `deactivateAddon()` — Status → cancelled, Permissions bleiben
- `getAddonStatus()` — Trial/Active/Expired/Cancelled + Ablaufdatum
- `getAvailableAddons()` — Alle Addons mit Status pro Tenant (für "Addon-Store" UI)

### Step 2.3: PlansModule löschen ✅ DONE

**Löschen:**

- `plans/plans.service.ts`
- `plans/plans.controller.ts`
- `plans/plans.module.ts`
- Alle DTOs in `plans/dto/`

**Aufräumen:**

- `PlansModule` aus `app.module.ts` entfernen
- Alle Imports von PlansService/PlansModule entfernen
- Prüfen: Tenant-Onboarding-Logik (Registration) — Plan-Zuordnung entfernen
- `emailService.ts` importiert deprecated `backend/src/utils/feature-check.ts` — Abhängigkeit auflösen VOR Löschung in Step 2.6

**WARNUNG — Behavioral Change (ADR-033):**

- Alt: `FeaturesService.deactivateFeature()` LÖSCHT `user_feature_permissions` (destruktiv)
- Neu: `AddonsService.deactivateAddon()` setzt NUR Status, Permissions ÜBERLEBEN
- Muss explizit getestet werden (Phase 3 + 4)

### Step 2.4: Permission System Rename ✅ DONE

**21 Permission Registrars aktualisieren:**

- Jeder `*.permissions.ts`: `featureCode` → `addonCode`
- Jeder `*-permission.registrar.ts`: Interface-Anpassung
- `permission-registry.service.ts`: `PermissionCategoryDef` Interface
- `permission.types.ts`: Type-Definitionen
- `permission.guard.ts`: Metadata-Key
- `require-permission.decorator.ts`: Parameter-Name

### Step 2.5: Alle Controller Decorators ✅ DONE

**10+ Controller aktualisieren:**

- `@TenantFeature('blackboard')` → `@RequireAddon('blackboard')`
- `@TenantFeature('calendar')` → `@RequireAddon('calendar')`
- `@TenantFeature('chat')` → `@RequireAddon('chat')`
- ... (alle 10+ Controller)
- Import-Pfad von `tenant-feature.decorator` → `require-addon.decorator`

### Step 2.6: app.module.ts + Deprecated Utils [PENDING]

- `TenantFeatureGuard` → `TenantAddonGuard` in APP_GUARD
- `FeatureCheckModule` → `AddonCheckModule` in imports
- `FeaturesModule` → `AddonsModule` in imports
- `PlansModule` entfernen aus imports
- Deprecated `backend/src/utils/feature-check.ts` Stub löschen

### Phase 2 — Definition of Done

- [ ] `AddonCheckService` mit `is_core`-Logik implementiert
- [ ] `AddonCheckModule` exportiert und von allen Modulen importiert
- [ ] `@RequireAddon()` Decorator funktioniert
- [ ] `TenantAddonGuard` als globaler Guard registriert
- [ ] `AddonsService` mit activate/deactivate/status Methoden
- [ ] `AddonsController` unter `/addons` erreichbar
- [ ] `PlansModule` komplett gelöscht, keine Referenzen mehr
- [ ] Alle 21 Permission Registrars auf `addonCode` umgestellt
- [ ] Alle 10+ Controller auf `@RequireAddon()` umgestellt
- [ ] `app.module.ts` sauber (keine Feature/Plan Referenzen)
- [ ] ESLint 0 Errors: `docker exec assixx-backend pnpm run lint`
- [ ] Type-Check passed: `docker exec assixx-backend pnpm run type-check`
- [ ] `grep -r "TenantFeature\|FeatureCheck\|FeaturesService\|PlansService" backend/src/` → 0 Treffer

---

## Phase 3: Unit Tests

> **Abhängigkeit:** Phase 2 complete

### Test-Dateien aktualisieren

- `tenant-feature.guard.test.ts` → `tenant-addon.guard.test.ts` (16 Tests)
- `feature-check.service.test.ts` → `addon-check.service.test.ts` (5 Tests + neue für is_core)
- `permission.guard.test.ts` (14 Tests — featureCode → addonCode)
- `feature-guard.test.ts` (Frontend, 13 Tests)

### Neue Tests

- AddonCheckService: `is_core` → sofort true (kein DB-Lookup für tenant_addons)
- AddonCheckService: Trial-Ablauf (expired nach 30 Tagen)
- AddonsService: Deaktivierung erhält Permissions
- AddonsService: Reaktivierung stellt Zugang sofort wieder her
- AddonsService: Trial-Start setzt korrektes Ablaufdatum

### Phase 3 — Definition of Done

- [ ] Alle bestehenden Tests umbenannt und angepasst
- [ ] Mindestens 10 neue Tests für Addon-spezifische Logik
- [ ] Alle Tests grün: `docker exec assixx-backend pnpm exec vitest run`
- [ ] Coverage: is_core, Trial, Deaktivierung/Reaktivierung abgedeckt

---

## Phase 4: API Integration Tests

> **Abhängigkeit:** Phase 3 complete

### Szenarien

- [ ] GET `/addons` → 200 (alle Addons mit is_core Flag)
- [ ] GET `/addons/my-addons` → 200 (Tenant-Addon-Status)
- [ ] POST `/addons/activate` → 200 (Core-Addon → sofort aktiv)
- [ ] POST `/addons/activate` → 200 (Purchasable Addon → Trial)
- [ ] POST `/addons/deactivate` → 200 (Status cancelled, Daten erhalten)
- [ ] Unauthenticated → 401
- [ ] Addon deaktiviert + Endpoint aufrufen → 403
- [ ] Reaktivierung → Permissions noch da

### Phase 4 — Definition of Done

- [ ] > = 15 API Integration Tests
- [ ] Alle Tests grün
- [ ] Tenant-Isolation verifiziert
- [ ] Addon-Gating verifiziert (core vs purchasable)

---

## Phase 5: Frontend Refactor

> **Abhängigkeit:** Phase 2 complete (Backend-Endpoints verfügbar)

### Step 5.1: Guards + Navigation [PENDING]

**Renames:**

- `lib/utils/feature-guard.ts` → `lib/utils/addon-guard.ts`
- `requireFeature()` → `requireAddon()`
- `(app)/+layout.server.ts`: `activeFeatures` → `activeAddons`, API-Pfad `/addons/my-addons`
- `(app)/+layout.svelte`: `filterMenuByFeatures` → `filterMenuByAddons`
- `(app)/_lib/navigation-config.ts`: `featureCode` → `addonCode`

### Step 5.2: Alle Page-Server-Dateien [PENDING]

Jede `+page.server.ts` die `requireFeature()` aufruft → `requireAddon()`:

- blackboard, calendar, chat, documents, kvp, shift_planning, surveys, vacation, tpm, work_orders

### Step 5.3: Feature-Unavailable Page [PENDING]

- `/feature-unavailable` → `/addon-unavailable`
- Texte aktualisieren: "Feature" → "Modul" (user-facing)
- CTA: "Modul 30 Tage kostenlos testen" statt "Plan upgraden"

### Phase 5 — Definition of Done

- [ ] `grep -r "requireFeature\|activeFeatures\|featureCode\|filterMenuByFeatures" frontend/src/` → 0 Treffer
- [ ] svelte-check 0 Errors: `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json`
- [ ] ESLint 0 Errors: `cd frontend && pnpm exec eslint src/`
- [ ] Navigation zeigt Core-Addons immer, Purchasable nur wenn aktiv
- [ ] `/addon-unavailable` Seite rendert korrekt
- [ ] Alle Pages mit Addon-Guard laden korrekt

---

## Phase 6: Seeds + Documentation + Polish

> **Abhängigkeit:** Phase 5 complete

### Step 6.1: Seed-Daten komplett neu schreiben [PENDING]

- `001_global-seed-data.sql`: Features → Addons (mit is_core, price_monthly)
- Alle Plan-Seeds entfernen
- Alle plan_features-Seeds entfernen
- `002_seed_data.sql` (Customer): Tenant-Addon-Zuordnungen statt Plan-Zuordnungen
- tenant_storage Default-Eintrag pro Tenant

### Step 6.2: Dokumentation [PENDING]

- [ ] ADR-032 Status → `Superseded by ADR-033`
- [ ] ADR-033 Status → `Accepted`
- [ ] README.md → Plan-Referenzen entfernen
- [ ] FEATURES.md aktualisieren (falls vorhanden)
- [ ] Diesen Masterplan auf Version 2.0.0 setzen

### Step 6.3: Deprecated Code Cleanup [PENDING]

- [ ] `backend/src/utils/feature-check.ts` (deprecated Stub) → löschen
- [ ] Keine `// TODO` Kommentare im Code
- [ ] `grep -r "feature" backend/src/nest/` → nur in Variablennamen die nichts mit dem alten System zu tun haben
- [ ] `grep -r "plan" backend/src/nest/` → nur in Variablennamen die nichts mit dem alten System zu tun haben (z.B. "shift_planning")

### Phase 6 — Definition of Done

- [ ] Fresh-Install mit neuer Seed funktioniert
- [ ] Kein Verweis auf altes Plan-System in Codebasis
- [ ] ADR-032 als Superseded markiert
- [ ] Alle Dokumentation aktualisiert
- [ ] Type-Check + ESLint + Tests alle grün
- [ ] Masterplan Version 2.0.0

---

## Session Tracking

| Session | Phase | Beschreibung                                            | Status      | Datum      |
| ------- | ----- | ------------------------------------------------------- | ----------- | ---------- |
| 1       | 1     | Migration 1: Drops + Renames (features→addons)          | ✅ DONE     | 2026-03-11 |
| 2       | 1     | Migration 2+3: tenant_addons + Cleanup + tenant_storage | ✅ DONE     | 2026-03-11 |
| 3       | 2     | AddonCheckService + Guard + Decorator                   | ✅ DONE     | 2026-03-11 |
| 4       | 2     | AddonsModule + PlansModule löschen                      | ✅ DONE     | 2026-03-11 |
| 5       | 2     | Permission Renames + Controller Decorators + app.module | IN PROGRESS | 2026-03-11 |
| 6       | 3     | Unit Tests aktualisieren + neue Tests                   | PENDING     |            |
| 7       | 4     | API Integration Tests                                   | PENDING     |            |
| 8       | 5     | Frontend Guards + Navigation + Layout                   | PENDING     |            |
| 9       | 5     | Frontend Pages + Addon-Unavailable                      | PENDING     |            |
| 10      | 6     | Seeds + Docs + Cleanup + Final Verification             | PENDING     |            |

---

## Quick Reference: File Paths

### Backend (neu/umbenannt)

| Datei                                                           | Zweck                     |
| --------------------------------------------------------------- | ------------------------- |
| `backend/src/nest/addon-check/addon-check.service.ts`           | Core Addon-Prüfung        |
| `backend/src/nest/addon-check/addon-check.module.ts`            | NestJS Modul              |
| `backend/src/nest/addons/addons.service.ts`                     | Addon-CRUD + Licensing    |
| `backend/src/nest/addons/addons.controller.ts`                  | REST Controller `/addons` |
| `backend/src/nest/addons/addons.module.ts`                      | NestJS Modul              |
| `backend/src/nest/common/decorators/require-addon.decorator.ts` | `@RequireAddon()`         |
| `backend/src/nest/common/guards/tenant-addon.guard.ts`          | Globaler Addon-Guard      |

### Backend (gelöscht)

| Datei                                          | Grund            |
| ---------------------------------------------- | ---------------- |
| `backend/src/nest/plans/` (ganzes Verzeichnis) | Keine Pläne mehr |
| `backend/src/utils/feature-check.ts`           | Deprecated Stub  |

### Database (neu)

| Datei                                                    | Zweck                               |
| -------------------------------------------------------- | ----------------------------------- |
| `database/migrations/{ts}_addon-system-rename-tables.ts` | Drops + Renames                     |
| `database/migrations/{ts}_addon-system-tenant-addons.ts` | Neue tenant_addons + Datenmigration |
| `database/migrations/{ts}_addon-system-cleanup.ts`       | Tracking Renames + tenant_storage   |

### Frontend (umbenannt)

| Pfad                                           | Zweck            |
| ---------------------------------------------- | ---------------- |
| `frontend/src/lib/utils/addon-guard.ts`        | SSR Addon Guard  |
| `frontend/src/routes/(app)/addon-unavailable/` | Unavailable Page |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Keine Payment-Integration** — Stripe/PayPal Webhooks sind ein eigener Refactor nach diesem
2. **Kein Addon-Store UI** — Addons werden über Settings aktiviert, kein Marketplace
3. **Keine automatische Trial-Ablauf-Benachrichtigung** — SSE/Email bei Trial-Ende ist V2
4. **Keine Preis-Differenzierung** — Alle Addons kosten gleich (€10), individuelle Preise nur via `custom_price`
5. **Kein Storage-Enforcement** — `tenant_storage` Tabelle existiert, aber kein Upload-Limit-Check
6. **Keine Billing-History** — Kein Rechnungsverlauf, kein Kreditkarten-Management
7. **Keine automatische Deaktivierung** — Bei Zahlungsausfall muss manuell deaktiviert werden (bis Stripe-Integration)

---

## Spec Deviations

| #   | Spec sagt                                            | Tatsächlicher Code                                               | Entscheidung                                                                    |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| D1  | `uuid_generate_v7()` als PK-Default (ADR-033 Schema) | `gen_random_uuid()` (v4) — pg_uuidv7 Extension nicht installiert | App-Layer generiert UUIDv7 via npm uuid v13. Migrationsdaten bekommen v4 UUIDs. |

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- (nach Abschluss)

### Was lief schlecht

- (nach Abschluss)

### Metriken

| Metrik                     | Geplant | Tatsächlich |
| -------------------------- | ------- | ----------- |
| Sessions                   | 10      |             |
| Migrationsdateien          | 3       |             |
| Neue Backend-Dateien       | ~10     |             |
| Gelöschte Backend-Dateien  | ~8      |             |
| Geänderte Backend-Dateien  | ~30     |             |
| Geänderte Frontend-Dateien | ~15     |             |
| Unit Tests (neu/geändert)  | ~40     |             |
| API Tests (neu/geändert)   | ~15     |             |
| ESLint Errors bei Release  | 0       |             |
| Spec Deviations            | 0       |             |
