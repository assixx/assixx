-- =====================================================
-- Migration: Add attachment_size to messages table
-- Date: 2025-11-01
-- Author: Claude (KAIZEN-MANIFEST: Remove TODO comments)
-- Purpose: Store file size for chat message attachments
-- =====================================================

-- Add attachment_size column after attachment_type
-- BIGINT to support files up to 9.2 exabytes (9.2 * 10^18 bytes)
-- NULL allowed for existing messages without attachments
-- Default NULL (not 0) to distinguish "no attachment" from "0 byte file"
ALTER TABLE messages
ADD COLUMN attachment_size BIGINT DEFAULT NULL AFTER attachment_type;

-- Add index for analytics queries (e.g., "total storage per tenant")
CREATE INDEX idx_messages_attachment_size
ON messages(tenant_id, attachment_size);

-- Verify column was added
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'main'
  AND TABLE_NAME = 'messages'
  AND COLUMN_NAME = 'attachment_size';
