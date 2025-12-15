-- =====================================================
-- Migration: Fix Missing Timestamp Defaults
-- Date: 2025-12-06
-- Author: Claude Code
--
-- Purpose: Add DEFAULT NOW() to all created_at and updated_at columns
--          that are missing defaults. This is a systematic fix for
--          columns that were migrated from MySQL without proper defaults.
--
-- Affected: 89 tables with timestamp columns missing DEFAULT
--
-- IMPORTANT: Run as assixx_user (superuser with BYPASSRLS)
-- =====================================================

BEGIN;

-- =====================================================
-- SECTION 1: Update existing NULL values to NOW()
-- Must be done BEFORE adding NOT NULL constraints
-- =====================================================

-- absences
UPDATE absences SET created_at = NOW() WHERE created_at IS NULL;

-- activity_logs
UPDATE activity_logs SET created_at = NOW() WHERE created_at IS NULL;

-- admin_logs
UPDATE admin_logs SET created_at = NOW() WHERE created_at IS NULL;

-- admin_permission_logs
UPDATE admin_permission_logs SET created_at = NOW() WHERE created_at IS NULL;

-- api_keys
UPDATE api_keys SET created_at = NOW() WHERE created_at IS NULL;

-- api_logs
UPDATE api_logs SET created_at = NOW() WHERE created_at IS NULL;

-- areas
UPDATE areas SET created_at = NOW() WHERE created_at IS NULL;
UPDATE areas SET updated_at = NOW() WHERE updated_at IS NULL;

-- audit_trail
UPDATE audit_trail SET created_at = NOW() WHERE created_at IS NULL;

-- backup_retention_policy
UPDATE backup_retention_policy SET created_at = NOW() WHERE created_at IS NULL;

-- blackboard_comments
UPDATE blackboard_comments SET created_at = NOW() WHERE created_at IS NULL;

-- blackboard_entries
UPDATE blackboard_entries SET created_at = NOW() WHERE created_at IS NULL;
UPDATE blackboard_entries SET updated_at = NOW() WHERE updated_at IS NULL;

-- blackboard_entry_organizations
UPDATE blackboard_entry_organizations SET created_at = NOW() WHERE created_at IS NULL;

-- calendar_attendees
UPDATE calendar_attendees SET created_at = NOW() WHERE created_at IS NULL;
UPDATE calendar_attendees SET updated_at = NOW() WHERE updated_at IS NULL;

-- calendar_events
UPDATE calendar_events SET created_at = NOW() WHERE created_at IS NULL;
UPDATE calendar_events SET updated_at = NOW() WHERE updated_at IS NULL;

-- calendar_events_organizations
UPDATE calendar_events_organizations SET created_at = NOW() WHERE created_at IS NULL;

-- conversations
UPDATE conversations SET created_at = NOW() WHERE created_at IS NULL;
UPDATE conversations SET updated_at = NOW() WHERE updated_at IS NULL;

-- deletion_alerts
UPDATE deletion_alerts SET created_at = NOW() WHERE created_at IS NULL;

-- deletion_audit_trail
UPDATE deletion_audit_trail SET created_at = NOW() WHERE created_at IS NULL;

-- deletion_dry_run_reports
UPDATE deletion_dry_run_reports SET created_at = NOW() WHERE created_at IS NULL;

-- deletion_partial_options
UPDATE deletion_partial_options SET created_at = NOW() WHERE created_at IS NULL;

-- departments
UPDATE departments SET created_at = NOW() WHERE created_at IS NULL;
UPDATE departments SET updated_at = NOW() WHERE updated_at IS NULL;

-- document_permissions
UPDATE document_permissions SET created_at = NOW() WHERE created_at IS NULL;

-- document_read_status
UPDATE document_read_status SET created_at = NOW() WHERE created_at IS NULL;

-- document_shares
UPDATE document_shares SET created_at = NOW() WHERE created_at IS NULL;

-- email_queue
UPDATE email_queue SET created_at = NOW() WHERE created_at IS NULL;

-- email_templates
UPDATE email_templates SET created_at = NOW() WHERE created_at IS NULL;
UPDATE email_templates SET updated_at = NOW() WHERE updated_at IS NULL;

