-- =============================================================================
-- APP USER CREATION - Development Environment
-- =============================================================================
-- This script runs automatically on FIRST container start
-- (via /docker-entrypoint-initdb.d/)
--
-- IMPORTANT: For production, change the password!
-- =============================================================================

-- Create app_user if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user WITH LOGIN PASSWORD 'DevOnlyP@ssw0rd2026!Rotate4Prod';
        RAISE NOTICE 'Created app_user role';
    ELSE
        RAISE NOTICE 'app_user role already exists';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT CONNECT ON DATABASE assixx TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant table permissions (after tables are created by migrations)
-- These will be applied when tables exist
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Verify
DO $$
BEGIN
    RAISE NOTICE 'app_user setup complete. RLS will be enforced for this user.';
END
$$;
