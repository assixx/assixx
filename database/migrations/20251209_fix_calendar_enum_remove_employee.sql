-- =====================================================
-- Migration: Fix calendar_events_created_by_role ENUM - remove employee
-- Date: 2025-12-09
-- Author: Claude Code
-- Reason: "employee" was incorrectly added - employees can only READ calendar, not CREATE events
-- Status: EXECUTED
-- =====================================================

-- Step 1: Remove DEFAULT (required before type change)
ALTER TABLE calendar_events ALTER COLUMN created_by_role DROP DEFAULT;

-- Step 2: Create new ENUM with correct values only
CREATE TYPE calendar_events_created_by_role_new AS ENUM ('root', 'admin', 'lead', 'user');

-- Step 3: Alter column to use new ENUM
ALTER TABLE calendar_events
  ALTER COLUMN created_by_role TYPE calendar_events_created_by_role_new
  USING created_by_role::text::calendar_events_created_by_role_new;

-- Step 4: Restore DEFAULT
ALTER TABLE calendar_events ALTER COLUMN created_by_role SET DEFAULT 'user';

-- Step 5: Drop old ENUM
DROP TYPE calendar_events_created_by_role;

-- Step 6: Rename new ENUM to original name
ALTER TYPE calendar_events_created_by_role_new RENAME TO calendar_events_created_by_role;

-- Verification:
-- SELECT enumlabel FROM pg_enum WHERE enumtypid = 'calendar_events_created_by_role'::regtype ORDER BY enumsortorder;
-- Result: {root, admin, lead, user}
