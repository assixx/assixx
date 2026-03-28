# ADR-033: Addon-basiertes SaaS-Modell (ersetzt Plan-Tiers)

| Metadata                | Value                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                      |
| **Date**                | 2026-03-10                                                                                                    |
| **Decision Makers**     | SCS Technik                                                                                                   |
| **Supersedes**          | ADR-032 (Feature-Katalog und Plan-Tier-Zuordnung)                                                             |
| **Affected Components** | PostgreSQL (10+ Tabellen), Backend (Guards, Services, Controllers), Frontend (Guards, Navigation), Seed-Daten |
| **Related ADRs**        | ADR-020 (Per-User Permissions), ADR-024 (Frontend Feature Guards), ADR-032 (Superseded)                       |

---

## Context

### Das Problem: Plan-Tiers passen nicht zur Zielgruppe

Das bisherige 3-Tier-Modell (Basic €49 / Professional €149 / Enterprise €299) zwingt Industrieunternehmen, teure Pakete zu kaufen, nur um ein einzelnes Feature zu nutzen. Ein Unternehmen, das nur TPM braucht, muss Enterprise (€299/Monat) lizenzieren — obwohl es 17 der 20 Features nicht nutzt.

**Kernprobleme:**

1. **Inflexibel:** Firmen zahlen für Features die sie nicht brauchen
2. **Hohe Einstiegshürde:** €149 für Professional, obwohl nur 1-2 Premium-Features gebraucht werden
3. **Keine Granularität:** Alles-oder-nichts pro Tier-Stufe
4. **Komplexe Codebasis:** 3 Pläne × 20 Features × 60 Zuordnungsregeln — unnötige Komplexität
5. **Inkonsistenzen:** `features.category` vs `plan_features.is_included` (ADR-032 dokumentierte 9 Fehler)

### Anforderungen

- Jedes Unternehmen zahlt nur für das, was es nutzt
- Einfaches, transparentes Preismodell
- 30-Tage-Trial pro Addon ohne Zahlungspflicht
- Daten bleiben bei Deaktivierung erhalten (Reaktivierung jederzeit)
- Unlimited Users im Core (keine Mitarbeiter-/Admin-Limits)
- Architektur vorbereitet für Payment-Integration (Stripe/PayPal)

---

## Decision

### Neues Modell: Core + À-la-carte Addons

```
┌──────────────────────────────────────────────────────────┐
│  CORE (Grundgebühr €X/Monat — Preis TBD)                │
│  ┌────────────────────────────────────────────────────┐  │
│  │ ∞ Users (Root, Admin, Employee)                    │  │
│  │ 100 GB Storage (Default)                           │  │
│  │ 10 Core-Addons (immer aktiv)                       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  + Beliebige Addons à la carte (je €10/Monat)            │
│    ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│    │ TPM  │ │ Chat │ │ KVP  │ │ ...  │                   │
│    └──────┘ └──────┘ └──────┘ └──────┘                  │
└──────────────────────────────────────────────────────────┘
```

**Keine Bundles, keine Tiers, keine Pakete.** Jede Firma stellt sich ihr Setup individuell zusammen.

### Naming-Konvention

| Kontext             | Bezeichnung | Beispiel                                       |
| ------------------- | ----------- | ---------------------------------------------- |
| Code / DB / Backend | `addon`     | `addons`, `tenant_addons`, `AddonCheckService` |
| Frontend (intern)   | `addon`     | `addonGuard()`, `activeAddons`                 |
| Landing Page / UI   | "Modul"     | "TPM Modul", "Chat Modul"                      |
| NestJS Module       | `Module`    | `TpmModule`, `ChatModule`                      |

> **Warum `addon` statt `module`?** NestJS verwendet `Module` als Kernkonzept (`@Module()`). `addon` vermeidet Naming-Kollisionen und ist im Code sofort als Business-Konzept erkennbar.

---

## Addon-Katalog (22 Addons)

### Core-Addons (10) — Immer aktiv, in Grundgebühr enthalten

