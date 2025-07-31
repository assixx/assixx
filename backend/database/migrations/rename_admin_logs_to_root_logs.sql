-- Migration: Rename admin_logs to root_logs
-- Reason: Clarify that these logs are only visible to root users, not admin users
-- Date: 2025-07-31

-- Step 1: Rename the table
ALTER TABLE admin_logs RENAME TO root_logs;

-- Step 2: Update indexes
-- Drop old indexes (MySQL doesn't support IF EXISTS for DROP INDEX)
ALTER TABLE root_logs DROP INDEX idx_admin_logs_user_id;
ALTER TABLE root_logs DROP INDEX idx_admin_logs_tenant_id;
ALTER TABLE root_logs DROP INDEX idx_admin_logs_created_at;
ALTER TABLE root_logs DROP INDEX idx_admin_logs_entity;

-- Create new indexes with proper names
CREATE INDEX idx_root_logs_user_id ON root_logs(user_id);
CREATE INDEX idx_root_logs_tenant_id ON root_logs(tenant_id);
CREATE INDEX idx_root_logs_created_at ON root_logs(created_at);
CREATE INDEX idx_root_logs_entity ON root_logs(entity_type, entity_id);

-- Note: No data migration needed, just renaming