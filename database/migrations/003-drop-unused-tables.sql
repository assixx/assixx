-- =====================================================
-- Migration: Drop unused/unimplemented tables
-- Date: 2026-01-21
-- Author: Claude
--
-- These 16 tables were created but NEVER used in code:
-- - No backend service references them
-- - No API endpoints use them
-- - They add complexity without value
--
-- Analysis performed: grep -r "table_name" backend/src
-- Result: Zero matches for all these tables
-- =====================================================

-- Disable FK checks temporarily (some might have theoretical FKs)
SET session_replication_role = 'replica';

-- =====================================================
-- 1. REDUNDANT: subscription_plans (duplicate of plans)
-- =====================================================
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- =====================================================
-- 2. LOG TABLES: Never implemented (audit_trail is used instead)
-- =====================================================
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS api_logs CASCADE;
DROP TABLE IF EXISTS security_logs CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;

-- =====================================================
-- 3. AUTH FEATURES: Never implemented
-- =====================================================
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS user_2fa_backup_codes CASCADE;
DROP TABLE IF EXISTS user_2fa_secrets CASCADE;

-- =====================================================
-- 4. EMAIL FEATURES: Never implemented
-- =====================================================
DROP TABLE IF EXISTS email_queue CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;

-- =====================================================
-- 5. SCHEDULING FEATURES: Never implemented
-- =====================================================
DROP TABLE IF EXISTS recurring_jobs CASCADE;
DROP TABLE IF EXISTS scheduled_tasks CASCADE;

-- =====================================================
-- 6. MISC: Never implemented
-- =====================================================
DROP TABLE IF EXISTS backup_retention_policy CASCADE;
DROP TABLE IF EXISTS migration_log CASCADE;
DROP TABLE IF EXISTS released_subdomains CASCADE;

-- Re-enable FK checks
SET session_replication_role = 'origin';

-- =====================================================
-- Verification
-- =====================================================
DO $$
DECLARE
    dropped_count INTEGER;
BEGIN
    -- Count remaining tables to verify
    SELECT COUNT(*) INTO dropped_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'subscription_plans',
        'activity_logs',
        'api_logs',
        'security_logs',
        'system_logs',
        'login_attempts',
        'user_2fa_backup_codes',
        'user_2fa_secrets',
        'email_queue',
        'email_templates',
        'recurring_jobs',
        'scheduled_tasks',
        'backup_retention_policy',
        'migration_log',
        'released_subdomains'
    );

    IF dropped_count = 0 THEN
        RAISE NOTICE 'SUCCESS: All 16 unused tables dropped';
    ELSE
        RAISE WARNING 'Some tables still exist: % remaining', dropped_count;
    END IF;
END $$;
