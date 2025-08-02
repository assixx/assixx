-- Migration: Add org_level and org_id fields to calendar_events table
-- Date: 2025-07-26
-- Purpose: Support API v2 organization-level calendar events

-- Add org_level column
ALTER TABLE calendar_events 
ADD COLUMN org_level ENUM('company', 'department', 'team', 'personal') DEFAULT 'personal' 
AFTER all_day;

-- Add org_id column
ALTER TABLE calendar_events 
ADD COLUMN org_id INT DEFAULT NULL 
AFTER org_level;

-- Add index for org_level and org_id
ALTER TABLE calendar_events 
ADD INDEX idx_org_level_id (org_level, org_id);

-- Update existing events to have appropriate org_level based on type
UPDATE calendar_events 
SET org_level = CASE 
    WHEN type = 'meeting' THEN 'company'
    WHEN type = 'training' THEN 'team'
    ELSE 'personal'
END;