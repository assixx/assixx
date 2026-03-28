/**
 * Migration: Availability Rebuild
 * Date: 2026-02-12
 *
 * Renames `employee_availability` → `user_availability` and
 * `employee_id` → `user_id` to align with the vacation system naming.
 *
 * CRITICAL: This migration MUST be deployed atomically with backend code
 * changes that update SQL references (Risk R2). The following backend
 * files must be updated in the SAME session:
 *   - user-availability.service.ts (12 SQL + 8 column references)
 *   - teams.service.ts (2 LEFT JOIN references)
 *   - users.service.ts (3 comment references)
 *   - users.helpers.ts (2 comment references)
 *   - users.types.ts (1 comment reference)
 *   - dto/update-availability.dto.ts (1 comment reference)
 *   - user-availability.service.test.ts (test data + SQL assertions)
 *
 * Changes:
 *   1. ALTER TYPE employee_availability_status RENAME TO user_availability_status
 *   2. ALTER TABLE employee_availability RENAME TO user_availability
 *   3. ALTER SEQUENCE employee_availability_id_seq RENAME TO user_availability_id_seq
 *   4. ALTER TABLE user_availability RENAME COLUMN employee_id TO user_id
 *   5. DROP old indexes (idx_19227_*), CREATE new indexes (idx_ua_*)
 *   6. DROP + recreate RLS policy on user_availability
 *   7. Rename FK constraints (fk_availability_* → fk_ua_*)
 *   8. Drop old trigger function, recreate with new name
 *   9. GRANT permissions to app_user
 *
 * References: FEAT_VACCATION_MASTERPLAN.md (Phase 1, Step 1.3)
 */
import type { MigrationBuilder } from 'node-pg-migrate';

export function up(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- ==========================================================================
    -- Step 1: Rename ENUM type
    -- ==========================================================================

    ALTER TYPE employee_availability_status RENAME TO user_availability_status;

    -- ==========================================================================
    -- Step 2: Rename table
    -- ==========================================================================

    ALTER TABLE employee_availability RENAME TO user_availability;

    -- ==========================================================================
    -- Step 3: Rename sequence (PostgreSQL does NOT auto-rename on table rename)
    -- ==========================================================================

    ALTER SEQUENCE employee_availability_id_seq RENAME TO user_availability_id_seq;

    -- ==========================================================================
    -- Step 4: Rename column employee_id → user_id
    -- ==========================================================================

    ALTER TABLE user_availability RENAME COLUMN employee_id TO user_id;

    -- ==========================================================================
    -- Step 5: Rename PK constraint + drop old indexes, create new ones
    -- ==========================================================================

    -- PK constraint owns its index — can't DROP the index, must RENAME
    ALTER TABLE user_availability
        RENAME CONSTRAINT idx_19227_primary TO pk_user_availability;

    -- Non-PK indexes can be dropped and recreated with clean names
    DROP INDEX IF EXISTS idx_19227_fk_availability_created_by;
    DROP INDEX IF EXISTS idx_19227_idx_availability_dates;
    DROP INDEX IF EXISTS idx_19227_idx_availability_employee;
    DROP INDEX IF EXISTS idx_19227_idx_availability_status;
    DROP INDEX IF EXISTS idx_19227_idx_availability_tenant;

    CREATE INDEX IF NOT EXISTS idx_ua_user ON user_availability(user_id);
    CREATE INDEX IF NOT EXISTS idx_ua_tenant ON user_availability(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_ua_dates ON user_availability(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_ua_status ON user_availability(status);
    CREATE INDEX IF NOT EXISTS idx_ua_created_by ON user_availability(created_by);

    -- ==========================================================================
    -- Step 6: Drop + recreate RLS policy (policies reference table name)
    -- ==========================================================================

    DROP POLICY IF EXISTS tenant_isolation ON user_availability;

    CREATE POLICY tenant_isolation ON user_availability
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- ==========================================================================
    -- Step 7: Rename FK constraints
    -- ==========================================================================

    ALTER TABLE user_availability
        RENAME CONSTRAINT fk_availability_employee TO fk_ua_user;

    ALTER TABLE user_availability
        RENAME CONSTRAINT fk_availability_tenant TO fk_ua_tenant;

    ALTER TABLE user_availability
        RENAME CONSTRAINT fk_availability_created_by TO fk_ua_created_by;

    -- ==========================================================================
    -- Step 8: Drop old trigger function, create new one
    -- The generic update_updated_at_column() trigger remains, only drop
    -- the legacy on_update_current_timestamp function
    -- ==========================================================================

    DROP TRIGGER IF EXISTS on_update_current_timestamp ON user_availability;
    DROP FUNCTION IF EXISTS on_update_current_timestamp_employee_availability();

    -- ==========================================================================
    -- Step 9: Ensure GRANT permissions for app_user
    -- ==========================================================================

    GRANT SELECT, INSERT, UPDATE, DELETE ON user_availability TO app_user;
    GRANT USAGE, SELECT ON SEQUENCE user_availability_id_seq TO app_user;
  `);
}

export function down(pgm: MigrationBuilder): void {
  pgm.sql(`
    -- Reverse: Recreate old trigger function
    CREATE OR REPLACE FUNCTION on_update_current_timestamp_employee_availability()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER on_update_current_timestamp
        BEFORE UPDATE ON user_availability
        FOR EACH ROW
        EXECUTE FUNCTION on_update_current_timestamp_employee_availability();

    -- Reverse FK renames
    ALTER TABLE user_availability
        RENAME CONSTRAINT fk_ua_user TO fk_availability_employee;
    ALTER TABLE user_availability
        RENAME CONSTRAINT fk_ua_tenant TO fk_availability_tenant;
    ALTER TABLE user_availability
        RENAME CONSTRAINT fk_ua_created_by TO fk_availability_created_by;

    -- Reverse RLS policy
    DROP POLICY IF EXISTS tenant_isolation ON user_availability;
    CREATE POLICY tenant_isolation ON user_availability
        FOR ALL
        USING (
            NULLIF(current_setting('app.tenant_id', true), '') IS NULL
            OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
        );

    -- Reverse indexes
    DROP INDEX IF EXISTS idx_ua_user;
    DROP INDEX IF EXISTS idx_ua_tenant;
    DROP INDEX IF EXISTS idx_ua_dates;
    DROP INDEX IF EXISTS idx_ua_status;
    DROP INDEX IF EXISTS idx_ua_created_by;

    -- Reverse PK constraint rename
    ALTER TABLE user_availability
        RENAME CONSTRAINT pk_user_availability TO idx_19227_primary;

    -- Reverse column rename
    ALTER TABLE user_availability RENAME COLUMN user_id TO employee_id;

    -- Reverse sequence rename
    ALTER SEQUENCE user_availability_id_seq RENAME TO employee_availability_id_seq;

    -- Reverse table rename
    ALTER TABLE user_availability RENAME TO employee_availability;

    -- Reverse ENUM rename
    ALTER TYPE user_availability_status RENAME TO employee_availability_status;
  `);
}
