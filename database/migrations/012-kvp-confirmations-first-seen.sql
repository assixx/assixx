-- Migration: 012-kvp-confirmations-first-seen
-- Description: Add first_seen_at and is_confirmed columns to separate "Neu" badge from read status
-- Date: 2026-01-23
--
-- Same pattern as blackboard (011-blackboard-confirmations-first-seen.sql)
--
-- Logic:
--   - first_seen_at: Timestamp when user FIRST saw the entry (never reset)
--   - is_confirmed: Current read status (can toggle true/false)
--   - "Neu" badge = first_seen_at IS NULL (never seen by this user)
--   - "Ungelesen" eye = is_confirmed = false

-- ============================================================================
-- Step 1: Add new columns
-- ============================================================================

-- Add first_seen_at column (when user first saw the suggestion - never changes)
ALTER TABLE kvp_confirmations
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP WITH TIME ZONE;

-- Add is_confirmed column (current read status - can toggle)
ALTER TABLE kvp_confirmations
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN NOT NULL DEFAULT true;

-- ============================================================================
-- Step 2: Migrate existing data
-- ============================================================================

-- For existing rows: first_seen_at = confirmed_at (they already saw it)
UPDATE kvp_confirmations
SET first_seen_at = confirmed_at
WHERE first_seen_at IS NULL AND confirmed_at IS NOT NULL;

-- ============================================================================
-- Step 3: Add index for performance
-- ============================================================================

-- Index for querying unconfirmed entries per user
CREATE INDEX IF NOT EXISTS idx_kvp_confirmations_is_confirmed
ON kvp_confirmations(suggestion_id, user_id, is_confirmed);

-- ============================================================================
-- Verification
-- ============================================================================

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'kvp_confirmations'
ORDER BY ordinal_position;