-- employee_availability
UPDATE employee_availability SET created_at = NOW() WHERE created_at IS NULL;
UPDATE employee_availability SET updated_at = NOW() WHERE updated_at IS NULL;

-- failed_file_deletions
UPDATE failed_file_deletions SET created_at = NOW() WHERE created_at IS NULL;

-- feature_usage_logs
UPDATE feature_usage_logs SET created_at = NOW() WHERE created_at IS NULL;

-- features
UPDATE features SET created_at = NOW() WHERE created_at IS NULL;
UPDATE features SET updated_at = NOW() WHERE updated_at IS NULL;

-- kvp_comments
UPDATE kvp_comments SET created_at = NOW() WHERE created_at IS NULL;

-- kvp_points
UPDATE kvp_points SET created_at = NOW() WHERE created_at IS NULL;

-- kvp_ratings
UPDATE kvp_ratings SET created_at = NOW() WHERE created_at IS NULL;

-- kvp_status_history
UPDATE kvp_status_history SET created_at = NOW() WHERE created_at IS NULL;

-- kvp_suggestions
UPDATE kvp_suggestions SET created_at = NOW() WHERE created_at IS NULL;
UPDATE kvp_suggestions SET updated_at = NOW() WHERE updated_at IS NULL;

-- kvp_votes
UPDATE kvp_votes SET created_at = NOW() WHERE created_at IS NULL;

-- legal_holds
UPDATE legal_holds SET created_at = NOW() WHERE created_at IS NULL;

-- machine_maintenance_history
UPDATE machine_maintenance_history SET created_at = NOW() WHERE created_at IS NULL;

-- machines
UPDATE machines SET created_at = NOW() WHERE created_at IS NULL;
UPDATE machines SET updated_at = NOW() WHERE updated_at IS NULL;

-- messages
UPDATE messages SET created_at = NOW() WHERE created_at IS NULL;

-- notification_preferences
UPDATE notification_preferences SET created_at = NOW() WHERE created_at IS NULL;
UPDATE notification_preferences SET updated_at = NOW() WHERE updated_at IS NULL;

-- notifications
UPDATE notifications SET created_at = NOW() WHERE created_at IS NULL;
UPDATE notifications SET updated_at = NOW() WHERE updated_at IS NULL;

-- oauth_tokens
UPDATE oauth_tokens SET created_at = NOW() WHERE created_at IS NULL;

-- password_reset_tokens
UPDATE password_reset_tokens SET created_at = NOW() WHERE created_at IS NULL;

-- payment_history
UPDATE payment_history SET created_at = NOW() WHERE created_at IS NULL;

-- plan_features
UPDATE plan_features SET created_at = NOW() WHERE created_at IS NULL;

-- plans
UPDATE plans SET created_at = NOW() WHERE created_at IS NULL;
UPDATE plans SET updated_at = NOW() WHERE updated_at IS NULL;

-- recurring_jobs
UPDATE recurring_jobs SET created_at = NOW() WHERE created_at IS NULL;

-- refresh_tokens
UPDATE refresh_tokens SET created_at = NOW() WHERE created_at IS NULL;

-- root_logs
UPDATE root_logs SET created_at = NOW() WHERE created_at IS NULL;

-- scheduled_tasks
UPDATE scheduled_tasks SET created_at = NOW() WHERE created_at IS NULL;

-- security_logs
UPDATE security_logs SET created_at = NOW() WHERE created_at IS NULL;

-- shift_assignments
UPDATE shift_assignments SET created_at = NOW() WHERE created_at IS NULL;
UPDATE shift_assignments SET updated_at = NOW() WHERE updated_at IS NULL;

-- shift_favorites
UPDATE shift_favorites SET created_at = NOW() WHERE created_at IS NULL;

-- shift_plans
UPDATE shift_plans SET created_at = NOW() WHERE created_at IS NULL;
UPDATE shift_plans SET updated_at = NOW() WHERE updated_at IS NULL;

-- shift_rotation_assignments
UPDATE shift_rotation_assignments SET updated_at = NOW() WHERE updated_at IS NULL;

