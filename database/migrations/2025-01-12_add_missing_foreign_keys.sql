-- =====================================================
-- ADD MISSING FOREIGN KEYS TO DOCUMENTS TABLE
-- =====================================================
-- Date: 2025-01-12
-- Purpose: Add foreign keys that were missing from previous migration
-- Critical: Ensures referential integrity for multi-tenant isolation
-- =====================================================

USE main;

-- =====================================================
-- STEP 1: VERIFY TABLES EXIST
-- =====================================================
SELECT 'Checking if referenced tables exist...' as status;

SELECT COUNT(*) as users_exists FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'main' AND TABLE_NAME = 'users';

SELECT COUNT(*) as teams_exists FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'main' AND TABLE_NAME = 'teams';

SELECT COUNT(*) as departments_exists FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'main' AND TABLE_NAME = 'departments';

-- =====================================================
-- STEP 2: ADD FOREIGN KEY FOR owner_user_id
-- =====================================================
-- Owner user (for personal/payroll documents)
-- ON DELETE CASCADE: If user deleted, their personal docs deleted (GDPR)

SELECT 'Adding FK: owner_user_id → users(id)...' as status;

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

SELECT 'Adding FK: target_team_id → teams(id)...' as status;

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

SELECT 'Adding FK: target_department_id → departments(id)...' as status;

ALTER TABLE documents
  ADD CONSTRAINT fk_documents_target_dept
    FOREIGN KEY (target_department_id)
    REFERENCES departments(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- =====================================================
-- STEP 5: VERIFY FOREIGN KEYS WERE ADDED
-- =====================================================
SELECT 'Verifying foreign keys...' as status;

SELECT
  CONSTRAINT_NAME,
  COLUMN_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'main'
  AND TABLE_NAME = 'documents'
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY CONSTRAINT_NAME;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
SELECT '✅ Foreign keys added successfully!' as status;
SELECT 'Documents table now has full referential integrity' as note;
