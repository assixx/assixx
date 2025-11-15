-- =====================================================
-- Migration: Add UUID to KVP Attachments for Security
-- Date: 2025-11-13
-- Author: Simon & Claude
-- Description: Add file_uuid column like documents table
--              for secure, non-guessable download URLs
--
-- WHY: Prevent sequential ID guessing attacks
--      Align with document-explorer security pattern
-- =====================================================

USE main;

-- Step 1: Add file_uuid column
ALTER TABLE kvp_attachments
  ADD COLUMN file_uuid VARCHAR(36) NULL AFTER id,
  ADD UNIQUE KEY unique_file_uuid (file_uuid);

-- Step 2: Generate UUIDs for existing attachments
UPDATE kvp_attachments
SET file_uuid = UUID()
WHERE file_uuid IS NULL;

-- Step 3: Make file_uuid NOT NULL (after backfill)
ALTER TABLE kvp_attachments
  MODIFY COLUMN file_uuid VARCHAR(36) NOT NULL;

-- Step 4: Verify
SELECT 'Migration completed!' as Status;
SELECT CONCAT('Updated ', COUNT(*), ' attachments with UUIDs') as Result
FROM kvp_attachments;

-- Show sample
SELECT id, file_uuid, file_name
FROM kvp_attachments
LIMIT 5;