-- shift_rotation_patterns
UPDATE shift_rotation_patterns SET created_at = NOW() WHERE created_at IS NULL;
UPDATE shift_rotation_patterns SET updated_at = NOW() WHERE updated_at IS NULL;

-- shift_swap_requests
UPDATE shift_swap_requests SET created_at = NOW() WHERE created_at IS NULL;
UPDATE shift_swap_requests SET updated_at = NOW() WHERE updated_at IS NULL;

-- shift_templates
UPDATE shift_templates SET created_at = NOW() WHERE created_at IS NULL;
UPDATE shift_templates SET updated_at = NOW() WHERE updated_at IS NULL;

-- shifts
UPDATE shifts SET created_at = NOW() WHERE created_at IS NULL;
UPDATE shifts SET updated_at = NOW() WHERE updated_at IS NULL;

-- subscription_plans
UPDATE subscription_plans SET created_at = NOW() WHERE created_at IS NULL;
UPDATE subscription_plans SET updated_at = NOW() WHERE updated_at IS NULL;

-- survey_answers
UPDATE survey_answers SET created_at = NOW() WHERE created_at IS NULL;

-- survey_assignments
UPDATE survey_assignments SET created_at = NOW() WHERE created_at IS NULL;

-- survey_comments
UPDATE survey_comments SET created_at = NOW() WHERE created_at IS NULL;

-- survey_question_options
UPDATE survey_question_options SET created_at = NOW() WHERE created_at IS NULL;

-- survey_questions
UPDATE survey_questions SET created_at = NOW() WHERE created_at IS NULL;

-- survey_reminders
UPDATE survey_reminders SET created_at = NOW() WHERE created_at IS NULL;

-- survey_templates
UPDATE survey_templates SET created_at = NOW() WHERE created_at IS NULL;

-- surveys
UPDATE surveys SET created_at = NOW() WHERE created_at IS NULL;
UPDATE surveys SET updated_at = NOW() WHERE updated_at IS NULL;

-- system_logs
UPDATE system_logs SET created_at = NOW() WHERE created_at IS NULL;

-- system_settings
UPDATE system_settings SET created_at = NOW() WHERE created_at IS NULL;
UPDATE system_settings SET updated_at = NOW() WHERE updated_at IS NULL;

-- teams
UPDATE teams SET created_at = NOW() WHERE created_at IS NULL;
UPDATE teams SET updated_at = NOW() WHERE updated_at IS NULL;

-- tenant_addons
UPDATE tenant_addons SET created_at = NOW() WHERE created_at IS NULL;
UPDATE tenant_addons SET updated_at = NOW() WHERE updated_at IS NULL;

-- tenant_data_exports
UPDATE tenant_data_exports SET created_at = NOW() WHERE created_at IS NULL;

-- tenant_deletion_approvals
UPDATE tenant_deletion_approvals SET created_at = NOW() WHERE created_at IS NULL;

-- tenant_deletion_backups
UPDATE tenant_deletion_backups SET created_at = NOW() WHERE created_at IS NULL;

-- tenant_deletion_log
UPDATE tenant_deletion_log SET created_at = NOW() WHERE created_at IS NULL;

-- tenant_deletion_queue
UPDATE tenant_deletion_queue SET created_at = NOW() WHERE created_at IS NULL;

-- tenant_deletion_rollback
UPDATE tenant_deletion_rollback SET created_at = NOW() WHERE created_at IS NULL;

-- tenant_features
UPDATE tenant_features SET created_at = NOW() WHERE created_at IS NULL;
UPDATE tenant_features SET updated_at = NOW() WHERE updated_at IS NULL;

-- tenant_plans
UPDATE tenant_plans SET created_at = NOW() WHERE created_at IS NULL;
UPDATE tenant_plans SET updated_at = NOW() WHERE updated_at IS NULL;

-- tenant_settings
UPDATE tenant_settings SET created_at = NOW() WHERE created_at IS NULL;
UPDATE tenant_settings SET updated_at = NOW() WHERE updated_at IS NULL;

-- tenant_webhooks
UPDATE tenant_webhooks SET created_at = NOW() WHERE created_at IS NULL;

