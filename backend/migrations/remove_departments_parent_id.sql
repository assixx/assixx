-- =====================================================
-- Migration: Remove departments.parent_id (redundant)
-- Date: 2025-10-23
-- Author: Claude Code
-- Reason: Redundant - department_groups provides hierarchies with N:M flexibility
-- BACKUP: bash scripts/quick-backup.sh "before_remove_parent_id_$(date +%Y%m%d_%H%M%S)"
-- =====================================================

USE main;

-- 1. Verify no data in parent_id (for safety check)
SELECT
  'SAFETY CHECK' as step,
  COUNT(*) as total_departments,
  COUNT(parent_id) as with_parent,
  GROUP_CONCAT(DISTINCT parent_id) as parent_ids_used
FROM departments;

-- If you see data in parent_id column, STOP and review manually!

-- 2. Drop Foreign Key Constraint (safe drop with check)
SET @fk_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'departments'
    AND COLUMN_NAME = 'parent_id'
    AND REFERENCED_TABLE_NAME = 'departments'
);

SET @sql_drop_fk = IF(@fk_exists > 0,
    (SELECT CONCAT('ALTER TABLE departments DROP FOREIGN KEY ', CONSTRAINT_NAME)
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'departments'
     AND COLUMN_NAME = 'parent_id'
     AND REFERENCED_TABLE_NAME = 'departments'
     LIMIT 1),
    'SELECT "No foreign key constraint found" as info'
);

PREPARE stmt FROM @sql_drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Drop the parent_id column (with existence check)
SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'departments'
    AND COLUMN_NAME = 'parent_id'
);

SET @sql_drop_col = IF(@col_exists > 0,
    'ALTER TABLE departments DROP COLUMN parent_id',
    'SELECT "Column parent_id does not exist" as info'
);

PREPARE stmt_col FROM @sql_drop_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;

-- 4. Verify removal
SELECT 'VERIFICATION' as step;
DESCRIBE departments;

-- 5. Confirmation
SELECT 'SUCCESS: departments.parent_id removed. Use department_groups for hierarchies.' as status;
