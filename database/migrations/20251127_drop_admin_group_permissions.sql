-- Migration: Drop admin_group_permissions table
-- Date: 2025-11-27
-- Reason: Table is DEPRECATED per N:M refactoring (docs/refactoring-assignment-concrete-plan.md)
--         Permissions are now handled via:
--         - users.has_full_access (boolean flag for full tenant access)
--         - user_area_permissions (N:M table for area assignments)
--         - admin_department_permissions (direct department assignments, KEPT)
--         The frontend permissions-modal was removed; areas/departments are now
--         directly assigned in the admin creation/edit form.

-- ============================================================
-- SAFETY: Create backup before dropping
-- ============================================================
-- Run this in a transaction to allow rollback if needed

START TRANSACTION;

-- ============================================================
-- Step 1: Backup existing data (optional, for audit trail)
-- ============================================================
-- If you need a backup, run this BEFORE the migration:
-- CREATE TABLE admin_group_permissions_backup_20251127 AS SELECT * FROM admin_group_permissions;

-- ============================================================
-- Step 2: Drop the deprecated table
-- ============================================================
DROP TABLE IF EXISTS admin_group_permissions;

-- ============================================================
-- Commit the transaction
-- ============================================================
COMMIT;

-- ============================================================
-- Verification (run manually after migration)
-- ============================================================
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'admin_group_permissions';
-- Expected result: 0
