-- Migration: Add organizational structure and missing columns to blackboard_entries
-- Date: 2025-06-05
-- Description: Adds org_level, org_id, color, expires_at, and status columns

-- Add organizational structure columns
ALTER TABLE blackboard_entries
ADD COLUMN org_level ENUM('company', 'department', 'team') DEFAULT 'company' AFTER tenant_id,
ADD COLUMN org_id INT NULL AFTER org_level;

-- Add color column for visual styling
ALTER TABLE blackboard_entries
ADD COLUMN color VARCHAR(20) DEFAULT 'blue' AFTER priority;

-- Add expires_at column for time-limited entries
ALTER TABLE blackboard_entries
ADD COLUMN expires_at DATETIME NULL AFTER valid_until;

-- Add status column
ALTER TABLE blackboard_entries
ADD COLUMN status ENUM('active', 'archived') DEFAULT 'active' AFTER is_active;

-- Add indexes for better performance
ALTER TABLE blackboard_entries
ADD INDEX idx_org_level (org_level),
ADD INDEX idx_org_id (org_id),
ADD INDEX idx_status (status),
ADD INDEX idx_expires_at (expires_at);

-- Update existing entries to have company level
UPDATE blackboard_entries 
SET org_level = 'company', org_id = NULL 
WHERE org_level IS NULL;