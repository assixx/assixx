-- =====================================================
-- Migration: Add private visibility for KVP suggestions
-- Date: 2025-11-15
-- Author: Claude
-- Purpose: Initial KVPs should only be visible to creator + team leader
-- =====================================================

-- Step 1: Add is_shared column to track if KVP has been shared
-- Default FALSE means only creator + team_leader can see it
ALTER TABLE kvp_suggestions
ADD COLUMN is_shared BOOLEAN DEFAULT FALSE AFTER org_id,
ADD INDEX idx_is_shared (is_shared);

-- Step 2: Mark all existing KVPs as shared (to preserve current visibility)
UPDATE kvp_suggestions
SET is_shared = TRUE
WHERE is_shared = FALSE;

-- Step 3: Add comment to explain the column
ALTER TABLE kvp_suggestions
MODIFY COLUMN is_shared BOOLEAN DEFAULT FALSE
COMMENT 'FALSE = private (only creator + team_leader), TRUE = shared to org_level/org_id';

-- =====================================================
-- How it works:
-- 1. New KVPs: is_shared = FALSE, org_level = 'team', org_id = team_id
--    → Only visible to: submitted_by + team_lead_id
-- 2. After share: is_shared = TRUE
--    → Visible based on org_level/org_id settings
-- =====================================================