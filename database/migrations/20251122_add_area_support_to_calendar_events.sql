-- =====================================================
-- Migration: Add Area Support to Calendar Events
-- Date: 2025-11-22
-- Author: Claude (AI Assistant)
-- Description:
--   - Adds area_id column to calendar_events table
--   - Extends org_level enum to include 'area' option
--   - Enables area/location-based event organization
-- =====================================================

-- Temporarily disable foreign key checks for schema modifications
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================
-- 1. Add area_id column to calendar_events
-- =====================================================

ALTER TABLE calendar_events
ADD COLUMN area_id INT NULL
AFTER team_id,
ADD KEY idx_calendar_events_area_id (area_id),
ADD CONSTRAINT fk_calendar_events_area
  FOREIGN KEY (area_id)
  REFERENCES areas(id)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- =====================================================
-- 2. Extend org_level enum to include 'area'
-- =====================================================

ALTER TABLE calendar_events
MODIFY COLUMN org_level ENUM(
  'company',
  'department',
  'team',
  'area',
  'personal'
) DEFAULT 'personal';

-- =====================================================
-- 3. Add index for filtering by org_level (if not exists)
-- =====================================================

-- Check if index already exists is handled by IF NOT EXISTS in MySQL 8.0+
-- For MySQL 5.7 compatibility, we check manually
SET @index_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'calendar_events'
  AND INDEX_NAME = 'idx_calendar_events_org_level'
);

SET @sql = IF(@index_exists = 0,
  'ALTER TABLE calendar_events ADD INDEX idx_calendar_events_org_level (org_level)',
  'SELECT "Index idx_calendar_events_org_level already exists" AS info'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================
-- Verification Queries (commented out - use for testing)
-- =====================================================

-- SHOW COLUMNS FROM calendar_events LIKE 'area_id';
-- SHOW COLUMNS FROM calendar_events LIKE 'org_level';
-- SHOW INDEX FROM calendar_events WHERE Key_name = 'idx_calendar_events_area_id';
-- SELECT CONSTRAINT_NAME, REFERENCED_TABLE_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE TABLE_NAME = 'calendar_events' AND COLUMN_NAME = 'area_id';
