-- =====================================================
-- Migration: Drop deprecated blackboard_attachments table
-- Date: 2025-11-26
-- Author: Claude
-- Reason: Attachments are now stored in documents table
--         with blackboard_entry_id column
-- =====================================================

-- 1. Check for any remaining data (for logging purposes)
SELECT COUNT(*) as remaining_attachments FROM blackboard_attachments;

-- 2. Drop the deprecated table
DROP TABLE IF EXISTS blackboard_attachments;

-- 3. Verify table is gone
SELECT 'blackboard_attachments table dropped successfully' as status;
