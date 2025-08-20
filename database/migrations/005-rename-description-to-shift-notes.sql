-- ============================================================================
-- Migration: 005-rename-description-to-shift-notes.sql
-- Date: 2025-08-20
-- Purpose: Rename shift_plans.description to shift_notes for clarity
-- Author: Claude (Assixx Development)
-- ============================================================================

-- Check if column exists and rename it
-- Using INFORMATION_SCHEMA to check if column exists
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_plans' 
    AND COLUMN_NAME = 'description'
);

SET @sql = IF(@col_exists > 0,
    'ALTER TABLE shift_plans CHANGE COLUMN description shift_notes TEXT DEFAULT NULL',
    'SELECT "Column description does not exist or already renamed"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the change
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shift_plans'
    AND COLUMN_NAME IN ('description', 'shift_notes');