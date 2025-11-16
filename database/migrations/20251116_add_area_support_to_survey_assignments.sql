-- =====================================================
-- Migration: Add Area Support to Survey Assignments
-- Date: 2025-11-16
-- Author: Claude Code
-- Description: Adds 'area' as assignment type for surveys
-- =====================================================

-- Step 1: Add area_id column
ALTER TABLE survey_assignments
ADD COLUMN area_id INT DEFAULT NULL AFTER user_id;

-- Step 2: Modify assignment_type ENUM to include 'area'
ALTER TABLE survey_assignments
MODIFY COLUMN assignment_type
ENUM('all_users', 'area', 'department', 'team', 'user')
COLLATE utf8mb4_unicode_ci NOT NULL;

-- Step 3: Add index on area_id for performance
CREATE INDEX idx_area_id ON survey_assignments(area_id);

-- Step 4: Add foreign key constraint to areas table
ALTER TABLE survey_assignments
ADD CONSTRAINT fk_survey_assignments_area
FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE;

-- Step 5: Drop and recreate unique constraint to include area_id
-- First, drop the old unique constraint
ALTER TABLE survey_assignments
DROP INDEX unique_assignment;

-- Then, create new unique constraint including area_id
ALTER TABLE survey_assignments
ADD CONSTRAINT unique_assignment
UNIQUE KEY (tenant_id, survey_id, assignment_type, department_id, team_id, user_id, area_id);

-- =====================================================
-- Verification queries (run manually to verify)
-- =====================================================
-- DESCRIBE survey_assignments;
-- SHOW CREATE TABLE survey_assignments\G