| #   | Code               | Name                  | Beschreibung                                                  | Permission-Module                                                                     |
| --- | ------------------ | --------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | `dashboard`        | Dashboard             | Zentrale Übersicht mit Kennzahlen und Schnellzugriff          | — (kein Guard)                                                                        |
| 2   | `calendar`         | Kalender              | Gemeinsamer Unternehmenskalender                              | `calendar-events` (R/W/D)                                                             |
| 3   | `blackboard`       | Schwarzes Brett       | Digitales schwarzes Brett für Ankündigungen                   | `blackboard-posts` (R/W/D), `blackboard-comments` (R/W/D), `blackboard-archive` (R/W) |
| 4   | `settings`         | Einstellungen         | Mandanten-Einstellungen und Konfiguration                     | `settings-tenant` (W/D)                                                               |
| 5   | `notifications`    | Benachrichtigungen    | Push-Benachrichtigungen und SSE-Streaming                     | `notifications-manage` (R/W)                                                          |
| 6   | `employees`        | Mitarbeiterverwaltung | Benutzer anlegen, bearbeiten, deaktivieren                    | `employees-manage` (R/W/D), `employees-availability` (R/W/D)                          |
| 7   | `departments`      | Abteilungen           | Abteilungen und Bereiche (Organisationsstruktur)              | `departments-manage` (W/D), `areas-manage` (W/D)                                      |
| 8   | `teams`            | Teams                 | Teams verwalten, Mitglieder und Anlagen zuordnen              | `teams-manage` (W/D)                                                                  |
| 9   | `manage_hierarchy` | Organisationsstruktur | Verwaltung von Bereichen, Abteilungen, Teams und Mitarbeitern | — (kein Guard, ADR-035)                                                               |
| 10  | `approvals`        | Freigaben             | Zentrales Freigabe-System für Genehmigungsworkflows           | `approvals-manage` (R/W/D), `approvals-request` (R/W)                                 |

### Kaufbare Addons (12) — Je €10/Monat (provisorisch), 30 Tage Trial

| #   | Code             | Name                    | Beschreibung                                                     | Permission-Module                                                                                                                            |
| --- | ---------------- | ----------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `documents`      | Dokumente               | Dokumentenverwaltung mit Upload, Archiv und Zugriffskontrolle    | `documents-files` (R/W/D), `documents-archive` (R/W)                                                                                         |
| 10  | `dummy_users`    | Platzhalter-Benutzer    | Anonyme Anzeige-Accounts für Fabrik-Bildschirme (Kiosk-Modus)    | `dummy-users-manage` (R/W/D)                                                                                                                 |
| 11  | `vacation`       | Urlaubsverwaltung       | Digitale Urlaubsanträge, Genehmigungsworkflow, Kapazitätsprüfung | `vacation-requests` (R/W/D), `vacation-rules` (R/W/D), `vacation-entitlements` (R/W/D), `vacation-holidays` (R/W/D), `vacation-overview` (R) |
| 12  | `shift_planning` | Schichtplanung          | Schichtpläne, Tauschbörse, Rotation, Schichtzeiten               | `shift-plan` (R/W/D), `shift-swap` (R/W), `shift-rotation` (R/W/D), `shift-times` (R/W)                                                      |
| 13  | `chat`           | Chat                    | Team-Chat mit Gesprächen und Nachrichten                         | `chat-conversations` (R/W/D), `chat-messages` (R/W/D)                                                                                        |
| 14  | `surveys`        | Umfragen                | Umfragen erstellen, durchführen und auswerten                    | `surveys-manage` (R/W/D), `surveys-participate` (R/W), `surveys-results` (R)                                                                 |
| 15  | `work_orders`    | Arbeitsaufträge         | Modulübergreifendes Auftragssystem                               | `work-orders-manage` (R/W/D), `work-orders-execute` (R/W)                                                                                    |
| 16  | `assets`         | Anlagen & Maschinen     | Anlagen-/Maschinenverwaltung mit Verfügbarkeitstracking          | `assets-manage` (W/D), `assets-availability` (W/D)                                                                                           |
| 17  | `reports`        | Berichte & Auswertungen | Unternehmensberichte, Analytics und Datenexporte                 | `reports-view` (R), `reports-export` (R/W)                                                                                                   |
| 18  | `kvp`            | KVP                     | Kontinuierlicher Verbesserungsprozess — Vorschlagswesen          | `kvp-suggestions` (R/W/D), `kvp-comments` (R/W/D)                                                                                            |
| 19  | `tpm`            | TPM / Wartung           | Total Productive Maintenance — Kamishibai Board, Wartungspläne   | `tpm-plans` (R/W/D), `tpm-cards` (R/W/D), `tpm-executions` (R/W), `tpm-config` (R/W), `tpm-locations` (R/W/D)                                |
| 20  | `audit_trail`    | Protokoll & Audit       | Audit-Protokollierung, Compliance-Berichte                       | `audit-view` (R), `audit-export` (R/W), `audit-retention` (R/D)                                                                              |

