-- =====================================================
-- Migration: Add 'area' to org_level ENUM for KVP suggestions
-- Date: 2025-11-15
-- Author: Claude
-- Purpose: Allow KVP sharing at Area level
-- =====================================================

-- Step 1: Modify org_level ENUM to include 'area'
ALTER TABLE kvp_suggestions
MODIFY COLUMN org_level ENUM('company', 'department', 'area', 'team') NOT NULL DEFAULT 'team'
COMMENT 'Organization level for visibility: company (entire tenant), department, area (physical location), or team';

-- Step 2: Add index for area-based queries (if not exists)
-- This helps with performance when filtering by area
ALTER TABLE kvp_suggestions ADD INDEX idx_org_level_area (org_level, org_id, is_shared);

-- =====================================================
-- How it works:
-- Users → Departments → Areas
-- When org_level = 'area', org_id = area_id
-- All users in departments with same area_id can see the KVP
-- =====================================================