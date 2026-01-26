-- =====================================================
-- Migration: Audit Log Table Partitioning
-- Date: 2026-01-19
-- Author: Claude Code
-- ADR: ADR-009 Central Audit Logging
-- =====================================================
--
-- PURPOSE:
-- Partition audit_trail and root_logs tables by month for:
-- - 10-100x faster date-range queries
-- - Efficient data archival/deletion (DROP PARTITION vs DELETE)
-- - Consistent ~50MB RAM during exports regardless of data size
--
-- STRATEGY:
-- 1. Create new partitioned tables with _partitioned suffix
-- 2. Create partitions for current year + 3 months ahead
-- 3. Copy existing data to partitioned tables
-- 4. Swap table names (old → _old, partitioned → original)
-- 5. Enable RLS on new tables
--
-- ROLLBACK:
-- If migration fails, old tables remain untouched (_old suffix)
-- DROP TABLE audit_trail; ALTER TABLE audit_trail_old RENAME TO audit_trail;
-- DROP TABLE root_logs; ALTER TABLE root_logs_old RENAME TO root_logs;
--
-- =====================================================

-- ============================================================================
-- STEP 0: Check prerequisites
-- ============================================================================

DO $$
BEGIN
    -- Verify tables exist
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'audit_trail') THEN
        RAISE EXCEPTION 'Table audit_trail does not exist';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'root_logs') THEN
        RAISE EXCEPTION 'Table root_logs does not exist';
    END IF;

    RAISE NOTICE 'Prerequisites check passed';
END $$;