---

## Deaktivierungsverhalten (Kritische Änderung)

| Aspekt               | Alt (Plan-Tiers)                               | Neu (Addon-Modell)                                 |
| -------------------- | ---------------------------------------------- | -------------------------------------------------- |
| **Daten**            | Bleiben in DB                                  | Bleiben in DB — **identisch**                      |
| **User Permissions** | **GELÖSCHT** bei Feature-Deaktivierung         | **ERHALTEN** — Permissions überleben Deaktivierung |
| **UI-Zugang**        | Gesperrt (403)                                 | Gesperrt (403) — **identisch**                     |
| **Reaktivierung**    | Permissions müssen manuell neu vergeben werden | Sofort voll funktionsfähig, alle Permissions da    |
| **Navigation**       | Addon verschwindet aus Sidebar                 | Addon verschwindet aus Sidebar — **identisch**     |

> **Begründung:** User Permissions bei Deaktivierung zu löschen ist destruktiv und erzeugt Mehrarbeit bei Reaktivierung. Ein Admin, der 50 Mitarbeitern TPM-Rechte vergeben hat, will nicht alles neu konfigurieren.

---

## Datenbankänderungen

### Tabellen-Übersicht

| Aktion   | Alt                        | Neu                      | Begründung                                       |
| -------- | -------------------------- | ------------------------ | ------------------------------------------------ |
| RENAME   | `features`                 | `addons`                 | Naming-Konsistenz                                |
| RECREATE | `tenant_features`          | `tenant_addons`          | Neue Spalten für Licensing + Trial               |
| DROP     | `plans`                    | —                        | Keine Plan-Tiers mehr                            |
| DROP     | `plan_features`            | —                        | Deterministische Zuordnung entfällt              |
| DROP     | `tenant_plans`             | —                        | Keine Plan-Subscriptions mehr                    |
| DROP     | `tenant_addons` (alt)      | —                        | Kapazitäts-Upgrades deprecated (unlimited Users) |
| RENAME   | `feature_usage_logs`       | `addon_usage_logs`       | Naming-Konsistenz                                |
| RENAME   | `feature_visits`           | `addon_visits`           | Naming-Konsistenz                                |
| RENAME   | `user_feature_permissions` | `user_addon_permissions` | Naming-Konsistenz                                |
| ALTER    | `tenants`                  | `tenants`                | `current_plan*` Spalten entfernen                |
| CREATE   | —                          | `tenant_storage`         | Storage-Tracking (Platzhalter für Zukunft)       |

### Schema: `addons` (ehemals `features`)

```sql
-- Änderungen an bestehender Tabelle:
ALTER TABLE features RENAME TO addons;
-- Neue Spalten:
ALTER TABLE addons ADD COLUMN is_core BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE addons ADD COLUMN trial_days INTEGER DEFAULT 30;
-- Bestehende Spalte umbenennen:
ALTER TABLE addons RENAME COLUMN base_price TO price_monthly;
-- Spalte entfernen:
ALTER TABLE addons DROP COLUMN category;
-- DROP TYPE features_category;
```

### Schema: `tenant_addons` (neu, ersetzt `tenant_features`)

```sql
CREATE TABLE tenant_addons (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    addon_id INTEGER NOT NULL REFERENCES addons(id),
    status tenant_addon_status NOT NULL DEFAULT 'trial',
    trial_started_at TIMESTAMPTZ,
    trial_ends_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    payment_reference TEXT,
    custom_price NUMERIC(8,2),
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, addon_id)
);

-- ENUM
CREATE TYPE tenant_addon_status AS ENUM ('trial', 'active', 'expired', 'cancelled');

-- RLS
ALTER TABLE tenant_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_addons FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_addons_isolation ON tenant_addons
    USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::INTEGER);
GRANT SELECT, INSERT, UPDATE, DELETE ON tenant_addons TO app_user;

-- Indexes
CREATE INDEX idx_tenant_addons_tenant ON tenant_addons(tenant_id) WHERE is_active = 1;
CREATE INDEX idx_tenant_addons_status ON tenant_addons(tenant_id, status) WHERE is_active = 1;
```

### Schema: `tenant_storage` (Platzhalter)

