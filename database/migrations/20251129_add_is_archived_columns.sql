-- Migration: Add is_archived column to departments, areas, and teams tables
-- Date: 2025-11-29
-- Reason: Frontend has "Archiviert" filter but DB column was missing
--         This enables proper archive functionality across all three tables

-- ============================================================
-- STEP 1: Add is_archived to departments table
-- ============================================================
ALTER TABLE departments
ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0
AFTER is_active;

-- Add index for filtering performance
ALTER TABLE departments
ADD INDEX idx_departments_is_archived (is_archived);

-- ============================================================
-- STEP 2: Add is_archived to areas table
-- ============================================================
ALTER TABLE areas
ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0
AFTER is_active;

-- Add index for filtering performance
ALTER TABLE areas
ADD INDEX idx_areas_is_archived (is_archived);

-- ============================================================
-- STEP 3: Add is_archived to teams table
-- ============================================================
ALTER TABLE teams
ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0
AFTER is_active;

-- Add index for filtering performance
ALTER TABLE teams
ADD INDEX idx_teams_is_archived (is_archived);

-- ============================================================
-- Verification queries (run manually to confirm):
-- ============================================================
-- DESCRIBE departments;
-- DESCRIBE areas;
-- DESCRIBE teams;
