-- =====================================================
-- Migration: Blackboard status ENUM -> is_active INTEGER
-- Date: 2026-01-20
-- Author: Claude
--
-- Purpose:
--   - Migrate from status ENUM ('active','archived') to is_active INTEGER
--   - Consistent with rest of app (users, etc.): 0=inactive, 1=active, 3=archive, 4=deleted
--   - Drop status column and ENUM type
-- =====================================================

-- 1. Migrate existing status values to is_active
-- 'active' -> 1, 'archived' -> 3
UPDATE blackboard_entries
SET is_active = CASE
    WHEN status = 'active' THEN 1
    WHEN status = 'archived' THEN 3
    ELSE 1  -- Default to active if somehow NULL
END;

-- 2. Drop the index on status column
DROP INDEX IF EXISTS idx_19037_idx_status;

-- 3. Drop the status column
ALTER TABLE blackboard_entries DROP COLUMN IF EXISTS status;

-- 4. Drop the ENUM type (no longer needed)
DROP TYPE IF EXISTS blackboard_entries_status;

-- 5. Ensure is_active has NOT NULL constraint with default
ALTER TABLE blackboard_entries
    ALTER COLUMN is_active SET NOT NULL,
    ALTER COLUMN is_active SET DEFAULT 1;

-- 6. Verify the migration
DO $$
DECLARE
    active_count INTEGER;
    archived_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_count FROM blackboard_entries WHERE is_active = 1;
    SELECT COUNT(*) INTO archived_count FROM blackboard_entries WHERE is_active = 3;
    RAISE NOTICE 'Migration complete: % active entries, % archived entries', active_count, archived_count;
END $$;