-- tenants
UPDATE tenants SET created_at = NOW() WHERE created_at IS NULL;
UPDATE tenants SET updated_at = NOW() WHERE updated_at IS NULL;

-- user_2fa_backup_codes
UPDATE user_2fa_backup_codes SET created_at = NOW() WHERE created_at IS NULL;

-- user_2fa_secrets
UPDATE user_2fa_secrets SET created_at = NOW() WHERE created_at IS NULL;

-- user_sessions
UPDATE user_sessions SET created_at = NOW() WHERE created_at IS NULL;

-- user_settings
UPDATE user_settings SET created_at = NOW() WHERE created_at IS NULL;
UPDATE user_settings SET updated_at = NOW() WHERE updated_at IS NULL;

-- users
UPDATE users SET created_at = NOW() WHERE created_at IS NULL;
UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL;


-- =====================================================
-- SECTION 2: Add DEFAULT NOW() to all columns
-- =====================================================

-- absences
ALTER TABLE absences ALTER COLUMN created_at SET DEFAULT NOW();

-- activity_logs
ALTER TABLE activity_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- admin_logs
ALTER TABLE admin_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- admin_permission_logs
ALTER TABLE admin_permission_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- api_keys
ALTER TABLE api_keys ALTER COLUMN created_at SET DEFAULT NOW();

-- api_logs
ALTER TABLE api_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- areas
ALTER TABLE areas ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE areas ALTER COLUMN updated_at SET DEFAULT NOW();

-- audit_trail
ALTER TABLE audit_trail ALTER COLUMN created_at SET DEFAULT NOW();

-- backup_retention_policy
ALTER TABLE backup_retention_policy ALTER COLUMN created_at SET DEFAULT NOW();

-- blackboard_comments
ALTER TABLE blackboard_comments ALTER COLUMN created_at SET DEFAULT NOW();

-- blackboard_entries
ALTER TABLE blackboard_entries ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE blackboard_entries ALTER COLUMN updated_at SET DEFAULT NOW();

-- blackboard_entry_organizations
ALTER TABLE blackboard_entry_organizations ALTER COLUMN created_at SET DEFAULT NOW();

-- calendar_attendees
ALTER TABLE calendar_attendees ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE calendar_attendees ALTER COLUMN updated_at SET DEFAULT NOW();

-- calendar_events
ALTER TABLE calendar_events ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE calendar_events ALTER COLUMN updated_at SET DEFAULT NOW();

-- calendar_events_organizations
ALTER TABLE calendar_events_organizations ALTER COLUMN created_at SET DEFAULT NOW();

-- conversations
ALTER TABLE conversations ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE conversations ALTER COLUMN updated_at SET DEFAULT NOW();

-- deletion_alerts
ALTER TABLE deletion_alerts ALTER COLUMN created_at SET DEFAULT NOW();

-- deletion_audit_trail
ALTER TABLE deletion_audit_trail ALTER COLUMN created_at SET DEFAULT NOW();

-- deletion_dry_run_reports
ALTER TABLE deletion_dry_run_reports ALTER COLUMN created_at SET DEFAULT NOW();

-- deletion_partial_options
ALTER TABLE deletion_partial_options ALTER COLUMN created_at SET DEFAULT NOW();

-- departments
ALTER TABLE departments ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE departments ALTER COLUMN updated_at SET DEFAULT NOW();

-- document_permissions
ALTER TABLE document_permissions ALTER COLUMN created_at SET DEFAULT NOW();

-- document_read_status
ALTER TABLE document_read_status ALTER COLUMN created_at SET DEFAULT NOW();

-- document_shares
ALTER TABLE document_shares ALTER COLUMN created_at SET DEFAULT NOW();

-- email_queue
ALTER TABLE email_queue ALTER COLUMN created_at SET DEFAULT NOW();

-- email_templates
ALTER TABLE email_templates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE email_templates ALTER COLUMN updated_at SET DEFAULT NOW();

-- employee_availability
ALTER TABLE employee_availability ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE employee_availability ALTER COLUMN updated_at SET DEFAULT NOW();

