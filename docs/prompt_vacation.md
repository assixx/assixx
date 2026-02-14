# Masterplan: Vacation Request System — Implementation Prompt V2

> **Created:** 2026-02-12
> **Revised:** 2026-02-12 — V2.1: Validation pass — fixed self-approval bug, user_teams constraint, PermissionRegistrar pattern, added missing service specs, renumbered sections, added down() migration note, cross-year algorithm, SSE handler registration
> **Based on:** [brainstorming_vacation.md](./brainstorming_vacation.md)
> **Architecture:** NestJS 11 + Fastify + PostgreSQL 17 + RLS + SvelteKit 5
> **Validation:** Zod + nestjs-zod (NO class-validator)
> **Key ADRs:** ADR-019 (RLS), ADR-007 (ResponseInterceptor), ADR-005 (JWT Auth), ADR-006 (ClsService), ADR-003 (SSE Notifications), ADR-012 (Route Groups), ADR-020 (Permissions), ADR-014 (Migrations), ADR-018 (Vitest)

---

## Required Reading

> **BEFORE implementing, read these documents completely:**
>
> 1. [brainstorming_vacation.md](./brainstorming_vacation.md) — All decisions, research, mockups
> 2. `TYPESCRIPT-STANDARDS.md` — Code standards (`??` not `||`, explicit booleans, no `any`)
> 3. `CODE-OF-CONDUCT.md` + `CODE-OF-CONDUCT-SVELTE.md` — Backend + Frontend conventions
> 4. `DATABASE-MIGRATION-GUIDE.md` — Migration format with node-pg-migrate
> 5. `HOW-TO-TEST-WITH-VITEST.md` — Test patterns (unit + API integration)
> 6. `ZOD-INTEGRATION-GUIDE.md` — DTO patterns with nestjs-zod
> 7. Design System `README.md` — Available CSS primitives

---

## Executive Summary

Build a vacation request system where employees submit leave requests to their direct supervisor (team_lead or deputy_lead). The system provides real-time capacity warnings based on machine staffing requirements, blackout periods, and entitlement balances. Root users and area leads are self-approving. Feature-flagged under `vacation` (basic package).

---

## 0. Architektur-Entscheidungen (Festgelegt)

Diese Entscheidungen wurden im Brainstorming + Q&A getroffen und sind **nicht mehr verhandelbar**:

| #   | Entscheidung                                                | Begruendung                                                                                                                                                                                   |
| --- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **1 Team pro Employee** (Business Rule)                     | Mitarbeiter gehoert genau einem Team an. Validation bei Team-Zuweisung.                                                                                                                       |
| A2  | **Feature Flag** `vacation` in `features` (category=basic)  | Flexibel: Tenant kann deaktivieren. Teil des Basic-Pakets.                                                                                                                                    |
| A3  | **3 getrennte Regel-Tabellen** statt einer `vacation_rules` | `vacation_blackouts`, `vacation_staffing_rules`, `vacation_settings` — saubere Trennung.                                                                                                      |
| A4  | **Kein `used_days` Counter** in `vacation_entitlements`     | Balance wird BERECHNET aus approved Requests. Kein fragiler denormalisierter Zaehler.                                                                                                         |
| A5  | **`days_count` server-seitig berechnet**                    | Niemals vom Client senden. Server berechnet aus Datum + Feiertage + halbe Tage.                                                                                                               |
| A6  | **`deputy_lead_id`** auf `teams` Tabelle                    | Stellvertreter-Lead fuer Genehmigungen wenn Lead abwesend.                                                                                                                                    |
| A7  | **Sonderurlaub-Logik**: `is_special_leave` Checkbox         | Default: Sonderurlaub zieht vom regulaeren Kontingent ab. Lead markiert bei Genehmigung als "Sonderregelung" → kein Abzug. Lead kann auch Tage zum Kontingent hinzufügen (`additional_days`). |
| A8  | **Cross-Year Splitting**                                    | Urlaub ueber Jahreswechsel: Arbeitstage werden pro Kalenderjahr berechnet und vom jeweiligen Jahres-Entitlement abgezogen.                                                                    |
| A9  | **UUID PRIMARY KEY** (UUIDv7) fuer alle neuen Tabellen      | Folgt neuestem Pattern (e2e_key_escrow). Application-generated via `uuidv7()`.                                                                                                                |
| A10 | **Email + SSE Notifications**                               | SSE sofort (ADR-003). Email-Interface vorbereiten (SMTP noch nicht konfiguriert).                                                                                                             |
| A11 | **Audit Trail in V1**                                       | Jede Statusaenderung via `vacation_request_status_log` + `audit_trail` Tabelle.                                                                                                               |
| A12 | **`employee_availability` komplett erneuern**               | Umbenennen zu `user_availability`, `employee_id` → `user_id`. Legacy `absences` Tabelle droppen.                                                                                              |
| A13 | **`cancelled` vs `withdrawn`** klar getrennt                | `withdrawn` = Requester zieht zurück. `cancelled` = Approver/Admin storniert genehmigten Urlaub.                                                                                              |

---

## Phase 1: Database Migration

### Migrations-Konvention

- **Format:** `database/migrations/YYYYMMDD00002X_beschreibung.ts` (Sequenznummer fortsetzen nach 26)
- **PK Pattern:** `id UUID PRIMARY KEY` (application-generated UUIDv7, NICHT SERIAL)
- **FK Pattern:** `tenant_id INTEGER NOT NULL REFERENCES tenants(id)`, `user_id INTEGER NOT NULL REFERENCES users(id)`
- **RLS:** ADR-019 Pattern (MANDATORY fuer alle tenant-scoped Tabellen)
- **GRANTs:** `GRANT SELECT, INSERT, UPDATE, DELETE ON table TO app_user` (kein SEQUENCE Grant bei UUID PK)
- **is_active:** INTEGER `0=inactive, 1=active, 3=archive, 4=deleted`
- **WICHTIG: Jede Migration braucht `up()` UND `down()`** (node-pg-migrate, ADR-014). `down()` muss alle Aenderungen rueckgaengig machen (DROP TABLE, DROP INDEX, ALTER TABLE DROP COLUMN etc.). Die SQL-Snippets unten zeigen jeweils nur `up()` — `down()` ist das Inverse.

### Migration 1: Feature Registration

**File:** `database/migrations/20260212000027_vacation-feature-flag.ts`

```sql
-- Register vacation feature (global, no RLS)
INSERT INTO features (code, name, description, category, base_price, is_active, sort_order)
VALUES (
    'vacation',
    'Urlaubsverwaltung',
    'UrlaubsAnträge, Genehmigungsworkflow, Kapazität splanung, Feiertage, Sperrzeitraeume',
    'basic',
    0.00,
    1,
    50
)
ON CONFLICT (code) DO NOTHING;

-- Permission modules for ADR-020
-- vacation-requests: Anträge stellen/verwalten
-- vacation-rules: Sperren + Mindestbesetzung
-- vacation-entitlements: Urlaubsansprüche verwalten
-- vacation-holidays: Feiertage verwalten
-- vacation-overview: Team-Kalender + Statistiken
```

**WICHTIG:** Der `VacationPermissionRegistrar` (Phase 2) registriert die Module automatisch beim App-Start.

### Migration 2: Teams Extension + Business Rule Enforcement

**File:** `database/migrations/20260212000028_teams-deputy-lead.ts`

```sql
-- Stellvertreter-Lead fuer Genehmigungen wenn Lead abwesend
ALTER TABLE teams ADD COLUMN deputy_lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_teams_deputy_lead ON teams(deputy_lead_id) WHERE deputy_lead_id IS NOT NULL;

COMMENT ON COLUMN teams.deputy_lead_id IS
    'Deputy team lead who approves vacation requests when team_lead_id is absent';

-- ==========================================================================
-- Business Rule A1: 1 Team pro Employee
-- Die bestehende user_teams hat nur UNIQUE(user_id, team_id) — erlaubt N:M.
-- Wir erzwingen 1-Team-pro-User auf DB-Ebene:
-- ==========================================================================
-- Pruefe erst ob Duplikate existieren (verhindert Migration-Fehler):
DO $$
BEGIN
    IF EXISTS (
        SELECT user_id FROM user_teams
        GROUP BY user_id HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'user_teams contains users with multiple teams. Clean up before migration.';
    END IF;
END $$;

CREATE UNIQUE INDEX idx_ut_one_team_per_user ON user_teams(user_id);

COMMENT ON INDEX idx_ut_one_team_per_user IS
    'Business Rule A1: Each employee belongs to exactly one team';
```

**Down-Migration:**

```sql
DROP INDEX IF EXISTS idx_ut_one_team_per_user;
DROP INDEX IF EXISTS idx_teams_deputy_lead;
ALTER TABLE teams DROP COLUMN IF EXISTS deputy_lead_id;
```

### Migration 3: Core Vacation Tables

**File:** `database/migrations/20260212000029_vacation-core-tables.ts`

#### Table 1: `vacation_holidays` (Feiertage pro Tenant)

```sql
CREATE TABLE vacation_holidays (
    id              UUID PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    holiday_date    DATE NOT NULL,
    name            VARCHAR(100) NOT NULL,
    recurring       BOOLEAN NOT NULL DEFAULT true,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, holiday_date)
);

-- Recurring holidays: holiday_date stores the date for the FIRST year.
-- For recurring=true, matching is: EXTRACT(MONTH FROM holiday_date) = month AND EXTRACT(DAY FROM holiday_date) = day
-- LIMITATION: Bewegliche Feiertage (Ostern, Pfingsten) muessen JAEHRLICH als non-recurring eingetragen werden.
-- V2: Admin-Tool fuer automatische Berechnung beweglicher Feiertage.

CREATE INDEX idx_vh_tenant_date ON vacation_holidays(tenant_id, holiday_date);
CREATE INDEX idx_vh_tenant_active ON vacation_holidays(tenant_id) WHERE is_active = 1;

ALTER TABLE vacation_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_holidays FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_holidays FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_holidays TO app_user;
```

