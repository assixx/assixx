-- Migration 026: Add multi-organization support for blackboard entries
-- Date: 2025-11-24
-- Purpose: Allow blackboard entries to belong to multiple departments/teams/areas
-- Pattern: Same as calendar_attendees - mapping table for many-to-many relationship

-- ============================================================================
-- STEP 1: Create mapping table for entry organizations
-- ============================================================================

CREATE TABLE IF NOT EXISTS blackboard_entry_organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entry_id INT NOT NULL,
  org_type ENUM('department', 'team', 'area') NOT NULL,
  org_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_entry_id (entry_id),
  INDEX idx_org_type_id (org_type, org_id),
  INDEX idx_combined (entry_id, org_type, org_id),

  -- Foreign key to blackboard_entries
  CONSTRAINT fk_blackboard_entry_org_entry
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Prevent duplicate assignments
  UNIQUE KEY unique_entry_org (entry_id, org_type, org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Many-to-many mapping between blackboard entries and organizations (departments/teams/areas)';

-- ============================================================================
-- STEP 2: Migrate existing data from org_id to mapping table
-- Only migrate if org_level is not 'company' and org_id is not null
-- ============================================================================

INSERT INTO blackboard_entry_organizations (entry_id, org_type, org_id)
SELECT
  be.id,
  be.org_level,
  be.org_id
FROM blackboard_entries be
WHERE be.org_level IN ('department', 'team', 'area')
  AND be.org_id IS NOT NULL
ON DUPLICATE KEY UPDATE org_id = VALUES(org_id); -- Ignore duplicates if migration runs twice

-- ============================================================================
-- STEP 3: Add comment to legacy columns (keep for backwards compatibility)
-- ============================================================================

ALTER TABLE blackboard_entries
  MODIFY COLUMN org_level ENUM('company', 'department', 'team', 'area') DEFAULT 'company'
    COMMENT 'Legacy: Use blackboard_entry_organizations for multi-org. NULL = company-wide',
  MODIFY COLUMN org_id INT NULL
    COMMENT 'Legacy: Use blackboard_entry_organizations for multi-org';

-- ============================================================================
-- VERIFICATION QUERIES (commented out - for manual testing)
-- ============================================================================

-- Check table structure:
-- DESCRIBE blackboard_entry_organizations;

-- Check migrated data:
-- SELECT COUNT(*) FROM blackboard_entry_organizations;

-- Check indexes:
-- SHOW INDEX FROM blackboard_entry_organizations;

-- Check foreign keys:
-- SELECT
--   CONSTRAINT_NAME,
--   TABLE_NAME,
--   COLUMN_NAME,
--   REFERENCED_TABLE_NAME,
--   REFERENCED_COLUMN_NAME
-- FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_NAME = 'blackboard_entry_organizations';

-- Example: Get entry with all organizations:
-- SELECT
--   e.id,
--   e.title,
--   GROUP_CONCAT(CONCAT(eo.org_type, ':', eo.org_id) SEPARATOR ', ') as organizations
-- FROM blackboard_entries e
-- LEFT JOIN blackboard_entry_organizations eo ON e.id = eo.entry_id
-- GROUP BY e.id;
