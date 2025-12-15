-- ============================================
-- ROW LEVEL SECURITY CONFIGURATION
-- Run AFTER pgloader migration
-- ============================================

-- ============================================
-- 1. Create application user (NOT superuser!)
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'AppUserP@ss2025!';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE assixx TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ============================================
-- 2. Generic RLS Policy Function
-- ============================================
CREATE OR REPLACE FUNCTION create_tenant_rls_policy(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);

    -- Force RLS for table owner too (important!)
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);

    -- Drop existing policy if exists
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);

    -- Create tenant isolation policy
    EXECUTE format('
        CREATE POLICY tenant_isolation ON %I
        FOR ALL
        USING (tenant_id = current_setting(''app.tenant_id'')::int)
        WITH CHECK (tenant_id = current_setting(''app.tenant_id'')::int)
    ', table_name);

    RAISE NOTICE 'RLS enabled for table: %', table_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Apply RLS to ALL Tenant Tables
-- ============================================
DO $$
DECLARE
    tbl RECORD;
    rls_count INT := 0;
BEGIN
    FOR tbl IN
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND column_name = 'tenant_id'
        AND table_name NOT IN ('tenants') -- tenants table is special
        GROUP BY table_name
    LOOP
        PERFORM create_tenant_rls_policy(tbl.table_name);
        rls_count := rls_count + 1;
    END LOOP;

    RAISE NOTICE 'RLS enabled for % tables with tenant_id', rls_count;
END $$;

-- ============================================
-- 4. Special Policy for Tenants Table
-- ============================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_self_isolation ON tenants;
CREATE POLICY tenant_self_isolation ON tenants
    FOR ALL
    USING (id = current_setting('app.tenant_id')::int)
    WITH CHECK (id = current_setting('app.tenant_id')::int);

-- ============================================
-- 5. Global Tables (no RLS needed)
-- ============================================
-- These tables are explicitly WITHOUT RLS:
-- - plans (subscription plans)
-- - features (available features)
-- - plan_features (which features in which plan)
-- - machine_categories (global categories)
-- - kvp_categories (KVP categories from global DB)
-- - system_settings (system-wide settings)
-- - system_logs (system-wide logs)

COMMENT ON TABLE plans IS 'Global subscription plans - NO RLS (shared across all tenants)';
COMMENT ON TABLE features IS 'Global available features - NO RLS (shared across all tenants)';
COMMENT ON TABLE plan_features IS 'Global plan-feature mapping - NO RLS (shared across all tenants)';

SELECT 'RLS setup completed successfully' AS status;
