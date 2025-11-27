-- Migration 027: Add multi-organization support for calendar events
-- Date: 2025-11-24
-- Purpose: Allow calendar events to belong to multiple departments/teams/areas simultaneously

-- Create mapping table for calendar event organizations
CREATE TABLE IF NOT EXISTS calendar_events_organizations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_id INT NOT NULL,
  org_type ENUM('department', 'team', 'area') NOT NULL,
  org_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for performance
  INDEX idx_event_id (event_id),
  INDEX idx_org_type_id (org_type, org_id),
  INDEX idx_combined (event_id, org_type, org_id),

  -- Foreign key to calendar_events
  CONSTRAINT fk_calendar_event_org_event
    FOREIGN KEY (event_id) REFERENCES calendar_events(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Prevent duplicate assignments
  UNIQUE KEY unique_event_org (event_id, org_type, org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing single-org data to mapping table
-- Priority: area_id > department_id > team_id (one per event)
INSERT INTO calendar_events_organizations (event_id, org_type, org_id)
SELECT ce.id, 'area', ce.area_id
FROM calendar_events ce
WHERE ce.area_id IS NOT NULL
  AND ce.org_level = 'area'
ON DUPLICATE KEY UPDATE org_id = VALUES(org_id);

INSERT INTO calendar_events_organizations (event_id, org_type, org_id)
SELECT ce.id, 'department', ce.department_id
FROM calendar_events ce
WHERE ce.department_id IS NOT NULL
  AND ce.org_level = 'department'
  AND ce.area_id IS NULL  -- Only migrate if not already area
ON DUPLICATE KEY UPDATE org_id = VALUES(org_id);

INSERT INTO calendar_events_organizations (event_id, org_type, org_id)
SELECT ce.id, 'team', ce.team_id
FROM calendar_events ce
WHERE ce.team_id IS NOT NULL
  AND ce.org_level = 'team'
  AND ce.area_id IS NULL
  AND ce.department_id IS NULL  -- Only migrate if not already area/dept
ON DUPLICATE KEY UPDATE org_id = VALUES(org_id);

-- Add comments to legacy columns (keep for backwards compatibility)
ALTER TABLE calendar_events
  MODIFY COLUMN org_level ENUM('company', 'department', 'team', 'area', 'personal') DEFAULT 'personal'
    COMMENT 'Legacy: Use calendar_events_organizations for multi-org';

ALTER TABLE calendar_events
  MODIFY COLUMN department_id INT NULL
    COMMENT 'Legacy: Use calendar_events_organizations for multi-org';

ALTER TABLE calendar_events
  MODIFY COLUMN team_id INT NULL
    COMMENT 'Legacy: Use calendar_events_organizations for multi-org';

ALTER TABLE calendar_events
  MODIFY COLUMN area_id INT NULL
    COMMENT 'Legacy: Use calendar_events_organizations for multi-org';
