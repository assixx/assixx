-- ============================================================================
-- Migration: 004-shift-plans-fix.sql
-- Date: 2025-08-20
-- Purpose: Add machine_id and area_id to shift_plans table for complete hierarchy
-- Author: Claude (Assixx Development)
-- ============================================================================

-- Check if columns exist and add them if not
-- Add machine_id column if it doesn't exist
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_plans' 
    AND COLUMN_NAME = 'machine_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE shift_plans ADD COLUMN machine_id INT DEFAULT NULL AFTER team_id',
    'SELECT "Column machine_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add area_id column if it doesn't exist
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_plans' 
    AND COLUMN_NAME = 'area_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE shift_plans ADD COLUMN area_id INT DEFAULT NULL AFTER machine_id',
    'SELECT "Column area_id already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint for machine_id if it doesn't exist
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shift_plans'
    AND COLUMN_NAME = 'machine_id'
    AND CONSTRAINT_NAME = 'fk_shift_plans_machine'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shift_plans ADD CONSTRAINT fk_shift_plans_machine FOREIGN KEY (machine_id) REFERENCES machines(id) ON DELETE SET NULL',
    'SELECT "Foreign key fk_shift_plans_machine already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint for area_id if it doesn't exist
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shift_plans'
    AND COLUMN_NAME = 'area_id'
    AND CONSTRAINT_NAME = 'fk_shift_plans_area'
);

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE shift_plans ADD CONSTRAINT fk_shift_plans_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL',
    'SELECT "Foreign key fk_shift_plans_area already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for machine_id if it doesn't exist
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_plans' 
    AND INDEX_NAME = 'idx_shift_plans_machine'
);

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_shift_plans_machine ON shift_plans(machine_id)',
    'SELECT "Index idx_shift_plans_machine already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for area_id if it doesn't exist
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'shift_plans' 
    AND INDEX_NAME = 'idx_shift_plans_area'
);

SET @sql = IF(@idx_exists = 0,
    'CREATE INDEX idx_shift_plans_area ON shift_plans(area_id)',
    'SELECT "Index idx_shift_plans_area already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing shift_plans records to include area_id from department
UPDATE shift_plans sp
JOIN departments d ON sp.department_id = d.id
SET sp.area_id = d.area_id
WHERE sp.area_id IS NULL AND d.area_id IS NOT NULL;

-- Verify the changes
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'shift_plans'
    AND COLUMN_NAME IN ('machine_id', 'area_id');