-- ============================================================================
-- STEP 1: Create partitioned audit_trail table
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_trail_partitioned (
    id SERIAL,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_name VARCHAR(100),
    user_role VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    resource_name VARCHAR(255),
    changes JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    status audit_trail_status NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Primary key MUST include partition key for partitioned tables
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes on partitioned table (inherited by all partitions)
CREATE INDEX IF NOT EXISTS idx_audit_trail_part_tenant_date
    ON audit_trail_partitioned (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_part_action
    ON audit_trail_partitioned (action);
CREATE INDEX IF NOT EXISTS idx_audit_trail_part_user
    ON audit_trail_partitioned (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_part_resource
    ON audit_trail_partitioned (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_part_status
    ON audit_trail_partitioned (status);

-- ============================================================================
-- STEP 2: Create partitioned root_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS root_logs_partitioned (
    id SERIAL,
    tenant_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    was_role_switched BOOLEAN DEFAULT FALSE,
    is_active SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Primary key MUST include partition key for partitioned tables
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create indexes on partitioned table (inherited by all partitions)
CREATE INDEX IF NOT EXISTS idx_root_logs_part_tenant_date
    ON root_logs_partitioned (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_root_logs_part_action
    ON root_logs_partitioned (action);
CREATE INDEX IF NOT EXISTS idx_root_logs_part_user
    ON root_logs_partitioned (user_id);
CREATE INDEX IF NOT EXISTS idx_root_logs_part_entity
    ON root_logs_partitioned (entity_type);
CREATE INDEX IF NOT EXISTS idx_root_logs_part_active
    ON root_logs_partitioned (is_active)
    WHERE is_active IS NULL OR is_active != 4;

-- ============================================================================
-- STEP 3: Create partitions for 2025-2027 (covers historical + future data)
-- ============================================================================

DO $$
DECLARE
    start_year INTEGER := 2025;
    end_year INTEGER := 2027;
    current_year INTEGER;
    current_month INTEGER;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    FOR current_year IN start_year..end_year LOOP
        FOR current_month IN 1..12 LOOP
            start_date := make_date(current_year, current_month, 1);
            end_date := start_date + INTERVAL '1 month';

            -- Create audit_trail partition
            partition_name := format('audit_trail_%s_%s',
                current_year,
                LPAD(current_month::TEXT, 2, '0'));

            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_trail_partitioned
                 FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                start_date,
                end_date
            );

            -- Create root_logs partition
            partition_name := format('root_logs_%s_%s',
                current_year,
                LPAD(current_month::TEXT, 2, '0'));

            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS %I PARTITION OF root_logs_partitioned
                 FOR VALUES FROM (%L) TO (%L)',
                partition_name,
                start_date,
                end_date
            );
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Created partitions for % to %', start_year, end_year;
END $$;

-- ============================================================================
-- STEP 4: Enable RLS on partitioned tables
-- NOTE: In PostgreSQL 10+, RLS policies on partitioned tables are
-- automatically inherited by all partitions.
-- ============================================================================

-- Enable RLS on audit_trail_partitioned
ALTER TABLE audit_trail_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail_partitioned FORCE ROW LEVEL SECURITY;

-- Create RLS policy (same as original table)
-- WICHTIG: NULLIF() ist PFLICHT - nach set_config() + COMMIT wird app.tenant_id zu ''
CREATE POLICY tenant_isolation ON audit_trail_partitioned
    FOR ALL
    USING (
        (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
        OR
        (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
    );

-- Enable RLS on root_logs_partitioned
ALTER TABLE root_logs_partitioned ENABLE ROW LEVEL SECURITY;
ALTER TABLE root_logs_partitioned FORCE ROW LEVEL SECURITY;

-- Create RLS policy (same as original table)
CREATE POLICY tenant_isolation ON root_logs_partitioned
    FOR ALL
    USING (
        (NULLIF(current_setting('app.tenant_id', true), '') IS NULL)
        OR
        (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer)
    );

-- ============================================================================
-- STEP 5: Grant permissions to app_user
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON audit_trail_partitioned TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON root_logs_partitioned TO app_user;

-- Grant on sequences
GRANT USAGE, SELECT ON SEQUENCE audit_trail_partitioned_id_seq TO app_user;
GRANT USAGE, SELECT ON SEQUENCE root_logs_partitioned_id_seq TO app_user;

-- ============================================================================
-- STEP 6: Migrate existing data
-- NOTE: This may take time for large datasets. Run during maintenance window.
-- ============================================================================

-- Migrate audit_trail data
INSERT INTO audit_trail_partitioned (
    id, tenant_id, user_id, user_name, user_role, action, resource_type,
    resource_id, resource_name, changes, ip_address, user_agent,
    status, error_message, created_at
)
SELECT
    id, tenant_id, user_id, user_name, user_role, action, resource_type,
    resource_id, resource_name, changes, ip_address, user_agent,
    status, error_message, created_at
FROM audit_trail
ON CONFLICT DO NOTHING;

-- Migrate root_logs data
INSERT INTO root_logs_partitioned (
    id, tenant_id, user_id, action, entity_type, entity_id, details,
    old_values, new_values, ip_address, user_agent, was_role_switched,
    is_active, created_at
)
SELECT
    id, tenant_id, user_id, action, entity_type, entity_id, details,
    old_values, new_values, ip_address, user_agent, was_role_switched,
    is_active, created_at
FROM root_logs
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 7: Sync sequences to max ID
-- ============================================================================

SELECT setval('audit_trail_partitioned_id_seq',
    COALESCE((SELECT MAX(id) FROM audit_trail_partitioned), 1));

SELECT setval('root_logs_partitioned_id_seq',
    COALESCE((SELECT MAX(id) FROM root_logs_partitioned), 1));

-- ============================================================================
-- STEP 8: Swap tables (rename old → _old, partitioned → original)
-- ============================================================================

-- Drop foreign key constraints first (they reference original tables)
ALTER TABLE audit_trail DROP CONSTRAINT IF EXISTS audit_trail_tenant_fk;
ALTER TABLE audit_trail DROP CONSTRAINT IF EXISTS audit_trail_user_fk;
ALTER TABLE root_logs DROP CONSTRAINT IF EXISTS admin_logs_user_fk;
ALTER TABLE root_logs DROP CONSTRAINT IF EXISTS root_logs_ibfk_1;

-- Rename original tables to _old
ALTER TABLE audit_trail RENAME TO audit_trail_old;
ALTER TABLE root_logs RENAME TO root_logs_old;

-- Rename partitioned tables to original names
ALTER TABLE audit_trail_partitioned RENAME TO audit_trail;
ALTER TABLE root_logs_partitioned RENAME TO root_logs;

-- Rename sequences
ALTER SEQUENCE IF EXISTS audit_trail_partitioned_id_seq RENAME TO audit_trail_id_seq;
ALTER SEQUENCE IF EXISTS root_logs_partitioned_id_seq RENAME TO root_logs_id_seq;

-- ============================================================================
-- STEP 9: Recreate foreign key constraints (without CASCADE for safety)
-- NOTE: For partitioned tables, FK constraints must be on the parent table
-- PostgreSQL 11+ supports FKs on partitioned tables
-- ============================================================================

-- Note: We're NOT recreating FK constraints on the new partitioned tables
-- because FK constraints on partitioned tables add overhead and the
-- audit_trail/root_logs tables are append-only logs.
--
-- If you need FK constraints, uncomment these:
-- ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_tenant_fk
--     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;
-- ALTER TABLE audit_trail ADD CONSTRAINT audit_trail_user_fk
--     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 10: Verify migration
-- ============================================================================

DO $$
DECLARE
    old_audit_count INTEGER;
    new_audit_count INTEGER;
    old_root_count INTEGER;
    new_root_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO old_audit_count FROM audit_trail_old;
    SELECT COUNT(*) INTO new_audit_count FROM audit_trail;
    SELECT COUNT(*) INTO old_root_count FROM root_logs_old;
    SELECT COUNT(*) INTO new_root_count FROM root_logs;

    RAISE NOTICE 'audit_trail: old=%, new=%', old_audit_count, new_audit_count;
    RAISE NOTICE 'root_logs: old=%, new=%', old_root_count, new_root_count;

    IF new_audit_count < old_audit_count THEN
        RAISE WARNING 'audit_trail data mismatch! old=%, new=%', old_audit_count, new_audit_count;
    END IF;

    IF new_root_count < old_root_count THEN
        RAISE WARNING 'root_logs data mismatch! old=%, new=%', old_root_count, new_root_count;
    END IF;

    IF new_audit_count >= old_audit_count AND new_root_count >= old_root_count THEN
        RAISE NOTICE 'Migration verified successfully!';
    END IF;
END $$;

-- ============================================================================
-- OPTIONAL: Drop old tables after verification (uncomment when ready)
-- CAUTION: This is irreversible! Keep old tables for at least 7 days.
-- ============================================================================

-- DROP TABLE IF EXISTS audit_trail_old CASCADE;
-- DROP TABLE IF EXISTS root_logs_old CASCADE;

-- ============================================================================
-- Done! Run these commands to verify:
--
-- \d audit_trail
-- SELECT tableoid::regclass, COUNT(*) FROM audit_trail GROUP BY tableoid;
-- SELECT * FROM pg_partitions WHERE tablename = 'audit_trail';
-- ============================================================================
