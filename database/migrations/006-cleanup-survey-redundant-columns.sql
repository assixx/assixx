-- =====================================================
-- Migration: Remove redundant target columns from surveys table
-- Date: 2025-09-10
-- Author: System
-- Description: Remove deprecated target_departments and target_teams columns
--              as they are replaced by survey_assignments table
-- =====================================================

-- 1. Verify no data exists in these columns (safety check)
SELECT 
    COUNT(*) as records_with_data,
    'Checking for non-null target_departments or target_teams' as check_description
FROM surveys 
WHERE target_departments IS NOT NULL 
   OR target_teams IS NOT NULL;

-- 2. Drop the redundant columns
ALTER TABLE surveys 
    DROP COLUMN target_departments,
    DROP COLUMN target_teams;

-- 3. Verify columns were removed
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_KEY,
    COLUMN_DEFAULT,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'surveys'
    AND COLUMN_NAME IN ('target_departments', 'target_teams');

-- 4. Add comment to table documenting the change
ALTER TABLE surveys 
    COMMENT = 'Survey definitions - assignment targets now managed via survey_assignments table';

-- End of migration