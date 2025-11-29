-- ============================================================================
-- Migration: Migrate data from users.department_id to user_departments
-- Part of: Assignment System Refactoring - Consistency
-- Date: 2025-11-27
--
-- Purpose: Copy existing 1:1 relationships to N:M junction table
-- ============================================================================

-- Insert existing department assignments into new table
-- Only for users who have a department_id set (not NULL)
INSERT INTO user_departments (tenant_id, user_id, department_id, is_primary, assigned_at)
SELECT
  u.tenant_id,
  u.id as user_id,
  u.department_id,
  1 as is_primary,  -- All migrated records are primary
  COALESCE(u.created_at, NOW()) as assigned_at
FROM users u
WHERE u.department_id IS NOT NULL
  AND u.department_id != 0
  AND NOT EXISTS (
    -- Prevent duplicates if migration runs twice
    SELECT 1 FROM user_departments ud
    WHERE ud.user_id = u.id
      AND ud.department_id = u.department_id
      AND ud.tenant_id = u.tenant_id
  );

-- ============================================================================
-- Verification queries (run after migration)
-- ============================================================================
-- SELECT COUNT(*) as migrated FROM user_departments;
-- SELECT COUNT(*) as users_with_dept FROM users WHERE department_id IS NOT NULL AND department_id != 0;
-- These should match!
