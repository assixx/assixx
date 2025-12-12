-- Migration: Drop kvp_points table and related ENUM type
-- Date: 2025-12-12
-- Description: Remove dead KVP points system - table is empty and functionality unused

-- Drop the table first (depends on the ENUM type)
DROP TABLE IF EXISTS kvp_points;

-- Drop the ENUM type
DROP TYPE IF EXISTS kvp_points_reason;