#### Table 2: `vacation_entitlements` (Urlaubsanspruch pro User pro Jahr)

```sql
CREATE TABLE vacation_entitlements (
    id                      UUID PRIMARY KEY,
    tenant_id               INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year                    INTEGER NOT NULL,
    total_days              NUMERIC(4,1) NOT NULL DEFAULT 30,
    carried_over_days       NUMERIC(4,1) NOT NULL DEFAULT 0,
    additional_days         NUMERIC(4,1) NOT NULL DEFAULT 0,
    carry_over_expires_at   DATE,
    is_active               INTEGER NOT NULL DEFAULT 1,
    created_by              INTEGER REFERENCES users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, user_id, year),
    -- Nur Vielfache von 0.5 erlaubt (halbe Tage)
    CONSTRAINT valid_total CHECK (total_days >= 0 AND total_days % 0.5 = 0),
    CONSTRAINT valid_carried CHECK (carried_over_days >= 0 AND carried_over_days % 0.5 = 0),
    CONSTRAINT valid_additional CHECK (additional_days >= 0 AND additional_days % 0.5 = 0)
);

-- KEIN used_days Counter! Balance wird BERECHNET:
-- available = total_days + effective_carried + additional_days
-- effective_carried = carried_over_days IF carry_over_expires_at IS NULL OR >= CURRENT_DATE ELSE 0
-- used = SUM(computed_days) FROM vacation_requests WHERE status='approved' AND is_special_leave=false AND year matches
-- remaining = available - used

CREATE INDEX idx_ve_user_year ON vacation_entitlements(tenant_id, user_id, year);

ALTER TABLE vacation_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_entitlements FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_entitlements FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_entitlements TO app_user;
```

#### Table 3: `vacation_requests` (UrlaubsAnträge)

```sql
CREATE TYPE vacation_request_status AS ENUM (
    'pending', 'approved', 'denied', 'withdrawn', 'cancelled'
);

CREATE TYPE vacation_type AS ENUM (
    'regular',
    'special_doctor',
    'special_bereavement',
    'special_birth',
    'special_wedding',
    'special_move',
    'unpaid'
);

CREATE TYPE vacation_half_day AS ENUM (
    'none', 'morning', 'afternoon'
);

CREATE TABLE vacation_requests (
    id                  UUID PRIMARY KEY,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    requester_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    approver_id         INTEGER REFERENCES users(id),
    substitute_id       INTEGER REFERENCES users(id),
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    half_day_start      vacation_half_day NOT NULL DEFAULT 'none',
    half_day_end        vacation_half_day NOT NULL DEFAULT 'none',
    vacation_type       vacation_type NOT NULL DEFAULT 'regular',
    status              vacation_request_status NOT NULL DEFAULT 'pending',
    computed_days       NUMERIC(4,1) NOT NULL,
    is_special_leave    BOOLEAN NOT NULL DEFAULT false,
    request_note        TEXT,
    response_note       TEXT,
    responded_at        TIMESTAMPTZ,
    responded_by        INTEGER REFERENCES users(id),
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Date range must be valid
    CONSTRAINT valid_date_range CHECK (end_date >= start_date),
    -- computed_days must be positive and multiple of 0.5
    CONSTRAINT valid_days CHECK (computed_days > 0 AND computed_days % 0.5 = 0),
    -- Single-day: at most ONE half-day modifier (not both)
    CONSTRAINT valid_half_day_single CHECK (
        start_date != end_date
        OR half_day_start = 'none'
        OR half_day_end = 'none'
    ),
    -- is_special_leave can only be true for approved requests
    CONSTRAINT special_leave_approved CHECK (
        is_special_leave = false OR status = 'approved'
    ),
    -- denied requires response_note
    CONSTRAINT denied_needs_reason CHECK (
        status != 'denied' OR response_note IS NOT NULL
    )
);

CREATE INDEX idx_vr_requester ON vacation_requests(tenant_id, requester_id, status);
CREATE INDEX idx_vr_approver ON vacation_requests(tenant_id, approver_id, status) WHERE approver_id IS NOT NULL;
CREATE INDEX idx_vr_dates ON vacation_requests(tenant_id, start_date, end_date) WHERE status = 'approved';
CREATE INDEX idx_vr_active ON vacation_requests(tenant_id, status) WHERE is_active = 1;

ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_requests FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_requests TO app_user;
```

#### Table 4: `vacation_request_status_log` (Audit Trail pro Antrag)

```sql
CREATE TABLE vacation_request_status_log (
    id              UUID PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    request_id      UUID NOT NULL REFERENCES vacation_requests(id) ON DELETE CASCADE,
    old_status      vacation_request_status,
    new_status      vacation_request_status NOT NULL,
    changed_by      INTEGER NOT NULL REFERENCES users(id),
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vrsl_request ON vacation_request_status_log(request_id);
CREATE INDEX idx_vrsl_tenant ON vacation_request_status_log(tenant_id);

ALTER TABLE vacation_request_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_request_status_log FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_request_status_log FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT ON vacation_request_status_log TO app_user;
```

#### Table 5: `vacation_blackouts` (Urlaubssperren)

```sql
CREATE TABLE vacation_blackouts (
    id              UUID PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    reason          VARCHAR(255),
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    scope_type      VARCHAR(20) NOT NULL DEFAULT 'global',
    scope_id        INTEGER,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_by      INTEGER NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_blackout_range CHECK (end_date >= start_date),
    -- scope_type: 'global' (kein scope_id), 'team' (scope_id=team.id), 'department' (scope_id=dept.id)
    CONSTRAINT valid_scope CHECK (
        (scope_type = 'global' AND scope_id IS NULL)
        OR (scope_type IN ('team', 'department') AND scope_id IS NOT NULL)
    )
);

-- KEIN polymorphes scope_id Problem: scope_type macht den Kontext eindeutig.
-- FK-Constraint auf scope_id ist NICHT moeglich (zeigt auf verschiedene Tabellen).
-- Integritaet wird im Service-Layer geprueft.

CREATE INDEX idx_vb_tenant_dates ON vacation_blackouts(tenant_id, start_date, end_date) WHERE is_active = 1;
CREATE INDEX idx_vb_scope ON vacation_blackouts(tenant_id, scope_type, scope_id) WHERE is_active = 1;

ALTER TABLE vacation_blackouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_blackouts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_blackouts FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_blackouts TO app_user;
```

#### Table 6: `vacation_staffing_rules` (Mindestbesetzung pro Maschine)

```sql
CREATE TABLE vacation_staffing_rules (
    id                  UUID PRIMARY KEY,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    machine_id          INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
    min_staff_count     INTEGER NOT NULL,
    is_active           INTEGER NOT NULL DEFAULT 1,
    created_by          INTEGER NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id, machine_id),
    CONSTRAINT positive_staff CHECK (min_staff_count > 0)
);

-- Immer pro Maschine (nicht pro Team). Brainstorming-Entscheidung 4.1.

CREATE INDEX idx_vsr_machine ON vacation_staffing_rules(tenant_id, machine_id) WHERE is_active = 1;

ALTER TABLE vacation_staffing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_staffing_rules FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_staffing_rules FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_staffing_rules TO app_user;
```

#### Table 7: `vacation_settings` (Tenant-weite Einstellungen)

```sql
CREATE TABLE vacation_settings (
    id                          UUID PRIMARY KEY,
    tenant_id                   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    default_annual_days         NUMERIC(4,1) NOT NULL DEFAULT 30,
    max_carry_over_days         NUMERIC(4,1) NOT NULL DEFAULT 10,
    carry_over_deadline_month   INTEGER NOT NULL DEFAULT 3,
    carry_over_deadline_day     INTEGER NOT NULL DEFAULT 31,
    advance_notice_days         INTEGER NOT NULL DEFAULT 0,
    max_consecutive_days        INTEGER,
    is_active                   INTEGER NOT NULL DEFAULT 1,
    created_by                  INTEGER REFERENCES users(id),
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(tenant_id),
    CONSTRAINT valid_default_days CHECK (default_annual_days > 0 AND default_annual_days % 0.5 = 0),
    CONSTRAINT valid_carry_over CHECK (max_carry_over_days >= 0),
    CONSTRAINT valid_deadline_month CHECK (carry_over_deadline_month BETWEEN 1 AND 12),
    CONSTRAINT valid_deadline_day CHECK (carry_over_deadline_day BETWEEN 1 AND 31)
);

-- Eine Zeile pro Tenant. Wird beim Feature-Aktivierung angelegt.
-- advance_notice_days: Mindest-Vorlaufzeit fuer Anträge (0 = sofort moeglich)
-- max_consecutive_days: NULL = unbegrenzt
-- carry_over_deadline: Bis wann Übertrag-Tage genutzt werden muessen (Default: 31.03.)

ALTER TABLE vacation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON vacation_settings FOR ALL USING (
    NULLIF(current_setting('app.tenant_id', true), '') IS NULL
    OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
);
GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_settings TO app_user;
```

### Migration 4: Availability Rebuild

**File:** `database/migrations/20260212000030_availability-rebuild.ts`

**WICHTIG:** Backend-Code in `user-availability.service.ts` und `teams.service.ts` MUSS gleichzeitig aktualisiert werden (SQL-Referenzen auf Tabellen/Spalten-Namen).

