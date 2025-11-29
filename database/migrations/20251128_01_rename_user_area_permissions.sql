-- =====================================================
-- Migration: Rename user_area_permissions to admin_area_permissions
-- Date: 2025-11-28
-- Author: Claude Code
-- Part of: Permission System Refactoring
-- =====================================================

-- Step 1: Rename the table
RENAME TABLE user_area_permissions TO admin_area_permissions;

-- Step 2: Rename column user_id to admin_user_id for clarity
ALTER TABLE admin_area_permissions
  CHANGE COLUMN user_id admin_user_id INT NOT NULL;

-- Step 3: Update index names (drop old, create new)
-- First check if old index exists and drop it
SET @idx_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'admin_area_permissions'
    AND INDEX_NAME = 'idx_user_area_permissions_user'
);

SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE admin_area_permissions DROP INDEX idx_user_area_permissions_user',
    'SELECT "Index idx_user_area_permissions_user does not exist"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create new index with correct name
CREATE INDEX idx_admin_area_permissions_admin ON admin_area_permissions(admin_user_id);

-- Step 4: Verify the changes
SELECT 'Migration 20251128_01 completed: user_area_permissions renamed to admin_area_permissions' AS status;
