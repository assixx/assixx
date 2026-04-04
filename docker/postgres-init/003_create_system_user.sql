-- =============================================================================
-- SYSTEM USER CREATION - Development Environment
-- =============================================================================
-- This script runs automatically on FIRST container start
-- (via /docker-entrypoint-initdb.d/)
--
-- sys_user: BYPASSRLS role for cross-tenant operations
-- Used by: Cron jobs, Auth (login), Signup, Root admin, Tenant deletion
--
-- IMPORTANT: For production, change the password!
-- =============================================================================

-- Create sys_user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sys_user') THEN
        CREATE ROLE sys_user WITH LOGIN BYPASSRLS PASSWORD 'DevOnlySysP@ss2026!Rotate4Prod';
        RAISE NOTICE 'Created sys_user role (BYPASSRLS)';
    ELSE
        RAISE NOTICE 'sys_user role already exists';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE assixx TO sys_user;
GRANT USAGE ON SCHEMA public TO sys_user;

-- Grant table permissions (after tables are created by migrations)
-- These will be applied when tables exist
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sys_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sys_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sys_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sys_user;

-- Verify
DO $$
BEGIN
    RAISE NOTICE 'sys_user setup complete. RLS is BYPASSED for this user (BYPASSRLS).';
    RAISE NOTICE 'Use ONLY for: cron jobs, auth login, signup, root admin, tenant deletion.';
END
$$;