```sql
-- ==========================================================================
-- Step 1: Rename ENUM type
-- ==========================================================================
ALTER TYPE employee_availability_status RENAME TO user_availability_status;

-- ==========================================================================
-- Step 2: Rename table + sequence
-- ==========================================================================
ALTER TABLE employee_availability RENAME TO user_availability;
-- PostgreSQL does NOT auto-rename sequences on table rename
ALTER SEQUENCE employee_availability_id_seq RENAME TO user_availability_id_seq;

-- ==========================================================================
-- Step 3: Rename column employee_id → user_id
-- ==========================================================================
ALTER TABLE user_availability RENAME COLUMN employee_id TO user_id;

-- ==========================================================================
-- Step 4: Drop old indexes, create new ones
-- Actual index names from baseline (prefix idx_19227_):
-- ==========================================================================
DROP INDEX IF EXISTS idx_19227_fk_availability_created_by;
DROP INDEX IF EXISTS idx_19227_idx_availability_dates;
DROP INDEX IF EXISTS idx_19227_idx_availability_employee;
DROP INDEX IF EXISTS idx_19227_idx_availability_status;
DROP INDEX IF EXISTS idx_19227_idx_availability_tenant;

CREATE INDEX IF NOT EXISTS idx_ua_tenant_user ON user_availability(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ua_dates ON user_availability(tenant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_ua_status ON user_availability(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_ua_created_by ON user_availability(created_by) WHERE created_by IS NOT NULL;

-- ==========================================================================
-- Step 5: Recreate RLS policy (drop old, create new)
-- ==========================================================================
DROP POLICY IF EXISTS tenant_isolation ON user_availability;

CREATE POLICY tenant_isolation ON user_availability
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- ==========================================================================
-- Step 6: Rename FK constraints
-- Actual names from baseline: fk_availability_*
-- ==========================================================================
ALTER TABLE user_availability RENAME CONSTRAINT fk_availability_tenant TO fk_ua_tenant;
ALTER TABLE user_availability RENAME CONSTRAINT fk_availability_employee TO fk_ua_user;
ALTER TABLE user_availability RENAME CONSTRAINT fk_availability_created_by TO fk_ua_created_by;

-- ==========================================================================
-- Step 7: Rename trigger function
-- Old: on_update_current_timestamp_employee_availability()
-- ==========================================================================
DROP TRIGGER IF EXISTS on_update_current_timestamp ON user_availability;
DROP FUNCTION IF EXISTS on_update_current_timestamp_employee_availability();

CREATE OR REPLACE FUNCTION on_update_current_timestamp_user_availability()
    RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END$$;

CREATE TRIGGER on_update_current_timestamp
    BEFORE UPDATE ON user_availability
    FOR EACH ROW EXECUTE FUNCTION on_update_current_timestamp_user_availability();

-- Generic update_updated_at_column trigger stays as-is (function is generic)

-- ==========================================================================
-- Step 8: GRANT permissions
-- ==========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON user_availability TO app_user;
GRANT USAGE, SELECT ON SEQUENCE user_availability_id_seq TO app_user;
```

**Backend-Code Aenderungen (gleichzeitig mit Migration):**

- `backend/src/nest/users/user-availability.service.ts`: Alle SQL-Queries von `employee_availability` → `user_availability`, `employee_id` → `user_id`
- `backend/src/nest/teams/teams.service.ts`: LEFT JOIN auf `user_availability` statt `employee_availability`, `ea.employee_id` → `ea.user_id`
- `backend/src/nest/users/users.helpers.ts`: Kommentare aktualisieren
- `backend/src/nest/users/users.types.ts`: Kommentare aktualisieren
- `backend/src/nest/users/dto/update-availability.dto.ts`: Pruefen ob Anpassung noetig

### Migration 5: Legacy Cleanup

**File:** `database/migrations/20260212000031_vacation-legacy-cleanup.ts`

```sql
-- Migrate any existing absences data to vacation_requests
-- ONLY if absences table has data
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM absences LIMIT 1) THEN
        RAISE NOTICE 'absences table has data — manual migration required before DROP';
        -- INSERT INTO vacation_requests (...) SELECT ... FROM absences;
        -- NOTE: Manual review required because absences has different schema
    END IF;
END $$;

-- Drop legacy absences table (was never fully wired up)
DROP TABLE IF EXISTS absences CASCADE;
DROP TYPE IF EXISTS absences_type CASCADE;
DROP TYPE IF EXISTS absences_status CASCADE;
```

---

## Phase 2: Backend (NestJS Module)

### 2.1 Module Structure

```
backend/src/nest/vacation/
    vacation.module.ts
    vacation.controller.ts
    vacation.service.ts                  # Kernlogik: create, respond, withdraw, edit
    vacation-capacity.service.ts         # Kapazität sberechnung (Herzstuck)
    vacation-holidays.service.ts         # Feiertage CRUD + countWorkdays()
    vacation-entitlements.service.ts     # Ansprueche CRUD + getBalance()
    vacation-blackouts.service.ts        # Urlaubssperren CRUD
    vacation-staffing-rules.service.ts   # Mindestbesetzung CRUD
    vacation-settings.service.ts         # Tenant-Settings CRUD
    vacation-notification.service.ts     # SSE + Email-Interface
    vacation.permissions.ts              # ADR-020 Permission Constant (PermissionCategoryDef)
    vacation-permission.registrar.ts     # ADR-020 Permission Registration (uses PermissionRegistryService)
    dto/
        create-vacation-request.dto.ts
        update-vacation-request.dto.ts
        respond-vacation-request.dto.ts
        create-blackout.dto.ts
        update-blackout.dto.ts
        create-staffing-rule.dto.ts
        update-staffing-rule.dto.ts
        create-holiday.dto.ts
        update-holiday.dto.ts
        create-entitlement.dto.ts
        update-entitlement.dto.ts
        vacation-query.dto.ts
        capacity-query.dto.ts
        index.ts
    __tests__/
        vacation.service.test.ts
        vacation-capacity.service.test.ts
        vacation-holidays.service.test.ts
        vacation-entitlements.service.test.ts
        vacation-blackouts.service.test.ts
        vacation-staffing-rules.service.test.ts
```

### 2.2 Wichtige Patterns (NICHT verletzen!)

```typescript
// ✅ RICHTIG: Controller gibt Daten DIREKT zurück (ADR-007 ResponseInterceptor wrapped)
@Get()
async listRequests(...): Promise<VacationRequest[]> {
    return await this.vacationService.getMyRequests(userId, tenantId, query);
}

// ❌ FALSCH: Doppel-Wrapping
@Get()
async listRequests(...) {
    return { success: true, data: await this.vacationService.getMyRequests(...) };
}

// ✅ RICHTIG: db.tenantTransaction() fuer alle tenant-scoped Queries (ADR-019)
async createRequest(tenantId: number, userId: number, dto: CreateVacationRequestDto) {
    return await this.db.tenantTransaction(async (client) => {
        // client.query() innerhalb der Transaction hat RLS-Kontext
    });
}

// ❌ FALSCH: db.query() fuer tenant-Daten (kein RLS!)
async createRequest(tenantId: number, ...) {
    const rows = await this.db.query('SELECT ... FROM vacation_requests WHERE tenant_id = $1', [tenantId]);
}
```

### 2.3 vacation.service.ts — Kernlogik

