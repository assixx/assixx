-- =====================================================
-- Migration: Shift System Complete Fix (SAFE VERSION)
-- Date: 2025-01-28
-- Author: System
-- Purpose: Fix Multi-Tenant Isolation & Add Machine Support
-- =====================================================

-- 1. Add machine_id to shifts table (CRITICAL for machine-based planning)
-- Check if column exists first
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shifts' 
    AND COLUMN_NAME = 'machine_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shifts ADD COLUMN machine_id INT DEFAULT NULL AFTER team_id',
    'SELECT "Column machine_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if not exists
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shifts'
    AND COLUMN_NAME = 'machine_id'
    AND REFERENCED_TABLE_NAME = 'machines'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shifts ADD CONSTRAINT fk_shifts_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL',
    'SELECT "Foreign key fk_shifts_machine already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Fix Multi-Tenant Isolation (SECURITY CRITICAL!)
-- Fix shift_group_members
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_group_members' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_group_members ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_group_members"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix shift_notes
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_notes' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_notes ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_notes"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix shift_pattern_assignments
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_pattern_assignments' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_pattern_assignments ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_pattern_assignments"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Fix shift_swaps
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_swaps' 
    AND COLUMN_NAME = 'tenant_id'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE shift_swaps ADD COLUMN tenant_id INT NOT NULL DEFAULT 8 AFTER id',
    'SELECT "Column tenant_id already exists in shift_swaps"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Update shift types to include common German shift types
ALTER TABLE shifts 
MODIFY COLUMN type ENUM('regular','overtime','standby','vacation','sick','holiday','early','late','night','day','flexible') 
DEFAULT 'regular';

-- 4. Migration complete message
SELECT 'Migration 004-shift-system-complete-safe.sql completed successfully!' as status;