-- =====================================================
-- Migration: Add 'root' to calendar_events_created_by_role ENUM
-- Date: 2025-12-09
-- Author: Claude Code
-- Issue: Calendar create fails with "invalid input value for enum calendar_events_created_by_role: root"
-- =====================================================

-- Check current ENUM values (for documentation)
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'calendar_events_created_by_role'::regtype;
-- Result: {admin, lead, user}

-- Add 'root' value to the ENUM (at the beginning for logical order)
ALTER TYPE calendar_events_created_by_role ADD VALUE IF NOT EXISTS 'root' BEFORE 'admin';

-- Also add 'employee' for consistency with users_role ENUM
ALTER TYPE calendar_events_created_by_role ADD VALUE IF NOT EXISTS 'employee' AFTER 'user';

-- Verification query (run manually):
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'calendar_events_created_by_role'::regtype ORDER BY enumsortorder;
-- Expected: {root, admin, lead, user, employee}