```
createRequest(userId: number, tenantId: number, dto: CreateVacationRequestDto): Promise<VacationRequest>
    1. Validiere: User hat ein Team (SELECT FROM user_teams WHERE user_id = $1)
       → Wenn kein Team: BadRequestException('Employee must be assigned to a team')
    2. Validiere: start_date >= TODAY + advance_notice_days (aus vacation_settings)
    3. Validiere: Keine ueberlappenden eigenen Requests (pending oder approved)
       SELECT 1 FROM vacation_requests
       WHERE requester_id = $1 AND status IN ('pending', 'approved')
         AND start_date <= $endDate AND end_date >= $startDate
       → Wenn Treffer: ConflictException('Overlapping vacation request exists')
    4. Berechne computed_days via holidays.countWorkdays(startDate, endDate, halfDayStart, halfDayEnd)
    5. Bestimme approver_id anhand Rolle:
       - employee → team_lead_id (oder deputy_lead_id falls team_lead abwesend)
       - admin → area_lead_id (ueber user_departments → departments → areas)
       - area_lead / root → approver_id = NULL, status = 'approved' (auto-genehmigt)
    6. Pruefe Balance: entitlements.getBalance(userId, year) >= computed_days
       → Bei Cross-Year: Pruefe Balance fuer BEIDE Jahre
       → Bei vacation_type = 'unpaid': Keine Balance-Pruefung
    7. Pruefe Blackouts: blackouts.getConflicts(tenantId, startDate, endDate, userTeamId)
       → Wenn Blackout: BadRequestException mit Blackout-Details
    8. INSERT vacation_requests mit id = uuidv7()
    9. INSERT vacation_request_status_log (old_status=NULL, new_status='pending')
   10. Bei auto-genehmigt (Root/Area-Lead):
       - INSERT user_availability (status='vacation', start_date, end_date)
       - INSERT vacation_request_status_log (old_status=NULL, new_status='approved')
       - audit_trail Eintrag
   11. Bei pending: Notification an approver (SSE + Email-Interface)
   12. RETURN created request

respondToRequest(responderId: number, tenantId: number, requestId: UUID, dto: RespondDto): Promise<VacationRequest>
    1. SELECT ... FROM vacation_requests WHERE id = $1 AND status = 'pending' FOR UPDATE
       → Wenn nicht gefunden oder status != 'pending': ConflictException (Race Condition)
    2. Pruefe: responderId = approver_id ODER responderId hat has_full_access
    3. Bei 'approved':
       a. Pruefe nochmal Balance (koennte sich seit Antragstellung geaendert haben)
       b. Setze is_special_leave aus dto (Checkbox vom Lead)
       c. Wenn is_special_leave = false: Pruefe Balance reicht
       d. UPDATE vacation_requests SET status='approved', is_special_leave, responded_at, responded_by
       e. INSERT user_availability (status='vacation')
       f. INSERT vacation_request_status_log
       g. audit_trail Eintrag
       h. Notification an requester: "Dein Urlaub wurde genehmigt"
    4. Bei 'denied':
       a. response_note PFLICHT (wird vom DTO validiert)
       b. UPDATE vacation_requests SET status='denied', response_note, responded_at, responded_by
       c. INSERT vacation_request_status_log
       d. Notification an requester: "Dein Urlaub wurde abgelehnt: {reason}"

withdrawRequest(requesterId: number, tenantId: number, requestId: UUID): Promise<void>
    1. SELECT ... FROM vacation_requests WHERE id = $1 AND requester_id = $2 FOR UPDATE
    2. Status-Check:
       - 'pending' → OK, kann zurueckgezogen werden
       - 'approved' UND start_date > NOW() → OK, aber Storno (Tage zurueckbuchen)
       - 'approved' UND start_date <= NOW() → ForbiddenException('Laufender Urlaub kann nicht storniert werden')
       - Sonstiger Status → ConflictException
    3. UPDATE status = 'withdrawn'
    4. Bei Storno (war approved):
       - DELETE/DEACTIVATE user_availability Eintrag
    5. INSERT vacation_request_status_log
    6. Notification an approver (falls vorhanden)

cancelRequest(adminId: number, tenantId: number, requestId: UUID, reason: string): Promise<void>
    1. Nur fuer Admin/Root: Status 'approved' → 'cancelled'
    2. DELETE/DEACTIVATE user_availability
    3. INSERT status_log + audit_trail
    4. Notification an requester: "Dein genehmigter Urlaub wurde storniert: {reason}"

editRequest(requesterId: number, tenantId: number, requestId: UUID, dto: UpdateDto): Promise<VacationRequest>
    1. Nur wenn status = 'pending' (noch nicht entschieden)
    2. Nur eigene Requests
    3. Neu-Berechnung von computed_days
    4. Alle Validierungen erneut (Balance, Blackouts, Overlap)
    5. UPDATE + status_log

getMyRequests(userId: number, tenantId: number, query: VacationQueryDto): Promise<PaginatedResult>
    → Pagination: page, limit (default 20, max 100)
    → Filter: year, status, vacation_type
    → Sort: created_at DESC

getIncomingRequests(approverId: number, tenantId: number, query: VacationQueryDto): Promise<PaginatedResult>
    → Nur Requests wo approver_id = approverId
    → Filter: status (default 'pending')

getTeamCalendar(tenantId: number, teamId: number, month: number, year: number): Promise<TeamCalendarData>
    → Alle approved Vacations im Zeitraum fuer das Team
```

### 2.4 vacation-capacity.service.ts — Dynamische Hinweise (Herzstuck)

```
analyzeCapacity(tenantId: number, startDate: Date, endDate: Date, requesterId: number): Promise<VacationCapacityAnalysis>

Rueckgabe-Typ:
interface VacationCapacityAnalysis {
    workdays: number;                           // Berechnete Arbeitstage
    teamAnalysis: TeamCapacityItem[];           // Pro Team des Requesters
    machineAnalysis: MachineCapacityItem[];     // Pro Maschine des Teams
    blackoutConflicts: BlackoutConflict[];      // Ueberlappende Sperren
    entitlementCheck: EntitlementCheckResult;   // Balance-Pruefung
    substituteCheck?: SubstituteCheckResult;    // Stellvertreter-Verfuegbarkeit
    overallStatus: 'ok' | 'warning' | 'blocked';
}

interface MachineCapacityItem {
    machineId: number;
    machineName: string;
    minStaffRequired: number;
    currentlyAvailable: number;
    availableAfterApproval: number;
    absentMembers: { userId: number; userName: string; dates: string }[];
    status: 'ok' | 'warning' | 'critical';
}

Algorithmus fuer machineAnalysis:
    1. Finde Team des Requesters:
       SELECT team_id FROM user_teams WHERE user_id = $requesterId AND tenant_id = $tenantId
    2. Finde alle Maschinen dieses Teams:
       SELECT m.id, m.name FROM machines m
       JOIN machine_teams mt ON m.id = mt.machine_id
       WHERE mt.team_id = $teamId AND m.is_active = 1
    3. Fuer JEDEN Tag im Zeitraum (start_date..end_date, nur Arbeitstage):
       a. Zaehle Team-Mitglieder: SELECT COUNT(*) FROM user_teams WHERE team_id = $teamId
       b. Zaehle Abwesende (genehmigte Urlaube + user_availability != 'available'):
          SELECT user_id FROM vacation_requests
          WHERE status = 'approved' AND start_date <= $day AND end_date >= $day
          UNION
          SELECT user_id FROM user_availability
          WHERE status != 'available' AND start_date <= $day AND end_date >= $day
       c. Hole min_staff_count aus vacation_staffing_rules WHERE machine_id = $machineId
       d. available = total - absent
       e. afterApproval = available - 1 (Requester faellt weg)
       f. Status: afterApproval > min → 'ok', afterApproval = min → 'warning', afterApproval < min → 'critical'
    4. Return das SCHLECHTESTE Ergebnis ueber alle Tage (worst-case Tag)
```

### 2.5 vacation-holidays.service.ts

```
getHolidays(tenantId: number, year: number): Promise<VacationHoliday[]>
createHoliday(tenantId: number, userId: number, dto: CreateHolidayDto): Promise<VacationHoliday>
updateHoliday(tenantId: number, id: UUID, dto: UpdateHolidayDto): Promise<VacationHoliday>
deleteHoliday(tenantId: number, id: UUID): Promise<void>

isHoliday(tenantId: number, date: Date): Promise<boolean>
    → Prueft: holiday_date = date (non-recurring) ODER EXTRACT(MONTH,DAY) match (recurring)

countWorkdays(tenantId: number, startDate: Date, endDate: Date, halfDayStart: HalfDay, halfDayEnd: HalfDay): Promise<number>
    Algorithmus:
    1. Lade alle Feiertage fuer den Zeitraum (efficient: ein Query)
    2. Iteriere jeden Tag von start bis end:
       a. Skip Samstag/Sonntag → continue
       b. Skip Feiertag → continue
       c. Erster Tag UND halfDayStart != 'none' → +0.5 statt +1.0
       d. Letzter Tag UND halfDayEnd != 'none' → +0.5 statt +1.0
       e. Sonst → +1.0
    3. Return Summe

    Edge Case: start = end (ein Tag):
    - halfDayStart = 'morning' → 0.5
    - halfDayEnd = 'afternoon' → 0.5
    - Beides 'none' → 1.0
    - Constraint verhindert: halfDayStart != 'none' AND halfDayEnd != 'none' gleichzeitig
```

### 2.6 vacation-entitlements.service.ts

```
getEntitlement(tenantId: number, userId: number, year: number): Promise<VacationEntitlement | null>

getBalance(tenantId: number, userId: number, year?: number): Promise<VacationBalance>
    year default = EXTRACT(YEAR FROM NOW())
    Returns:
    {
        year: number;
        totalDays: number;
        carriedOverDays: number;
        effectiveCarriedOver: number;    // 0 wenn abgelaufen
        additionalDays: number;
        availableDays: number;           // total + effectiveCarried + additional
        usedDays: number;               // BERECHNET aus approved requests
        remainingDays: number;           // available - used
        pendingDays: number;            // Tage in pending Requests
        projectedRemaining: number;     // remaining - pending
    }

    Berechnung usedDays:
    1. SELECT vr.start_date, vr.end_date, vr.half_day_start, vr.half_day_end, vr.computed_days
       FROM vacation_requests vr
       WHERE vr.requester_id = $userId AND vr.status = 'approved'
         AND vr.is_special_leave = false AND vr.is_active = 1
         AND vr.tenant_id = $tenantId
    2. Fuer jeden Request: Berechne Arbeitstage die in $year fallen
       **Cross-Year Splitting Algorithmus:**
       a. Wenn Request komplett in $year liegt (EXTRACT(YEAR FROM start_date) = year
          UND EXTRACT(YEAR FROM end_date) = year): → computed_days zaehlt komplett
       b. Wenn Request ueber Jahreswechsel geht:
          - yearStart = MAX(start_date, '$year-01-01')
          - yearEnd = MIN(end_date, '$year-12-31')
          - daysInYear = countWorkdays(tenantId, yearStart, yearEnd, halfDay*, halfDay*)
            * halfDayStart nur anwenden wenn yearStart == original start_date
            * halfDayEnd nur anwenden wenn yearEnd == original end_date
          - Beispiel: Request 23.12.2026 – 05.01.2027
            → Jahr 2026: countWorkdays(23.12, 31.12) = z.B. 5 Tage
            → Jahr 2027: countWorkdays(01.01, 05.01) = z.B. 3 Tage
    3. SUM = usedDays

createOrUpdateEntitlement(tenantId: number, dto: CreateEntitlementDto): Promise<VacationEntitlement>
    → INSERT ON CONFLICT (tenant_id, user_id, year) UPDATE

addDays(tenantId: number, userId: number, year: number, days: number, reason: string): Promise<VacationEntitlement>
    → UPDATE additional_days = additional_days + $days
    → INSERT audit_trail (resource_type='vacation_entitlement', action='add_days', changes={days, reason})

carryOverRemainingDays(tenantId: number, userId: number, fromYear: number): Promise<void>
    1. Berechne remaining = getBalance(userId, fromYear).remainingDays
    2. Lade vacation_settings.max_carry_over_days
    3. carryOver = MIN(remaining, maxCarryOver)
    4. carry_over_expires_at = fromYear+1 - deadline_month - deadline_day (aus settings)
    5. UPSERT vacation_entitlements fuer toYear mit carried_over_days = carryOver
```

