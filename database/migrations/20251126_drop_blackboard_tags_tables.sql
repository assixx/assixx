-- Migration: Drop blackboard tags tables
-- Date: 2025-11-26
-- Description: Remove unused tag functionality from blackboard feature
-- Tags were never fully implemented in the UI and are being removed

-- Drop entry-tag junction table first (has FK to blackboard_tags)
DROP TABLE IF EXISTS blackboard_entry_tags;

-- Drop tags table
DROP TABLE IF EXISTS blackboard_tags;
