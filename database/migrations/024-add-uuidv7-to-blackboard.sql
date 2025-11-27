-- =====================================================
-- Migration: Add UUIDv7 to Blackboard System
-- Date: 2025-11-23
-- Author: Claude
-- Description:
--   - Add uuid column to blackboard_entries for secure URLs
--   - Add file_uuid to blackboard_attachments for secure downloads
--   - Generate UUIDs for existing entries (backward compatible)
--   - Add indexes for performance
-- =====================================================

USE main;

-- =====================================================
-- 1. Add UUID columns to blackboard_entries
-- =====================================================

ALTER TABLE blackboard_entries
  ADD COLUMN uuid VARCHAR(36) UNIQUE AFTER id,
  ADD COLUMN uuid_created_at TIMESTAMP NULL AFTER updated_at;

-- =====================================================
-- 2. Generate UUIDs for existing entries
-- =====================================================

-- Generate UUID() for existing entries (MySQL UUID function)
-- Note: These are UUID v4, but new entries will use v7 from backend
UPDATE blackboard_entries
SET uuid = UUID(),
    uuid_created_at = NOW()
WHERE uuid IS NULL;

-- =====================================================
-- 3. Add indexes for performance
-- =====================================================

-- Index on uuid for fast lookups
CREATE INDEX idx_blackboard_entries_uuid ON blackboard_entries(uuid);

-- Composite index for tenant + uuid lookups
CREATE INDEX idx_blackboard_entries_tenant_uuid ON blackboard_entries(tenant_id, uuid);

-- =====================================================
-- 4. Add file_uuid to blackboard_attachments (Security)
-- =====================================================

-- file_uuid prevents enumeration attacks on downloads
-- Users need the UUID to download, not just sequential IDs
ALTER TABLE blackboard_attachments
  ADD COLUMN file_uuid VARCHAR(36) UNIQUE AFTER id;

-- Generate UUIDs for existing attachments (if any)
UPDATE blackboard_attachments
SET file_uuid = UUID()
WHERE file_uuid IS NULL;

-- Index for file downloads
CREATE INDEX idx_blackboard_attachments_file_uuid ON blackboard_attachments(file_uuid);

-- =====================================================
-- 5. Verification
-- =====================================================

-- Verify uuid column exists
SELECT
  COUNT(*) as entries_with_uuid,
  COUNT(CASE WHEN uuid IS NOT NULL THEN 1 END) as uuids_generated,
  COUNT(CASE WHEN uuid IS NULL THEN 1 END) as missing_uuids
FROM blackboard_entries;

-- Verify file_uuid column exists
SELECT
  COUNT(*) as total_attachments,
  COUNT(CASE WHEN file_uuid IS NOT NULL THEN 1 END) as uuids_generated
FROM blackboard_attachments;

-- Show sample entry with uuid
SELECT id, uuid, title, created_at, uuid_created_at
FROM blackboard_entries
LIMIT 1;

-- =====================================================
-- Migration Complete!
-- =====================================================