### 2.7 vacation-blackouts.service.ts

```
getBlackouts(tenantId: number, year?: number): Promise<VacationBlackout[]>
    → Filter: is_active = 1
    → Wenn year: start_date oder end_date faellt in dieses Jahr

createBlackout(tenantId: number, userId: number, dto: CreateBlackoutDto): Promise<VacationBlackout>
    1. Validiere scope: scope_type='global' → scope_id muss NULL sein
       scope_type='team' → scope_id muss existierende teams.id sein
       scope_type='department' → scope_id muss existierende departments.id sein
       → Sonst BadRequestException
    2. Validiere: end_date >= start_date
    3. INSERT mit id = uuidv7()
    4. RETURN created blackout

updateBlackout(tenantId: number, id: UUID, dto: UpdateBlackoutDto): Promise<VacationBlackout>
    1. SELECT ... WHERE id = $1 AND is_active = 1
    2. Validiere scope wie bei create
    3. UPDATE + RETURN

deleteBlackout(tenantId: number, id: UUID): Promise<void>
    → Soft-Delete: UPDATE SET is_active = 4

getConflicts(tenantId: number, startDate: Date, endDate: Date, userTeamId?: number, userDeptId?: number): Promise<VacationBlackout[]>
    → Finde Blackouts die mit dem Zeitraum ueberlappen UND fuer den User gelten:
      WHERE is_active = 1
        AND start_date <= $endDate AND end_date >= $startDate
        AND (
            scope_type = 'global'
            OR (scope_type = 'team' AND scope_id = $userTeamId)
            OR (scope_type = 'department' AND scope_id = $userDeptId)
        )
    → Wenn Ergebnis nicht leer: Antrag ist BLOCKED
```

### 2.8 vacation-staffing-rules.service.ts

```
getStaffingRules(tenantId: number): Promise<VacationStaffingRule[]>
    → Alle aktiven Regeln mit JOIN auf machines.name

createStaffingRule(tenantId: number, userId: number, dto: CreateStaffingRuleDto): Promise<VacationStaffingRule>
    1. Pruefe: machine_id existiert und ist aktiv
    2. INSERT mit id = uuidv7()
    3. Bei UNIQUE violation (tenant_id, machine_id) → ConflictException
    4. RETURN created rule

updateStaffingRule(tenantId: number, id: UUID, dto: UpdateStaffingRuleDto): Promise<VacationStaffingRule>
    1. SELECT ... WHERE id = $1 AND is_active = 1
    2. UPDATE min_staff_count + RETURN

deleteStaffingRule(tenantId: number, id: UUID): Promise<void>
    → Soft-Delete: UPDATE SET is_active = 4

getForMachines(tenantId: number, machineIds: number[]): Promise<Map<number, number>>
    → Bulk-Query: SELECT machine_id, min_staff_count WHERE machine_id = ANY($1)
    → Return Map<machineId, minStaffCount>
```

### 2.9 vacation-settings.service.ts

```
getSettings(tenantId: number): Promise<VacationSettings>
    1. SELECT ... WHERE tenant_id = $1 AND is_active = 1
    2. Wenn nicht gefunden: ensureDefaults(tenantId) aufrufen und nochmal laden
    3. RETURN settings

updateSettings(tenantId: number, userId: number, dto: UpdateSettingsDto): Promise<VacationSettings>
    1. UPSERT: INSERT ... ON CONFLICT (tenant_id) DO UPDATE
    2. audit_trail Eintrag
    3. RETURN updated settings

ensureDefaults(tenantId: number): Promise<void>
    → INSERT ... ON CONFLICT DO NOTHING
    → Erstellt Default-Zeile (30 Tage, 10 Übertrag, Deadline 31.03, etc.)
    → Wird automatisch aufgerufen wenn Feature fuer Tenant aktiviert wird
```

### 2.10 Bestimmung des Approvers

```
getApprover(tenantId: number, userId: number): Promise<{ approverId: number | null; autoApproved: boolean }>

Logik:
1. Lade User mit Rolle:
   SELECT u.id, u.role FROM users u WHERE u.id = $userId AND u.tenant_id = $tenantId

2. Switch auf Rolle:
   case 'employee':
     a. Lade Team: SELECT t.id AS team_id, t.team_lead_id, t.deputy_lead_id FROM teams t
        JOIN user_teams ut ON t.id = ut.team_id WHERE ut.user_id = $userId
     b. Wenn KEIN team_lead_id auf Team:
        → BadRequestException('Team has no lead assigned. Contact your administrator.')
     c. **SELF-APPROVAL CHECK:** Wenn team_lead_id === userId:
        → User IST der Team-Lead. Kann sich nicht selbst genehmigen.
        → Eskalation: Pruefe ob Area-Lead existiert (wie bei Admin-Logik):
          SELECT a.area_lead_id FROM areas a
          JOIN departments d ON a.id = d.area_id
          JOIN user_departments ud ON d.id = ud.department_id
          WHERE ud.user_id = $userId AND ud.is_primary = true
        → Wenn area_lead_id vorhanden: return { approverId: area_lead_id, autoApproved: false }
        → Wenn KEIN area_lead_id: return { approverId: null, autoApproved: true }
          (Team-Lead ohne Bereichsleiter → auto-approve, analog zu Admin ohne Area-Lead)
     d. Wenn team_lead_id vorhanden UND !== userId:
        - Pruefe ob Lead verfuegbar (nicht selbst im Urlaub):
          SELECT 1 FROM user_availability WHERE user_id = team_lead_id
            AND status != 'available' AND start_date <= NOW() AND end_date >= NOW()
        - Wenn verfuegbar: return { approverId: team_lead_id, autoApproved: false }
        - Wenn abwesend UND deputy_lead_id vorhanden UND deputy_lead_id !== userId:
          return { approverId: deputy_lead_id, autoApproved: false }
        - Wenn abwesend UND (kein Deputy ODER deputy === userId):
          return { approverId: team_lead_id, autoApproved: false }
          (Lead bekommt Notification nach Rueckkehr)

   case 'admin':
     a. Lade Area: SELECT a.area_lead_id FROM areas a
        JOIN departments d ON a.id = d.area_id
        JOIN user_departments ud ON d.id = ud.department_id
        WHERE ud.user_id = $userId AND ud.is_primary = true
     b. Wenn area_lead_id vorhanden: return { approverId: area_lead_id, autoApproved: false }
     c. Wenn KEIN area_lead_id: Auto-approve (Admin ohne Bereichsleiter)

   case 'root':
     return { approverId: null, autoApproved: true }

   -- Area-Lead Check (kein eigener DB-Rollen-Typ):
   Pruefe ob User area_lead_id in irgendeiner Area ist:
   SELECT 1 FROM areas WHERE area_lead_id = $userId AND tenant_id = $tenantId
   → Wenn ja: return { approverId: null, autoApproved: true }
```

### 2.11 API Endpoints

**Feature-Flag Check (MANDATORY):** Jeder Controller-Endpoint muss pruefen ob der Tenant das Feature 'vacation' aktiviert hat. Es gibt KEINEN `@Feature()`-Decorator — stattdessen inline im Controller oder als private Guard-Methode:

```typescript
// FeatureCheckService injizieren, dann am Anfang jeder Methode:
const hasAccess = await this.featureCheck.checkTenantAccess(tenantId, 'vacation');
if (!hasAccess) {
  throw new ForbiddenException('Vacation feature is not enabled for this tenant');
}
// Referenz: backend/src/nest/feature-check/feature-check.service.ts
```

```
# === Requests ===
POST   /api/v2/vacation/requests                    # Neuen Antrag stellen
GET    /api/v2/vacation/requests                    # Eigene Anträge (query: year, status, page, limit)
GET    /api/v2/vacation/requests/incoming            # Eingehende Anträge fuer Approver (query: status, page, limit)
GET    /api/v2/vacation/requests/:id                 # Einzelner Antrag (UUID)
PATCH  /api/v2/vacation/requests/:id                 # Antrag bearbeiten (nur pending, nur eigene)
PATCH  /api/v2/vacation/requests/:id/respond         # Genehmigen/Ablehnen (Approver)
PATCH  /api/v2/vacation/requests/:id/withdraw        # Zurückziehen (Requester)
PATCH  /api/v2/vacation/requests/:id/cancel          # Stornieren (Admin/Root, nur approved)

# === Capacity ===
GET    /api/v2/vacation/capacity                    # Kapazität scheck (query: startDate, endDate, requesterId?)

# === Entitlements ===
GET    /api/v2/vacation/entitlements/me              # Eigener Anspruch + Balance
GET    /api/v2/vacation/entitlements/:userId          # Anspruch eines Users (Admin/Root)
PUT    /api/v2/vacation/entitlements/:userId          # Anspruch bearbeiten (Admin/Root)
POST   /api/v2/vacation/entitlements/:userId/add-days # Tage hinzufügen (Lead/Admin/Root)

# === Blackouts ===
GET    /api/v2/vacation/blackouts                   # Alle Sperren (query: year)
POST   /api/v2/vacation/blackouts                   # Neue Sperre (Lead/Admin/Root)
PUT    /api/v2/vacation/blackouts/:id               # Sperre bearbeiten
DELETE /api/v2/vacation/blackouts/:id               # Sperre loeschen

# === Staffing Rules ===
GET    /api/v2/vacation/staffing-rules              # Alle Regeln
POST   /api/v2/vacation/staffing-rules              # Neue Regel (Lead/Admin/Root)
PUT    /api/v2/vacation/staffing-rules/:id          # Regel bearbeiten
DELETE /api/v2/vacation/staffing-rules/:id          # Regel loeschen

# === Holidays ===
GET    /api/v2/vacation/holidays                    # Feiertage (query: year)
POST   /api/v2/vacation/holidays                    # Feiertag eintragen (Root/has_full_access Admin)
PUT    /api/v2/vacation/holidays/:id                # Feiertag bearbeiten
DELETE /api/v2/vacation/holidays/:id                # Feiertag loeschen

# === Settings ===
GET    /api/v2/vacation/settings                    # Tenant-Settings laden
PUT    /api/v2/vacation/settings                    # Settings bearbeiten (Admin/Root)

# === Overview ===
GET    /api/v2/vacation/team-calendar               # Team-Kalender (query: teamId, month, year)
GET    /api/v2/vacation/overview                    # Jahresuebersicht alle Mitarbeiter (Admin/Root, query: year, page, limit)
```

