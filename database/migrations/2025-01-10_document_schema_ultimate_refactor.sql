-- =====================================================
-- ULTIMATE DOCUMENT SCHEMA REFACTORING
-- =====================================================
-- Date: 2025-01-10
-- Purpose: Clean architecture with clear access control
-- Impact: Schema change (backwards compatible during migration)
-- Rollback: Use backup file before running this
-- =====================================================

USE main;

-- =====================================================
-- STEP 1: ADD NEW COLUMNS (NULL allowed initially)
-- =====================================================
-- These new columns will replace the ambiguous old structure

ALTER TABLE documents
  -- Access control (maps 1:1 to frontend sidebar)
  ADD COLUMN access_scope ENUM(
    'personal',
    'team',
    'department',
    'company',
    'payroll'
  ) DEFAULT NULL
  COMMENT 'WHO can see this document (maps to sidebar categories)'
  AFTER tenant_id,

  -- Clear semantic field names
  ADD COLUMN owner_user_id INT DEFAULT NULL
  COMMENT 'User who owns this document (for personal/payroll scopes)'
  AFTER access_scope,

  ADD COLUMN target_team_id INT DEFAULT NULL
  COMMENT 'Team that can access this document (for team scope)'
  AFTER owner_user_id,

  ADD COLUMN target_department_id INT DEFAULT NULL
  COMMENT 'Department that can access this document (for department scope)'
  AFTER target_team_id,

  -- Payroll-specific fields
  ADD COLUMN salary_year INT DEFAULT NULL
  COMMENT 'Year for payroll documents (e.g., 2025)'
  AFTER target_department_id,

  ADD COLUMN salary_month INT DEFAULT NULL
  COMMENT 'Month for payroll documents (1-12)'
  AFTER salary_year;

-- =====================================================
-- STEP 2: MIGRATE DATA FROM OLD STRUCTURE
-- =====================================================
-- Automatically convert old schema to new schema

UPDATE documents
SET
  -- Map access_scope based on old recipient_type + category
  access_scope = CASE
    -- Payroll: recipient_type='user' AND category='salary'
    WHEN recipient_type = 'user' AND category = 'salary' THEN 'payroll'

    -- Personal: recipient_type='user'
    WHEN recipient_type = 'user' THEN 'personal'

    -- Team: recipient_type='team'
    WHEN recipient_type = 'team' THEN 'team'

    -- Department: recipient_type='department'
    WHEN recipient_type = 'department' THEN 'department'

    -- Company: recipient_type='company'
    WHEN recipient_type = 'company' THEN 'company'

    -- Fallback for any edge cases
    ELSE 'personal'
  END,

  -- Map owner_user_id (for personal and payroll scopes)
  owner_user_id = CASE
    WHEN recipient_type IN ('user') THEN user_id
    ELSE NULL
  END,

  -- Map target_team_id (for team scope)
  target_team_id = CASE
    WHEN recipient_type = 'team' THEN team_id
    ELSE NULL
  END,

  -- Map target_department_id (for department scope)
  target_department_id = CASE
    WHEN recipient_type = 'department' THEN department_id
    ELSE NULL
  END,

  -- Extract salary period for payroll documents
  salary_year = CASE
    WHEN category = 'salary' THEN year
    ELSE NULL
  END,

  salary_month = CASE
    WHEN category = 'salary' THEN
      -- Convert German month names to numbers if they exist
      CASE month
        WHEN 'Januar' THEN 1
        WHEN 'Februar' THEN 2
        WHEN 'März' THEN 3
        WHEN 'April' THEN 4
        WHEN 'Mai' THEN 5
        WHEN 'Juni' THEN 6
        WHEN 'Juli' THEN 7
        WHEN 'August' THEN 8
        WHEN 'September' THEN 9
        WHEN 'Oktober' THEN 10
        WHEN 'November' THEN 11
        WHEN 'Dezember' THEN 12
        -- If already a number, cast it
        ELSE CAST(month AS UNSIGNED)
      END
    ELSE NULL
  END;

-- Verify migration was successful
SELECT
  COUNT(*) as total_documents,
  access_scope,
  COUNT(CASE WHEN owner_user_id IS NOT NULL THEN 1 END) as has_owner,
  COUNT(CASE WHEN target_team_id IS NOT NULL THEN 1 END) as has_team,
  COUNT(CASE WHEN target_department_id IS NOT NULL THEN 1 END) as has_dept
FROM documents
GROUP BY access_scope;

-- =====================================================
-- STEP 3: MAKE CATEGORY FLEXIBLE (VARCHAR)
-- =====================================================
-- Change from rigid ENUM to flexible VARCHAR for better extensibility

-- First, update existing category values to be more descriptive
UPDATE documents
SET category = CASE
  WHEN category = 'salary' THEN 'payroll'
  WHEN category = 'personal' THEN 'personal-document'
  WHEN category = 'work' THEN 'work-document'
  WHEN category = 'training' THEN 'training-material'
  WHEN category = 'general' THEN 'general'
  ELSE category
END;

-- Now change the column type to VARCHAR for flexibility
ALTER TABLE documents
  MODIFY COLUMN category VARCHAR(50) DEFAULT NULL
  COMMENT 'Document type classification (flexible metadata)';