```sql
CREATE TABLE tenant_storage (
    uuid UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    storage_limit_gb INTEGER NOT NULL DEFAULT 100,
    storage_used_gb NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active SMALLINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Änderungen an `tenants`

```sql
ALTER TABLE tenants DROP COLUMN current_plan;
ALTER TABLE tenants DROP COLUMN current_plan_id;
-- DROP TYPE tenants_current_plan;
```

### Deprecated ENUMs (zu entfernen)

| ENUM                         | Grund                            |
| ---------------------------- | -------------------------------- |
| `features_category`          | Keine Tier-Kategorien mehr       |
| `tenants_current_plan`       | Keine Plan-Zuordnung mehr        |
| `tenant_plans_status`        | tenant_plans Tabelle entfällt    |
| `tenant_plans_billing_cycle` | tenant_plans Tabelle entfällt    |
| `tenant_addons_addon_type`   | Alte Kapazitäts-Tabelle entfällt |

---

## Backend-Änderungen

### Renames (Konsistenz)

| Alt                                      | Neu                                 |
| ---------------------------------------- | ----------------------------------- |
| `FeatureCheckService`                    | `AddonCheckService`                 |
| `FeatureCheckModule`                     | `AddonCheckModule`                  |
| `@TenantFeature('code')`                 | `@RequireAddon('code')`             |
| `TenantFeatureGuard`                     | `TenantAddonGuard`                  |
| `FeaturesService`                        | `AddonsService`                     |
| `FeaturesController` (`/features`)       | `AddonsController` (`/addons`)      |
| `FeaturesModule`                         | `AddonsModule`                      |
| `RequirePermission(featureCode, ...)`    | `RequirePermission(addonCode, ...)` |
| `user_feature_permissions.feature_code`  | `user_addon_permissions.addon_code` |
| Alle Permission Registrars `featureCode` | `addonCode`                         |

### Löschungen

| Datei/Modul                  | Grund                     |
| ---------------------------- | ------------------------- |
| `PlansService`               | Keine Pläne mehr          |
| `PlansController` (`/plans`) | Keine Plan-Endpoints mehr |
| `PlansModule`                | Keine Plan-Logik mehr     |
| Alle Plan-DTOs               | Obsolet                   |

### AddonCheckService — Neue Logik

```typescript
async checkTenantAccess(tenantId: number, addonCode: string): Promise<boolean> {
    // 1. Addon nachschlagen
    // 2. Wenn addon.is_core → sofort true (immer aktiv)
    // 3. Wenn nicht core → tenant_addons prüfen:
    //    - Status 'active' → true
    //    - Status 'trial' + trial_ends_at > now() → true
    //    - Sonst → false (expired/cancelled/no entry)
}
```

### Deaktivierungslogik — Geändert

```typescript
async deactivateAddon(tenantId: number, addonCode: string): Promise<void> {
    // 1. tenant_addons.status → 'cancelled'
    // 2. tenant_addons.deactivated_at → now()
    // 3. tenant_addons.is_active → 0
    // 4. KEINE Löschung von user_addon_permissions!
    // 5. Daten in allen Addon-Tabellen bleiben unverändert
}
```

---

## Frontend-Änderungen

### Renames

| Alt                        | Neu                      |
| -------------------------- | ------------------------ |
| `feature-guard.ts`         | `addon-guard.ts`         |
| `requireFeature()`         | `requireAddon()`         |
| `filterMenuByFeatures()`   | `filterMenuByAddons()`   |
| `activeFeatures: string[]` | `activeAddons: string[]` |
| `NavItem.featureCode`      | `NavItem.addonCode`      |
| `/feature-unavailable`     | `/addon-unavailable`     |
| `parseActiveFeatures()`    | `parseActiveAddons()`    |

### Betroffene Dateien

- `frontend/src/lib/utils/addon-guard.ts` (Rename + Tests)
- `frontend/src/routes/(app)/+layout.server.ts` (activeAddons statt activeFeatures)
- `frontend/src/routes/(app)/+layout.svelte` (filterMenuByAddons)
- `frontend/src/routes/(app)/_lib/navigation-config.ts` (addonCode)
- Jede `+page.server.ts` mit `requireFeature()` → `requireAddon()`
- `/addon-unavailable/+page.svelte` (Rename von feature-unavailable)

---

## User-Limits — Vereinfacht

| Aspekt        | Alt (Plan-Tiers)                      | Neu (Addon-Modell)                                              |
| ------------- | ------------------------------------- | --------------------------------------------------------------- |
| Max Employees | Basic: 10, Pro: 50, Enterprise: ∞     | **Unbegrenzt** (Core)                                           |
| Max Admins    | Basic: 1, Pro: 3, Enterprise: ∞       | **Unbegrenzt** (Core)                                           |
| Storage       | Basic: 100GB, Pro: 500GB, Ent: 1000GB | **100GB Default** (Core), Upgrade separat über `tenant_storage` |

> **User-Limits entfallen komplett.** Jeder Tenant kann unbegrenzt Users anlegen. Storage-Upgrades sind ein separates Konzept (eigene Tabelle), unabhängig vom Addon-System.

---

## Payment-Integration (Architektur-Vorbereitung)

Die Addon-Architektur ist für Payment-Integration vorbereitet:

- `tenant_addons.status` → steuert Zugang (trial → active nach Zahlung)
- `tenant_addons.payment_reference` → Stripe Subscription ID / PayPal Agreement ID
- `tenant_addons.custom_price` → Override für verhandelte Preise

**In Development:** Addons sind frei aktivierbar/deaktivierbar ohne Payment-Check. Die Payment-Integration (Stripe/PayPal Webhooks → Status-Updates) ist eine eigene Phase nach dem Refactor.

---

## Alternatives Considered

### Option A: Plan-Tiers beibehalten + Einzelkauf ergänzen

Hybrid-Modell: Pläne als "Starterpakete" + Einzelkauf darüber hinaus.

**Verworfen:** Doppelte Komplexität. Zwei Systeme parallel (Plan-Logik + Addon-Logik) mit Konfliktpotenzial. KISS-Prinzip verletzt.

### Option B: Feature-Bundles statt Einzelkauf

Thematische Pakete (z.B. "Produktion" = TPM + Assets + Work Orders).

**Verworfen:** Gleiche Inflexibilität wie Tiers, nur feiner granuliert. Kunde zahlt immer noch für Features die er nicht braucht.

### Option C: `module` statt `addon` als Code-Bezeichnung

**Verworfen:** Direkte Kollision mit NestJS `@Module()`. `TpmModule` (NestJS) vs `modules` Tabelle (Business) — verwirrend. `addon` ist eindeutig.

---

## Consequences

### Positive

1. **Maximale Flexibilität** — Jede Firma zahlt nur für das was sie nutzt
2. **Niedrige Einstiegshürde** — Core-Grundgebühr statt €149+ für Plan-Upgrade
3. **Transparente Preise** — €10/Addon/Monat, keine versteckten Tier-Logik
4. **Einfachere Codebasis** — Kein Plan-Matching, keine Tier-Hierarchie, keine `plan_features` Matrix
5. **Daten-Sicherheit** — Deaktivierung löscht keine Daten und keine Permissions
6. **Unlimited Users** — Kein künstliches Limit auf Mitarbeiter oder Admins
7. **Trial-fähig** — 30 Tage Test pro Addon ohne Commitment

### Negative

1. **Großer Refactor** — ~10 Sessions, 10+ Tabellen, Backend + Frontend betroffen
2. **Migration bestehender Tenants** — Daten müssen korrekt überführt werden
3. **Kein Revenue-Floor pro Tier** — Kunde könnte nur Core kaufen (niedrigster Umsatz)
4. **Payment-Integration offen** — Bis Stripe/PayPal implementiert ist, kein automatisches Billing

### Mitigations

| Problem                       | Mitigation                                               |
| ----------------------------- | -------------------------------------------------------- |
| Großer Refactor               | Phasenweise Umsetzung mit DoD pro Phase, Masterplan      |
| Migration bestehender Tenants | Datenmigration in eigener Migration-Datei mit Rollback   |
| Niedriger Revenue pro Tenant  | Core-Grundgebühr sichert Minimum; Addons sind der Upsell |
| Fehlende Payment-Integration  | Status-basierte Architektur erlaubt spätere Integration  |

---

## References

- [ADR-032: Feature-Katalog und Plan-Tier-Zuordnung](./ADR-032-feature-catalog-and-plan-tiers.md) — **Superseded by this ADR**
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — Permission-Registry-Pattern (bleibt, nur Rename)
- [ADR-024: Frontend Feature Guards](./ADR-024-frontend-feature-guards.md) — Frontend-Gating (bleibt, nur Rename)
- [Masterplan](../../FEAT_ADDON_SYSTEM_MASTERPLAN.md) — Execution Plan für diesen Refactor