**Pagination auf ALLEN List-Endpoints:** `page` (default 1), `limit` (default 20, max 100)

### 2.12 Permission Registrar (ADR-020)

**Referenz-Pattern:** `backend/src/nest/shifts/shifts-permission.registrar.ts` + `shifts.permissions.ts`

**Datei 1:** `vacation.permissions.ts` (Companion: exportiert die Permission-Definition)

```typescript
// vacation.permissions.ts
import { type PermissionCategoryDef } from '../admin-permissions/permission-registry.service';

export const VACATION_PERMISSIONS: PermissionCategoryDef = {
  featureCode: 'vacation',
  modules: [
    { code: 'vacation-requests', name: 'UrlaubsAnträge' },
    { code: 'vacation-rules', name: 'Regeln & Sperren' },
    { code: 'vacation-entitlements', name: 'Urlaubsansprüche' },
    { code: 'vacation-holidays', name: 'Feiertage' },
    { code: 'vacation-overview', name: 'Uebersicht & Kalender' },
  ],
};
```

**Datei 2:** `vacation-permission.registrar.ts`

```typescript
// vacation-permission.registrar.ts
@Injectable()
export class VacationPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(VACATION_PERMISSIONS);
  }
}
```

**WICHTIG:** `PermissionRegistryService` injizieren, NICHT `DatabaseService`. Die `register()`-Methode uebernimmt die DB-Eintraege automatisch.

### 2.13 Notification Integration

**Referenz-Pattern:** `backend/src/utils/eventBus.ts` — Singleton `NotificationEventBus extends EventEmitter` mit typed Methods (z.B. `emitSurveyCreated()`).

**Schritt 1: EventBus erweitern** (`backend/src/utils/eventBus.ts`):

```typescript
// Event-Interface hinzufügen:
export interface VacationRequestEvent {
    request: {
        id: string;
        requesterName: string;
        startDate: string;
        endDate: string;
        status?: string;
    };
}

// Typed Methoden in NotificationEventBus Klasse hinzufügen:
emitVacationRequestCreated(tenantId: number, request: VacationRequestEvent['request']): void {
    this.emit('vacation.request.created', { tenantId, request });
}

emitVacationRequestResponded(tenantId: number, request: VacationRequestEvent['request']): void {
    this.emit('vacation.request.responded', { tenantId, request });
}

emitVacationRequestWithdrawn(tenantId: number, request: VacationRequestEvent['request']): void {
    this.emit('vacation.request.withdrawn', { tenantId, request });
}

emitVacationRequestCancelled(tenantId: number, request: VacationRequestEvent['request']): void {
    this.emit('vacation.request.cancelled', { tenantId, request });
}
```

**Schritt 2: Notification Service** (`vacation-notification.service.ts`):

```typescript
@Injectable()
export class VacationNotificationService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly db: DatabaseService,
  ) {}

  /** SSE: Neuer Antrag fuer Approver */
  async notifyNewRequest(tenantId: number, request: VacationRequest): Promise<void> {
    // WICHTIG: Typed Method verwenden, NICHT raw emit()!
    eventBus.emitVacationRequestCreated(tenantId, {
      id: request.id,
      requesterName: '...', // Laden via User-Query
      startDate: request.start_date.toISOString(),
      endDate: request.end_date.toISOString(),
    });
    // Email (Stub — wird spaeter aktiviert sobald SMTP konfiguriert):
    // logger.info('Email would be sent:', { to: approverEmail, subject: 'Neuer Urlaubsantrag' });
  }

  /** SSE: Antrag genehmigt/abgelehnt */
  async notifyRequestResponse(tenantId: number, request: VacationRequest): Promise<void> {
    eventBus.emitVacationRequestResponded(tenantId, {
      id: request.id,
      requesterName: '...',
      startDate: request.start_date.toISOString(),
      endDate: request.end_date.toISOString(),
      status: request.status,
    });
  }
}
```

**Schritt 3: SSE Handler registrieren** (`backend/src/nest/notifications/notifications.controller.ts`):

In `registerSSEHandlers()` — Referenz: existierender `canAccess('documents')` Block:

```typescript
// Vacation: nur wenn User vacation-Feature hat
if (canAccess('vacation')) {
  registerHandler(handlers, 'vacation.request.created', makeHandler('VACATION_REQUEST_CREATED', 'request'));
  registerHandler(handlers, 'vacation.request.responded', makeHandler('VACATION_REQUEST_RESPONDED', 'request'));
  registerHandler(handlers, 'vacation.request.withdrawn', makeHandler('VACATION_REQUEST_WITHDRAWN', 'request'));
  registerHandler(handlers, 'vacation.request.cancelled', makeHandler('VACATION_REQUEST_CANCELLED', 'request'));
}
```

**Schritt 4: Email-Interface** (Stub fuer spaetere SMTP-Aktivierung):

```typescript
interface VacationEmailService {
  sendRequestCreated(to: string, request: VacationRequest): Promise<void>;
  sendRequestApproved(to: string, request: VacationRequest): Promise<void>;
  sendRequestDenied(to: string, request: VacationRequest, reason: string): Promise<void>;
  sendRequestWithdrawn(to: string, request: VacationRequest): Promise<void>;
}
// Implementierung: logger.info('Email would be sent to', to, 'Subject:', ...);
```

---

## Phase 3: Frontend (SvelteKit 5)

### 3.1 Route-Gruppen (ADR-012)

```
frontend/src/routes/(app)/
    (shared)/vacation/                       # Alle authentifizierten Rollen
        +page.svelte                         # Hauptseite (rollenabhaengig)
        +page.server.ts                      # Auth + Feature-Flag Check
        _lib/
            api.ts                           # API-Calls (apiClient Wrapper)
            types.ts                         # TypeScript Interfaces
            constants.ts                     # Status-Labels, Farben, Enums
            state.svelte.ts                  # Shared State (Svelte 5 Runes)
            state-data.svelte.ts             # Data State (requests, entitlements)
            state-ui.svelte.ts               # UI State (filters, modals)
            RequestForm.svelte               # Inline-Antrag-Formular mit Live-Capacity
            RequestCard.svelte               # Einzelner Antrag mit Status-Badge
            IncomingRequestCard.svelte       # Antrag fuer Lead mit Kapazität s-Hinweisen
            CapacityIndicator.svelte         # Ampel-Anzeige (ok/warning/critical)
            TeamCalendarPreview.svelte       # Mini-Kalender: Wer ist wann weg
            EntitlementBadge.svelte          # "18/30 Tage uebrig" Badge
            VacationFilters.svelte           # Filter (Jahr, Status, Typ)
            SpecialLeaveCheckbox.svelte      # Sonderregelung-Checkbox fuer Lead

    (admin)/vacation/
        rules/
            +page.svelte
            +page.server.ts
            _lib/
                api.ts
                types.ts
                BlackoutForm.svelte          # Urlaubssperre erstellen/bearbeiten
                BlackoutCard.svelte          # Einzelne Sperre
                StaffingRuleForm.svelte      # Mindestbesetzung pro Maschine
                StaffingRuleCard.svelte      # Mindestbesetzung Anzeige
                SettingsForm.svelte          # Tenant-weite Einstellungen

        entitlements/
            +page.svelte
            +page.server.ts
            _lib/
                api.ts
                types.ts
                EntitlementTable.svelte      # Tabelle aller Mitarbeiter
                EntitlementEditModal.svelte   # Anspruch bearbeiten
                AddDaysModal.svelte          # Tage hinzufügen (mit Grund)

        overview/
            +page.svelte
            +page.server.ts
            _lib/
                api.ts
                types.ts
                YearOverview.svelte          # Gantt-artige Jahresansicht
                TeamCalendar.svelte          # Monatskalender mit Abwesenheiten

    (root)/vacation/
        holidays/
            +page.svelte
            +page.server.ts
            _lib/
                api.ts
                types.ts
                HolidayTable.svelte          # Feiertags-Liste mit CRUD
                HolidayForm.svelte           # Feiertag erstellen/bearbeiten
```

### 3.2 Hauptseite `/vacation` — Rollenabhaengig

**+page.server.ts:**

```typescript
export const load: LayoutServerLoad = async ({ parent }) => {
  const { user } = await parent();
  // Feature-Flag Check: Ist 'vacation' fuer diesen Tenant aktiv?
  // → Redirect wenn nicht aktiv
  return { user };
};
```

**Employee sieht:**

1. EntitlementBadge: "18/30 Tage uebrig" (GET /vacation/entitlements/me)
2. RequestForm: Inline-Formular mit:
   - Datum von/bis (Date-Picker)
   - Urlaubstyp (Dropdown: regular, special\_\*, unpaid)
   - Halber Tag: Checkbox "Erster Tag halbtags" + "Letzter Tag halbtags"
   - Stellvertreter (Dropdown: Team-Mitglieder)
   - Kommentar (optional Textarea)