-- failed_file_deletions
ALTER TABLE failed_file_deletions ALTER COLUMN created_at SET DEFAULT NOW();

-- feature_usage_logs
ALTER TABLE feature_usage_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- features
ALTER TABLE features ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE features ALTER COLUMN updated_at SET DEFAULT NOW();

-- kvp_comments
ALTER TABLE kvp_comments ALTER COLUMN created_at SET DEFAULT NOW();

-- kvp_points
ALTER TABLE kvp_points ALTER COLUMN created_at SET DEFAULT NOW();

-- kvp_ratings
ALTER TABLE kvp_ratings ALTER COLUMN created_at SET DEFAULT NOW();

-- kvp_status_history
ALTER TABLE kvp_status_history ALTER COLUMN created_at SET DEFAULT NOW();

-- kvp_suggestions
ALTER TABLE kvp_suggestions ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE kvp_suggestions ALTER COLUMN updated_at SET DEFAULT NOW();

-- kvp_votes
ALTER TABLE kvp_votes ALTER COLUMN created_at SET DEFAULT NOW();

-- legal_holds
ALTER TABLE legal_holds ALTER COLUMN created_at SET DEFAULT NOW();

-- machine_maintenance_history
ALTER TABLE machine_maintenance_history ALTER COLUMN created_at SET DEFAULT NOW();

-- machines
ALTER TABLE machines ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE machines ALTER COLUMN updated_at SET DEFAULT NOW();

-- messages
ALTER TABLE messages ALTER COLUMN created_at SET DEFAULT NOW();

-- notification_preferences
ALTER TABLE notification_preferences ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE notification_preferences ALTER COLUMN updated_at SET DEFAULT NOW();

-- notifications
ALTER TABLE notifications ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE notifications ALTER COLUMN updated_at SET DEFAULT NOW();

-- oauth_tokens
ALTER TABLE oauth_tokens ALTER COLUMN created_at SET DEFAULT NOW();

-- password_reset_tokens
ALTER TABLE password_reset_tokens ALTER COLUMN created_at SET DEFAULT NOW();

-- payment_history
ALTER TABLE payment_history ALTER COLUMN created_at SET DEFAULT NOW();

-- plan_features
ALTER TABLE plan_features ALTER COLUMN created_at SET DEFAULT NOW();

-- plans
ALTER TABLE plans ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE plans ALTER COLUMN updated_at SET DEFAULT NOW();

-- recurring_jobs
ALTER TABLE recurring_jobs ALTER COLUMN created_at SET DEFAULT NOW();

-- refresh_tokens
ALTER TABLE refresh_tokens ALTER COLUMN created_at SET DEFAULT NOW();

-- root_logs
ALTER TABLE root_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- scheduled_tasks
ALTER TABLE scheduled_tasks ALTER COLUMN created_at SET DEFAULT NOW();

-- security_logs
ALTER TABLE security_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- shift_assignments
ALTER TABLE shift_assignments ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE shift_assignments ALTER COLUMN updated_at SET DEFAULT NOW();

-- shift_favorites
ALTER TABLE shift_favorites ALTER COLUMN created_at SET DEFAULT NOW();

-- shift_plans
ALTER TABLE shift_plans ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE shift_plans ALTER COLUMN updated_at SET DEFAULT NOW();

-- shift_rotation_assignments
ALTER TABLE shift_rotation_assignments ALTER COLUMN updated_at SET DEFAULT NOW();

-- shift_rotation_patterns
ALTER TABLE shift_rotation_patterns ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE shift_rotation_patterns ALTER COLUMN updated_at SET DEFAULT NOW();

-- shift_swap_requests
ALTER TABLE shift_swap_requests ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE shift_swap_requests ALTER COLUMN updated_at SET DEFAULT NOW();

-- shift_templates
ALTER TABLE shift_templates ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE shift_templates ALTER COLUMN updated_at SET DEFAULT NOW();

-- shifts
ALTER TABLE shifts ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE shifts ALTER COLUMN updated_at SET DEFAULT NOW();

-- subscription_plans
ALTER TABLE subscription_plans ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE subscription_plans ALTER COLUMN updated_at SET DEFAULT NOW();

