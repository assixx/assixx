-- =====================================================
-- FIX FOREIGN KEYS - FINAL SOLUTION
-- =====================================================
-- Date: 2025-01-12
-- Purpose: Remove conflicting CHECK constraints and add proper Foreign Keys
-- Issue: MySQL doesn't allow CHECK constraints on columns with CASCADE FKs
-- Solution: Remove CHECK constraints, rely on FK + application validation
-- =====================================================

USE main;

-- =====================================================
-- STEP 1: REMOVE CONFLICTING CHECK CONSTRAINTS
-- =====================================================
-- These check constraints conflict with CASCADE foreign keys
-- Data integrity will be ensured by:
-- 1. Foreign Key constraints (DB level)
-- 2. Application-level validation (Zod schemas)
-- 3. TypeScript types (compile-time safety)

SELECT 'Removing conflicting CHECK constraints...' as status;

-- Drop constraints that involve owner_user_id (conflicts with CASCADE FK)
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS chk_personal_has_owner;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS chk_payroll_has_owner;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS chk_payroll_has_period;

-- Drop constraints that involve target fields (conflicts with SET NULL FK)
ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS chk_team_has_target;

ALTER TABLE documents
  DROP CONSTRAINT IF EXISTS chk_department_has_target;

-- KEEP these constraints (they don't conflict):
-- - chk_salary_month_range (simple value check)
-- - chk_salary_year_range (simple value check)

SELECT 'CHECK constraints removed (data integrity via FK + application)' as note;

-- =====================================================
-- STEP 2: ADD FOREIGN KEY FOR owner_user_id
-- =====================================================
-- Owner user (for personal/payroll documents)
-- ON DELETE CASCADE: If user deleted, their personal docs deleted (GDPR)

SELECT 'Adding FK: owner_user_id → users(id) with CASCADE...' as status;

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_owner_user
    FOREIGN KEY (owner_user_id)
    REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- =====================================================
-- STEP 3: ADD FOREIGN KEY FOR target_team_id
-- =====================================================
-- Target team (for team documents)
-- ON DELETE SET NULL: If team deleted, docs become orphaned (admin can see)

SELECT 'Adding FK: target_team_id → teams(id) with SET NULL...' as status;

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_target_team
    FOREIGN KEY (target_team_id)
    REFERENCES teams(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- =====================================================
-- STEP 4: ADD FOREIGN KEY FOR target_department_id
-- =====================================================
-- Target department (for department documents)
-- ON DELETE SET NULL: If dept deleted, docs become orphaned (admin can see)

SELECT 'Adding FK: target_department_id → departments(id) with SET NULL...' as status;

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_target_dept
    FOREIGN KEY (target_department_id)
    REFERENCES departments(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- =====================================================
-- STEP 5: VERIFY FOREIGN KEYS WERE ADDED
-- =====================================================
SELECT 'Verifying all foreign keys...' as status;

SELECT
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME,
  'CASCADE' as note
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'main'
  AND TABLE_NAME = 'documents'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY CONSTRAINT_NAME;

-- =====================================================
-- STEP 6: VERIFY REMAINING CHECK CONSTRAINTS
-- =====================================================
SELECT 'Remaining CHECK constraints (non-conflicting):' as status;

SHOW CREATE TABLE documents;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
SELECT '✅ Foreign keys migration complete!' as status;
SELECT '
SUMMARY:
- Removed: CHECK constraints conflicting with CASCADE FKs
- Added: fk_documents_owner_user (CASCADE for GDPR)
- Added: fk_documents_target_team (SET NULL for orphaned docs)
- Added: fk_documents_target_dept (SET NULL for orphaned docs)
- Kept: chk_salary_month_range, chk_salary_year_range
- Data Integrity: FK constraints + Application validation (Zod)
' as notes;