3. Live-Kapazität scheck: Debounced (300ms) API-Call auf GET /vacation/capacity
   - CapacityIndicator pro Check-Punkt (Ampel: ok/warning/critical)
4. Liste eigener Anträge mit Status-Badges + VacationFilters
5. TeamCalendarPreview: Wer im Team ist wann weg

**Lead/Admin sieht (zusaetzlich):**

1. Tab "Eingehende Anträge" (GET /vacation/requests/incoming)
2. IncomingRequestCard pro Antrag:
   - Volle Kapazität sanalyse (API-Call pro Antrag)
   - Genehmigen-Button (mit optionalem SpecialLeaveCheckbox)
   - Ablehnen-Button → Modal mit Pflicht-Textfeld fuer Grund
3. Eigene Anträge (Lead ist auch Mitarbeiter)

**Root/Area-Lead sieht:**

1. Direkte Eintragung (kein Approval-Flow, sofort approved)
2. Uebersicht aller Abwesenheiten

### 3.3 Kapazität s-Hinweise — UX Flow

```
Employee waehlt Datum:
  → Debounced API-Call (300ms) an GET /vacation/capacity?startDate=X&endDate=Y
  → Response zeigt inline:
     [INFO] Arbeitstage: 6 (exkl. Wochenende + Feiertage)
     [OK]   Restanspruch: 18 Tage reichen
     [OK]   Keine Urlaubssperre
     [WARN] Maschine CNC-1: Mindestbesetzung 3, nach Genehmigung nur 3
     [OK]   Team: 1 von 8 im Urlaub
     [BLOCKED] Urlaubssperre "Inventur" 15-20 März → Antrag nicht moeglich

Lead oeffnet eingehenden Antrag:
  → Automatischer API-Call an GET /vacation/capacity?startDate=X&endDate=Y&requesterId=Z
  → Detaillierte Analyse:
     - Namentliche Auflistung wer im Zeitraum fehlt
     - Pro Maschine: Wer genau ist verfuegbar vs. Mindestbesetzung
     - Stellvertreter-Verfuegbarkeit (wenn angegeben)
     - Resturlaub des Antragstellers
```

### 3.4 Design System Integration

- **Status-Badges:** Design System CSS-Klassen: `badge--warning` (pending), `badge--success` (approved), `badge--danger` (denied/cancelled), `badge--neutral` (withdrawn)
- **Kapazität s-Ampel:** Eigene `CapacityIndicator.svelte` mit CSS-Variablen fuer ok/warning/critical
- **Formular:** Design System Primitives: `form-field`, `input`, `select`, `textarea`
- **Karten:** `card-base` fuer Anträge, `card-stat` fuer Statistiken
- **Modals:** `modal.base.css` fuer Ablehnungs-Grund, Tage-Hinzufuegen
- **Tabellen:** `table-base` fuer EntitlementTable, HolidayTable
- **Svelte 5 Runes:** `$state`, `$derived`, `$effect` — KEINE legacy Stores

### 3.5 State Management Pattern

Folge dem Calendar-Pattern mit modularen State-Dateien:

```typescript
// state-data.svelte.ts
let requests = $state<VacationRequest[]>([]);
let entitlement = $state<VacationBalance | null>(null);
let incomingRequests = $state<VacationRequest[]>([]);

export const dataState = {
  get requests() {
    return requests;
  },
  get entitlement() {
    return entitlement;
  },
  get incomingRequests() {
    return incomingRequests;
  },
  setRequests(data: VacationRequest[]) {
    requests = data;
  },
  setEntitlement(data: VacationBalance) {
    entitlement = data;
  },
  // ...
};
```

### 3.6 apiClient Pattern (KRITISCH — Kaizen-Bug vermeiden!)

```typescript
// ✅ RICHTIG: apiClient.get<T>() gibt DIREKT data zurück (unwrapped)
const balance = await apiClient.get<VacationBalance>('/vacation/entitlements/me');
// balance ist DIREKT das VacationBalance-Objekt

// ❌ FALSCH: Generic Typ als Wrapper
const response = await apiClient.get<{ success: boolean; data: VacationBalance }>('/vacation/entitlements/me');
// response.data → undefined! (bereits unwrapped)
```

---

## Phase 4: Integration

### 4.1 Kalender-Integration

Genehmigte Urlaube im bestehenden Calendar-Feature anzeigen:

```typescript
// In calendar service oder via neuen endpoint:
// GET /api/v2/calendar/events erweitern um vacation-Events
// ODER: Frontend merged vacation-approved-data in Calendar-Ansicht client-seitig
```

**Ansatz:** Frontend-seitig mergen. Calendar holt seine Events, Vacation holt genehmigte Requests fuer den Monat. TeamCalendar-Komponente zeigt beides.

### 4.2 Shift-Planning Impact

Wenn ein Urlaubsantrag genehmigt wird und der User Schichten im Zeitraum hat:

```typescript
// In vacation.service.ts nach Genehmigung:
// 1. Pruefe ob User Schichten im Urlaubszeitraum hat
// 2. Wenn ja: Warnung an Lead (Notification)
// 3. NICHT automatisch loeschen (Lead entscheidet manuell)
// V2: Automatische Schicht-Umplanung mit Bestaetigung
```

### 4.3 Email-Vorbereitung

```typescript
// vacation-notification.service.ts
interface VacationEmailService {
  sendRequestCreated(to: string, request: VacationRequest): Promise<void>;
  sendRequestApproved(to: string, request: VacationRequest): Promise<void>;
  sendRequestDenied(to: string, request: VacationRequest, reason: string): Promise<void>;
  sendRequestWithdrawn(to: string, request: VacationRequest): Promise<void>;
}

// Implementierung als Stub der nur loggt:
// logger.info('Email would be sent to', to, 'Subject:', ...);
// Wird aktiviert sobald SMTP konfiguriert ist.
```

---

## Phase 5: Tests (ADR-018)

### Unit Tests (Vitest)

```
backend/src/nest/vacation/__tests__/
    vacation.service.test.ts
      Kernlogik:
      - createRequest: Employee → approver = team_lead_id ✓
      - createRequest: Employee mit abwesendem Lead → approver = deputy_lead_id ✓
      - createRequest: Admin → approver = area_lead_id ✓
      - createRequest: Root → auto-approved, kein approver ✓
      - createRequest: Area-Lead (User ist area_lead_id) → auto-approved ✓
      - createRequest: Employee ohne Team → BadRequestException ✓
      - createRequest: Team ohne Lead → BadRequestException ✓
      - createRequest: Balance insufficient → BadRequestException ✓
      - createRequest: Blackout period → BadRequestException ✓
      - createRequest: Overlapping request → ConflictException ✓
      - createRequest: start_date < TODAY → BadRequestException ✓
      - createRequest: Cross-year split korrekt → Tage pro Jahr berechnet ✓
      - createRequest: vacation_type = 'unpaid' → keine Balance-Pruefung ✓
      - respondToRequest: Approve → updates availability ✓
      - respondToRequest: Approve mit is_special_leave → kein Balance-Abzug ✓
      - respondToRequest: Deny ohne note → BadRequestException ✓
      - respondToRequest: Auf nicht-pending → ConflictException ✓
      - respondToRequest: Von nicht-approver → ForbiddenException ✓
      - respondToRequest: Race condition (parallel approve) → ConflictException ✓
      - withdrawRequest: Own pending → ok ✓
      - withdrawRequest: Own approved (future) → ok + availability geloescht ✓
      - withdrawRequest: Own approved (past/current) → ForbiddenException ✓
      - withdrawRequest: Other user → ForbiddenException ✓
      - editRequest: Pending → ok ✓
      - editRequest: Approved → ConflictException ✓
      - cancelRequest: Admin cancels approved → ok ✓
      - cancelRequest: Employee tries → ForbiddenException ✓

    vacation-capacity.service.test.ts
      - analyzeCapacity: No conflicts → all ok ✓
      - analyzeCapacity: Machine min_staff violated → critical ✓
      - analyzeCapacity: Blackout overlap → conflict returned ✓
      - analyzeCapacity: Entitlement insufficient → insufficient ✓
      - analyzeCapacity: Substitute available → shows in result ✓
      - analyzeCapacity: Substitute on vacation → shows unavailable ✓
      - analyzeCapacity: Multiple machines affected → worst-case per machine ✓

    vacation-holidays.service.test.ts
      - countWorkdays: Normal Mon-Fri → 5 ✓
      - countWorkdays: Week with holiday → 4 ✓
      - countWorkdays: Half day start → 4.5 ✓
      - countWorkdays: Half day end → 4.5 ✓
      - countWorkdays: Both half days (multi-day) → 4.0 ✓
      - countWorkdays: Single day full → 1.0 ✓
      - countWorkdays: Single day half → 0.5 ✓
      - countWorkdays: Weekend excluded → correct ✓
      - countWorkdays: Recurring holiday matched → correct ✓
      - isHoliday: Non-recurring exact date → true ✓
      - isHoliday: Recurring month/day match → true ✓
      - CRUD: Duplicate holiday_date → ConflictException ✓

    vacation-entitlements.service.test.ts
      - getBalance: Correct calculation (total + carried + additional - used) ✓
      - getBalance: Expired carry-over excluded ✓
      - getBalance: Cross-year request split correctly ✓
      - getBalance: is_special_leave excluded from used_days ✓
      - addDays: Increments additional_days ✓
      - carryOver: Respects max carry-over ✓
      - carryOver: Sets correct expiry date ✓
      - Duplicate (tenant, user, year) → ConflictException ✓

    vacation-blackouts.service.test.ts
      - CRUD operations ✓
      - getConflicts: Date range overlap logic ✓
      - getConflicts: Scope filtering (global vs team) ✓
      - Duplicate → handled gracefully ✓

    vacation-staffing-rules.service.test.ts
      - CRUD operations ✓
      - Unique (tenant, machine) → ConflictException ✓
      - min_staff_count validation ✓
```