-- survey_answers
ALTER TABLE survey_answers ALTER COLUMN created_at SET DEFAULT NOW();

-- survey_assignments
ALTER TABLE survey_assignments ALTER COLUMN created_at SET DEFAULT NOW();

-- survey_comments
ALTER TABLE survey_comments ALTER COLUMN created_at SET DEFAULT NOW();

-- survey_question_options
ALTER TABLE survey_question_options ALTER COLUMN created_at SET DEFAULT NOW();

-- survey_questions
ALTER TABLE survey_questions ALTER COLUMN created_at SET DEFAULT NOW();

-- survey_reminders
ALTER TABLE survey_reminders ALTER COLUMN created_at SET DEFAULT NOW();

-- survey_templates
ALTER TABLE survey_templates ALTER COLUMN created_at SET DEFAULT NOW();

-- surveys
ALTER TABLE surveys ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE surveys ALTER COLUMN updated_at SET DEFAULT NOW();

-- system_logs
ALTER TABLE system_logs ALTER COLUMN created_at SET DEFAULT NOW();

-- system_settings
ALTER TABLE system_settings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE system_settings ALTER COLUMN updated_at SET DEFAULT NOW();

-- teams
ALTER TABLE teams ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE teams ALTER COLUMN updated_at SET DEFAULT NOW();

-- tenant_addons
ALTER TABLE tenant_addons ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tenant_addons ALTER COLUMN updated_at SET DEFAULT NOW();

-- tenant_data_exports
ALTER TABLE tenant_data_exports ALTER COLUMN created_at SET DEFAULT NOW();

-- tenant_deletion_approvals
ALTER TABLE tenant_deletion_approvals ALTER COLUMN created_at SET DEFAULT NOW();

-- tenant_deletion_backups
ALTER TABLE tenant_deletion_backups ALTER COLUMN created_at SET DEFAULT NOW();

-- tenant_deletion_log
ALTER TABLE tenant_deletion_log ALTER COLUMN created_at SET DEFAULT NOW();

-- tenant_deletion_queue
ALTER TABLE tenant_deletion_queue ALTER COLUMN created_at SET DEFAULT NOW();

-- tenant_deletion_rollback
ALTER TABLE tenant_deletion_rollback ALTER COLUMN created_at SET DEFAULT NOW();

-- tenant_features
ALTER TABLE tenant_features ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tenant_features ALTER COLUMN updated_at SET DEFAULT NOW();

-- tenant_plans
ALTER TABLE tenant_plans ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tenant_plans ALTER COLUMN updated_at SET DEFAULT NOW();

-- tenant_settings
ALTER TABLE tenant_settings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tenant_settings ALTER COLUMN updated_at SET DEFAULT NOW();

-- tenant_webhooks
ALTER TABLE tenant_webhooks ALTER COLUMN created_at SET DEFAULT NOW();

-- tenants
ALTER TABLE tenants ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE tenants ALTER COLUMN updated_at SET DEFAULT NOW();

-- user_2fa_backup_codes
ALTER TABLE user_2fa_backup_codes ALTER COLUMN created_at SET DEFAULT NOW();

-- user_2fa_secrets
ALTER TABLE user_2fa_secrets ALTER COLUMN created_at SET DEFAULT NOW();

-- user_sessions
ALTER TABLE user_sessions ALTER COLUMN created_at SET DEFAULT NOW();

-- user_settings
ALTER TABLE user_settings ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE user_settings ALTER COLUMN updated_at SET DEFAULT NOW();

-- users
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT NOW();


-- =====================================================
-- SECTION 3: Verification
-- =====================================================

-- Verify no more columns without defaults
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('created_at', 'updated_at')
      AND column_default IS NULL;

    IF missing_count > 0 THEN
        RAISE NOTICE 'WARNING: Still % columns without DEFAULT', missing_count;
    ELSE
        RAISE NOTICE 'SUCCESS: All timestamp columns now have DEFAULT NOW()';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- Post-migration verification query (run manually):
--
-- SELECT table_name, column_name, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name IN ('created_at', 'updated_at')
-- ORDER BY table_name, column_name;
-- =====================================================
