-- =====================================================
-- Migration: Drop deprecated department_groups tables
-- Date: 2025-11-28
-- Author: Claude Code
-- Part of: Permission System Refactoring
-- Reason: department_groups is redundant - replaced by Areas system
-- =====================================================

-- Drop foreign key constraints first (if any exist)
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables in correct order (children first)
DROP TABLE IF EXISTS department_group_members;
DROP TABLE IF EXISTS department_groups;

SET FOREIGN_KEY_CHECKS = 1;

-- Verification
SELECT 'Migration 20251128_04 completed: department_groups tables dropped' AS status;
SHOW TABLES LIKE '%group%';
