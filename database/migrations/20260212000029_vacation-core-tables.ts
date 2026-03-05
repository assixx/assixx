/**
 * Migration: Vacation Core Tables
 * Date: 2026-02-12
 *
 * Creates 3 ENUM types and 7 tables for the vacation request system:
 *
 * ENUMs:
 *   - vacation_request_status: pending, approved, denied, withdrawn, cancelled
 *   - vacation_type: regular, special_doctor, special_bereavement, special_birth,
 *                    special_wedding, special_move, unpaid
 *   - vacation_half_day: none, morning, afternoon
 *
 * Tables:
 *   1. vacation_holidays       — tenant holidays (recurring + non-recurring)
 *   2. vacation_entitlements   — per-user per-year entitlement (no used_days counter)
 *   3. vacation_requests       — core requests with 5 constraints
 *   4. vacation_request_status_log — append-only audit trail per request
 *   5. vacation_blackouts      — blackout periods (global/team/department scope)
 *   6. vacation_staffing_rules — min staffing per machine
 *   7. vacation_settings       — tenant-wide config (one row per tenant)
 *
 * Every table follows ADR-019 (RLS), uses UUID PK (UUIDv7), and has
 * GRANT to app_user. status_log is append-only (SELECT + INSERT only).
 *
 * References: FEAT_VACCATION_MASTERPLAN.md (Phase 1, Step 1.2)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- ENUM types
    -- ==========================================================================

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

    -- ==========================================================================
    -- Table 1: vacation_holidays — Feiertage pro Tenant
    -- ==========================================================================

    CREATE TABLE vacation_holidays (
        id              UUID PRIMARY KEY,                -- UUIDv7 (application-generated)
        tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        holiday_date    DATE NOT NULL,
        name            VARCHAR(100) NOT NULL,
        recurring       BOOLEAN NOT NULL DEFAULT true,   -- true = same month+day every year
        is_active       INTEGER NOT NULL DEFAULT 1,
        created_by      INTEGER NOT NULL REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE(tenant_id, holiday_date)
    );

    CREATE INDEX idx_vh_tenant_date ON vacation_holidays(tenant_id, holiday_date);
    CREATE INDEX idx_vh_tenant_active ON vacation_holidays(tenant_id) WHERE is_active = 1;

    ALTER TABLE vacation_holidays ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_holidays FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_holidays
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_holidays TO app_user;

    -- ==========================================================================
    -- Table 2: vacation_entitlements — Urlaubsanspruch pro User pro Jahr
    -- ==========================================================================

    CREATE TABLE vacation_entitlements (
        id                      UUID PRIMARY KEY,        -- UUIDv7
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
        CONSTRAINT valid_total CHECK (total_days >= 0 AND total_days % 0.5 = 0),
        CONSTRAINT valid_carried CHECK (carried_over_days >= 0 AND carried_over_days % 0.5 = 0),
        CONSTRAINT valid_additional CHECK (additional_days >= 0 AND additional_days % 0.5 = 0)
    );

    CREATE INDEX idx_ve_user_year ON vacation_entitlements(tenant_id, user_id, year);

    ALTER TABLE vacation_entitlements ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_entitlements FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_entitlements
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_entitlements TO app_user;

    -- ==========================================================================
    -- Table 3: vacation_requests — UrlaubsAnträge (core table)
    -- ==========================================================================

    CREATE TABLE vacation_requests (
        id                  UUID PRIMARY KEY,            -- UUIDv7
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

        CONSTRAINT valid_date_range CHECK (end_date >= start_date),
        CONSTRAINT valid_days CHECK (computed_days > 0 AND computed_days % 0.5 = 0),
        CONSTRAINT valid_half_day_single CHECK (
            start_date != end_date
            OR half_day_start = 'none'
            OR half_day_end = 'none'
        ),
        CONSTRAINT special_leave_approved CHECK (
            is_special_leave = false OR status = 'approved'
        ),
        CONSTRAINT denied_needs_reason CHECK (
            status != 'denied' OR response_note IS NOT NULL
        )
    );

    CREATE INDEX idx_vr_requester ON vacation_requests(tenant_id, requester_id, status);
    CREATE INDEX idx_vr_approver ON vacation_requests(tenant_id, approver_id, status)
        WHERE approver_id IS NOT NULL;
    CREATE INDEX idx_vr_dates ON vacation_requests(tenant_id, start_date, end_date)
        WHERE status = 'approved';
    CREATE INDEX idx_vr_active ON vacation_requests(tenant_id, status)
        WHERE is_active = 1;

    ALTER TABLE vacation_requests ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_requests FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_requests
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_requests TO app_user;

    -- ==========================================================================
    -- Table 4: vacation_request_status_log — append-only audit trail
    -- ==========================================================================

    CREATE TABLE vacation_request_status_log (
        id              UUID PRIMARY KEY,                -- UUIDv7
        tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        request_id      UUID NOT NULL REFERENCES vacation_requests(id) ON DELETE CASCADE,
        old_status      vacation_request_status,         -- NULL for initial creation
        new_status      vacation_request_status NOT NULL,
        changed_by      INTEGER NOT NULL REFERENCES users(id),
        note            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        -- NO is_active, NO updated_at — append-only audit table
    );

    CREATE INDEX idx_vrsl_request ON vacation_request_status_log(request_id);
    CREATE INDEX idx_vrsl_tenant ON vacation_request_status_log(tenant_id);

    ALTER TABLE vacation_request_status_log ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_request_status_log FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_request_status_log
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Append-only: SELECT + INSERT only (no UPDATE/DELETE)
    GRANT SELECT, INSERT ON vacation_request_status_log TO app_user;

    -- ==========================================================================
    -- Table 5: vacation_blackouts — Urlaubssperren (scope polymorphism)
    -- ==========================================================================

    CREATE TABLE vacation_blackouts (
        id              UUID PRIMARY KEY,                -- UUIDv7
        tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name            VARCHAR(100) NOT NULL,
        reason          VARCHAR(255),
        start_date      DATE NOT NULL,
        end_date        DATE NOT NULL,
        scope_type      VARCHAR(20) NOT NULL DEFAULT 'global',
        scope_id        INTEGER,                         -- NULL for global, team.id or dept.id
        is_active       INTEGER NOT NULL DEFAULT 1,
        created_by      INTEGER NOT NULL REFERENCES users(id),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT valid_blackout_range CHECK (end_date >= start_date),
        CONSTRAINT valid_scope CHECK (
            (scope_type = 'global' AND scope_id IS NULL)
            OR (scope_type IN ('team', 'department') AND scope_id IS NOT NULL)
        )
    );

    CREATE INDEX idx_vb_tenant_dates ON vacation_blackouts(tenant_id, start_date, end_date)
        WHERE is_active = 1;
    CREATE INDEX idx_vb_scope ON vacation_blackouts(tenant_id, scope_type, scope_id)
        WHERE is_active = 1;

    ALTER TABLE vacation_blackouts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_blackouts FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_blackouts
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_blackouts TO app_user;

    -- ==========================================================================
    -- Table 6: vacation_staffing_rules — Mindestbesetzung pro Maschine
    -- ==========================================================================

    CREATE TABLE vacation_staffing_rules (
        id                  UUID PRIMARY KEY,            -- UUIDv7
        tenant_id           INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        asset_id          INTEGER NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
        min_staff_count     INTEGER NOT NULL,
        is_active           INTEGER NOT NULL DEFAULT 1,
        created_by          INTEGER NOT NULL REFERENCES users(id),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE(tenant_id, asset_id),
        CONSTRAINT positive_staff CHECK (min_staff_count > 0)
    );

    CREATE INDEX idx_vsr_machine ON vacation_staffing_rules(tenant_id, asset_id)
        WHERE is_active = 1;

    ALTER TABLE vacation_staffing_rules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_staffing_rules FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_staffing_rules
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_staffing_rules TO app_user;

    -- ==========================================================================
    -- Table 7: vacation_settings — Tenant-weite Konfiguration (1 Zeile pro Tenant)
    -- ==========================================================================

    CREATE TABLE vacation_settings (
        id                          UUID PRIMARY KEY,    -- UUIDv7
        tenant_id                   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        default_annual_days         NUMERIC(4,1) NOT NULL DEFAULT 30,
        max_carry_over_days         NUMERIC(4,1) NOT NULL DEFAULT 10,
        carry_over_deadline_month   INTEGER NOT NULL DEFAULT 3,
        carry_over_deadline_day     INTEGER NOT NULL DEFAULT 31,
        advance_notice_days         INTEGER NOT NULL DEFAULT 0,
        max_consecutive_days        INTEGER,             -- NULL = unlimited
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

    ALTER TABLE vacation_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE vacation_settings FORCE ROW LEVEL SECURITY;

    CREATE POLICY tenant_isolation ON vacation_settings
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    GRANT SELECT, INSERT, UPDATE, DELETE ON vacation_settings TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Drop tables FIRST (they depend on ENUMs), then ENUMs
    DROP TABLE IF EXISTS vacation_settings CASCADE;
    DROP TABLE IF EXISTS vacation_staffing_rules CASCADE;
    DROP TABLE IF EXISTS vacation_blackouts CASCADE;
    DROP TABLE IF EXISTS vacation_request_status_log CASCADE;
    DROP TABLE IF EXISTS vacation_requests CASCADE;
    DROP TABLE IF EXISTS vacation_entitlements CASCADE;
    DROP TABLE IF EXISTS vacation_holidays CASCADE;

    DROP TYPE IF EXISTS vacation_half_day CASCADE;
    DROP TYPE IF EXISTS vacation_type CASCADE;
    DROP TYPE IF EXISTS vacation_request_status CASCADE;
  `);
}
