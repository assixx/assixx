-- =====================================================
-- Migration: Remove redundant columns from users table
-- Date: 2025-11-27
-- Author: Claude
-- STATUS: EXECUTED on 2025-11-27
--
-- Removes:
--   - status (redundant with is_active) - ALREADY REMOVED
--   - profile_picture_url (redundant with profile_picture) - ALREADY REMOVED
--   - birthday (redundant with date_of_birth) - ALREADY REMOVED
--   - mobile (redundant with phone) - ALREADY REMOVED
--   - department_id (replaced by user_departments N:M table) - REMOVED 2025-11-27
--
-- PREREQUISITE: Run 20251127_create_user_departments.sql first!
-- PREREQUISITE: Run 20251127_migrate_user_departments_data.sql first!
-- =====================================================

-- Drop FK constraint first (required before dropping column)
ALTER TABLE users DROP FOREIGN KEY fk_users_department;

-- Drop department_id column (now managed via user_departments N:M table)
ALTER TABLE users DROP COLUMN department_id;

-- Verify remaining structure
DESCRIBE users;
