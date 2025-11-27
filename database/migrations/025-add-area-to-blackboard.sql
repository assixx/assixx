-- Migration 025: Add area support to blackboard_entries
-- Date: 2025-11-24
-- Purpose: Add 'area' org_level and area_id column, fix UUID type from varchar to char

-- ============================================================================
-- STEP 1: Modify org_level enum to include 'area'
-- ============================================================================

ALTER TABLE blackboard_entries
  MODIFY COLUMN org_level ENUM('company', 'department', 'team', 'area') DEFAULT 'company';

-- ============================================================================
-- STEP 2: Add area_id column (note: blackboard uses generic org_id, not separate IDs)
-- NOTE: This is for future reference tracking only, actual linking uses org_id
-- ============================================================================

ALTER TABLE blackboard_entries
  ADD COLUMN area_id INT NULL AFTER org_id,
  ADD INDEX idx_area_id (area_id);

-- ============================================================================
-- STEP 3: Add foreign key constraint for area_id
-- ============================================================================

ALTER TABLE blackboard_entries
  ADD CONSTRAINT fk_blackboard_area
    FOREIGN KEY (area_id) REFERENCES areas(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- ============================================================================
-- STEP 4: Fix UUID column type from varchar(36) to char(36)
-- Better performance for fixed-length UUIDs (matches calendar_events)
-- ============================================================================

ALTER TABLE blackboard_entries
  MODIFY COLUMN uuid CHAR(36) NULL;

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

-- Check column types:
-- DESCRIBE blackboard_entries;

-- Verify enum values:
-- SHOW COLUMNS FROM blackboard_entries LIKE 'org_level';

-- Check indexes:
-- SHOW INDEX FROM blackboard_entries WHERE Column_name = 'area_id';

-- Check foreign keys:
-- SELECT
--   CONSTRAINT_NAME,
--   TABLE_NAME,
--   COLUMN_NAME,
--   REFERENCED_TABLE_NAME,
--   REFERENCED_COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'blackboard_entries'
--   AND CONSTRAINT_NAME = 'fk_blackboard_area';
