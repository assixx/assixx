-- Migration: Drop parent_id column from areas table
-- Date: 2025-11-29
-- Status: EXECUTED
-- Reason: Hierarchical areas feature was never used (all parent_id values are NULL)
--         Removing to simplify the data model - areas are now flat (non-hierarchical)

-- Step 1: Drop the foreign key constraint first
ALTER TABLE areas DROP FOREIGN KEY fk_areas_parent;

-- Step 2: Drop the index on parent_id (actual name was idx_areas_parent)
ALTER TABLE areas DROP INDEX idx_areas_parent;

-- Step 3: Drop the parent_id column
ALTER TABLE areas DROP COLUMN parent_id;

-- Verification query (run manually to confirm):
-- DESCRIBE areas;