### API Integration Tests

```
backend/test/vacation.api.test.ts
    Auth:
    - Unauthenticated → 401 ✓
    - Feature disabled → 403 or relevant error ✓

    Requests:
    - POST /vacation/requests → 201 (employee, correct approver set) ✓
    - POST /vacation/requests → 201 auto-approved (root) ✓
    - POST /vacation/requests → 400 insufficient balance ✓
    - POST /vacation/requests → 409 overlapping ✓
    - GET /vacation/requests → own requests only (pagination) ✓
    - GET /vacation/requests/incoming → only for approvers ✓
    - PATCH /vacation/requests/:id → edit pending request ✓
    - PATCH /vacation/requests/:id/respond → approve ✓
    - PATCH /vacation/requests/:id/respond → deny with note ✓
    - PATCH /vacation/requests/:id/withdraw → requester withdraws ✓
    - PATCH /vacation/requests/:id/cancel → admin cancels ✓

    Capacity:
    - GET /vacation/capacity → returns analysis ✓

    CRUD:
    - CRUD holidays (root/has_full_access only) ✓
    - CRUD blackouts (admin/root only) ✓
    - CRUD staffing-rules (admin/root only) ✓
    - CRUD entitlements (admin/root only) ✓
    - GET/PUT settings (admin/root only) ✓

    RLS:
    - Tenant A cannot see Tenant B data ✓
    - Employee cannot see other employee's entitlements ✓
```

---

## Phase 6: Definition of Done

### Migration

- [ ] Feature 'vacation' in features Tabelle registriert
- [ ] deputy_lead_id auf teams Tabelle
- [ ] `UNIQUE(user_id)` auf user_teams erzwungen (Business Rule A1: 1 Team pro Employee)
- [ ] 7 neue Tabellen erstellt (holidays, entitlements, requests, status_log, blackouts, staffing_rules, settings)
- [ ] Alle mit UUID PK, RLS, GRANTs, Indexes
- [ ] employee_availability → user_availability umbenannt (Spalte + Tabelle + Indexes + RLS)
- [ ] Legacy absences Tabelle gedroppt (nach Datenmigration falls noetig)
- [ ] Dry-run + Apply erfolgreich
- [ ] `down()` Migration fuer jede `up()` vorhanden (ADR-014)
- [ ] `database/seeds/` aktualisiert: Default-Feiertage (DE) fuer Demo-Tenant
- [ ] customer/fresh-install synchronisiert

### Backend

- [ ] vacation.module.ts mit allen Services + Controller registriert
- [ ] Alle Endpoints implementiert und erreichbar
- [ ] Genehmigungskette korrekt (Employee→Lead/Deputy, Admin→AreaLead, Root→Auto, AreaLead→Auto)
- [ ] Self-Approval Prevention: Team-Lead kann sich nicht selbst genehmigen → Eskalation an Area-Lead
- [ ] Deputy-Lead kann sich nicht selbst genehmigen (deputy_lead_id !== userId Check)
- [ ] Kapazität sberechnung funktioniert (Maschinen, Teams, Blackouts, Entitlements)
- [ ] Tagesberechnung server-seitig (exkl. Wochenenden + Feiertage + halbe Tage)
- [ ] Balance berechnet (NICHT aus Counter, sondern aus approved Requests)
- [ ] Cross-Year Splitting korrekt
- [ ] Sonderurlaub-Logik (is_special_leave Checkbox bei Genehmigung)
- [ ] Overlap-Validation bei Antragstellung
- [ ] Race-Condition-Schutz bei Genehmigung (FOR UPDATE)
- [ ] Availability-Integration (genehmigte Urlaube → user_availability)
- [ ] Status-Log bei jeder Statusaenderung
- [ ] audit_trail Eintraege
- [ ] SSE Notifications: Typed EventBus Methods (`emitVacationRequest*`) + SSE Handler in `registerSSEHandlers()`
- [ ] Email-Interface vorbereitet (Stub, loggt nur)
- [ ] Pagination auf allen List-Endpoints
- [ ] ResponseInterceptor — Controller gibt Daten DIREKT zurück (kein manuelles Wrapping!)
- [ ] db.tenantTransaction() fuer ALLE tenant-scoped Queries (ADR-019)
- [ ] Permission Registrar (ADR-020) registriert vacation-Module via `PermissionRegistryService`
- [ ] `vacation.permissions.ts` Companion-File mit `VACATION_PERMISSIONS` Konstante
- [ ] `FeatureCheckService.checkTenantAccess(tenantId, 'vacation')` in Controller
- [ ] ESLint 0 Errors, Type-Check 0 Errors
- [ ] Kein `any`, `??` statt `||`, explizite Boolean-Checks

### Frontend

- [ ] /vacation Seite mit rollenabhaengiger Ansicht (Employee/Lead/Root)
- [ ] RequestForm mit Live-Kapazität scheck (debounced)
- [ ] IncomingRequestCard mit Kapazität s-Hinweisen + Sonderregelung-Checkbox
- [ ] Genehmigen/Ablehnen mit Pflicht-Grund bei Ablehnung
- [ ] /vacation/rules fuer Blackouts + Staffing Rules + Settings
- [ ] /vacation/entitlements fuer Urlaubsanspruch-Verwaltung + Tage hinzufügen
- [ ] /vacation/holidays fuer Feiertags-Verwaltung
- [ ] /vacation/overview fuer Team-Kalender + Jahresuebersicht
- [ ] EntitlementBadge auf Hauptseite
- [ ] TeamCalendarPreview auf Hauptseite
- [ ] Design System Komponenten verwendet (keine Custom-Styles)
- [ ] Svelte 5 Runes ($state, $derived, $effect)
- [ ] apiClient.get<T>() — Generic = DATA Shape (NICHT Wrapper!)
- [ ] ESLint (Frontend) 0 Errors

### Tests

- [ ] Unit Tests: >= 30 Assertions fuer vacation.service
- [ ] Unit Tests: >= 15 Assertions fuer capacity.service
- [ ] Unit Tests: >= 10 Assertions fuer holidays.service
- [ ] Unit Tests: >= 10 Assertions fuer entitlements.service
- [ ] API Integration Tests: >= 20 Assertions
- [ ] Alle Tests gruen

### Dokumentation

- [ ] ADR-023 erstellt (Vacation Request Architecture)
- [ ] API-Endpoints in context.md ergaenzt
- [ ] FEATURES.md aktualisiert
- [ ] brainstorming_vacation.md: Offene Punkte als "Resolved" markiert

---

## Reihenfolge der Umsetzung

```
 1. DB Migration: Feature Flag + Teams Extension + Business Rule  (Phase 1.1 + 1.2)
 2. DB Migration: Core Tables (7 Tabellen)                        (Phase 1.3)
 3. DB Migration: Availability Rebuild                            (Phase 1.4)
    + Backend: user-availability.service.ts + teams.service.ts SQL-Referenzen anpassen
 4. DB Migration: Legacy Cleanup                                  (Phase 1.5)
 5. Backend: Module-Grundgeruest + DTOs                           (Phase 2.1 + 2.2)
 6. Backend: Holidays Service (Basis fuer countWorkdays)          (Phase 2.5)
 7. Backend: Settings Service (einfach, wird fuer andere gebraucht) (Phase 2.9)
 8. Backend: Entitlements Service + getBalance                    (Phase 2.6)
 9. Backend: Blackouts Service                                    (Phase 2.7)
10. Backend: Staffing Rules Service                               (Phase 2.8)
11. Backend: Capacity Service (Herzstuck)                         (Phase 2.4)
12. Backend: Vacation Service (Kernlogik + getApprover)           (Phase 2.3 + 2.10)
13. Backend: Notification Service + EventBus + SSE Handler        (Phase 2.13)
14. Backend: Controller + Permission Registrar                    (Phase 2.11 + 2.12)
15. Unit Tests                                                    (Phase 5)
16. API Integration Tests                                                    (Phase 5)
17. Frontend: /vacation Hauptseite                                (Phase 3)
18. Frontend: /vacation/rules                                     (Phase 3)
19. Frontend: /vacation/entitlements                              (Phase 3)
20. Frontend: /vacation/holidays                                  (Phase 3)
21. Frontend: /vacation/overview                                  (Phase 3)
22. Integration: Calendar + Shift Warning                         (Phase 4)
23. End-to-End Test + Polish                                      (Phase 6)
24. ADR-023 + Dokumentation                                       (Phase 6)
```

---

## Bekannte Limitierungen (V2)

Diese Punkte sind bewusst NICHT in V1 enthalten:

1. **Bewegliche Feiertage** (Ostern, Pfingsten) — muessen manuell als non-recurring eingetragen werden
2. **Eskalation/Timeout** — Auto-Reminder wenn Lead nicht reagiert
3. **Automatische Ablehnung** — System lehnt ab wenn Mindestbesetzung unterschritten
4. **Automatische Schicht-Umplanung** — Urlaub genehmigt → Schicht automatisch umplanen
5. **CSV/Excel Export** — Jahresuebersicht als Download
6. **Multi-Team Support** — Aktuell 1 Team pro Employee (Business Rule)
7. **Volle Email-Integration** — SMTP/IMAP muss zuerst konfiguriert werden

---

**Dieses Dokument ist der Masterplan. Jede Session beginnt mit dem Lesen dieses Prompts und arbeitet die naechste Phase ab.**