-- =====================================================
-- STEP 4: MAKE access_scope NOT NULL
-- =====================================================
-- After data migration, enforce NOT NULL constraint

ALTER TABLE documents
  MODIFY COLUMN access_scope ENUM(
    'personal',
    'team',
    'department',
    'company',
    'payroll'
  ) NOT NULL
  COMMENT 'WHO can see this document (maps to sidebar categories)';

-- =====================================================
-- STEP 5: ADD DATABASE CONSTRAINTS (Security Layer)
-- =====================================================
-- NOTE: MySQL limitation - Cannot add CHECK constraints on columns
-- with CASCADE foreign keys. We rely on application-level validation
-- and foreign key constraints for data integrity.

-- Salary month must be 1-12 (not involved in FK)
ALTER TABLE documents
  ADD CONSTRAINT chk_salary_month_range
    CHECK (
      salary_month IS NULL
      OR (salary_month >= 1 AND salary_month <= 12)
    );

-- Salary year must be reasonable (not involved in FK)
ALTER TABLE documents
  ADD CONSTRAINT chk_salary_year_range
    CHECK (
      salary_year IS NULL
      OR (salary_year >= 2000 AND salary_year <= 2100)
    );

-- NOTE: The following constraints would be ideal but MySQL doesn't support them
-- with CASCADE foreign keys. They are enforced at application level instead:
--   - Personal/payroll documents must have owner_user_id
--   - Team documents must have target_team_id
--   - Department documents must have target_department_id

-- =====================================================
-- STEP 6: ADD FOREIGN KEYS FOR NEW COLUMNS
-- =====================================================
-- Link new columns to their respective tables

-- Owner user (for personal/payroll documents)
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_owner_user
    FOREIGN KEY (owner_user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- Target team (for team documents)
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_target_team
    FOREIGN KEY (target_team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Target department (for department documents)
ALTER TABLE documents
  ADD CONSTRAINT fk_documents_target_dept
    FOREIGN KEY (target_department_id)
    REFERENCES departments(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- =====================================================
-- STEP 7: ADD OPTIMIZED INDEXES
-- =====================================================
-- Performance optimization for most common query patterns

-- Drop old indexes that are no longer optimal
ALTER TABLE documents
  DROP INDEX IF EXISTS idx_user_id,
  DROP INDEX IF EXISTS idx_category;

-- Add new composite index for most common query: "get my documents by scope"
ALTER TABLE documents
  ADD INDEX idx_tenant_scope_owner (tenant_id, access_scope, owner_user_id)
  COMMENT 'Optimizes: Get my documents filtered by scope';

-- Add index for team document queries
ALTER TABLE documents
  ADD INDEX idx_tenant_target_team (tenant_id, target_team_id)
  COMMENT 'Optimizes: Get team documents';

-- Add index for department document queries
ALTER TABLE documents
  ADD INDEX idx_tenant_target_dept (tenant_id, target_department_id)
  COMMENT 'Optimizes: Get department documents';

-- =====================================================
-- STEP 8: VERIFICATION QUERIES
-- =====================================================
-- Verify the migration was successful

-- Check all documents have valid access_scope
SELECT
  'Documents with NULL access_scope' as check_name,
  COUNT(*) as count
FROM documents
WHERE access_scope IS NULL;

-- Check personal documents have owner
SELECT
  'Personal documents without owner' as check_name,
  COUNT(*) as count
FROM documents
WHERE access_scope = 'personal' AND owner_user_id IS NULL;

-- Check team documents have target
SELECT
  'Team documents without target' as check_name,
  COUNT(*) as count
FROM documents
WHERE access_scope = 'team' AND target_team_id IS NULL;

-- Check payroll documents have period
SELECT
  'Payroll documents without period' as check_name,
  COUNT(*) as count
FROM documents
WHERE access_scope = 'payroll'
  AND (salary_year IS NULL OR salary_month IS NULL);

-- Summary of migration
SELECT
  'Migration Summary' as info,
  COUNT(*) as total_documents,
  COUNT(DISTINCT access_scope) as unique_scopes,
  COUNT(CASE WHEN owner_user_id IS NOT NULL THEN 1 END) as with_owner,
  COUNT(CASE WHEN target_team_id IS NOT NULL THEN 1 END) as with_team,
  COUNT(CASE WHEN target_department_id IS NOT NULL THEN 1 END) as with_dept
FROM documents;

-- =====================================================
-- STEP 9: DOCUMENT OLD COLUMNS FOR REMOVAL
-- =====================================================
-- DO NOT DROP OLD COLUMNS YET!
-- Keep them for 1 week to allow rollback if needed
-- After thorough testing, run this manually:

/*
-- ONLY RUN AFTER 1 WEEK OF SUCCESSFUL OPERATION:

ALTER TABLE documents
  DROP COLUMN recipient_type,
  DROP COLUMN user_id,
  DROP COLUMN team_id,
  DROP COLUMN department_id,
  DROP COLUMN year,
  DROP COLUMN month;
*/

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
SELECT '✅ Migration completed successfully!' as status;
SELECT 'Old columns are still present for safety (will be removed after 1 week)' as note;
