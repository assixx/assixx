-- =====================================================================
-- Migration: Fix tenant_deletion_queue status ENUM
-- Date: 2025-09-17
-- Author: System
-- Description: Add 'cancelled' option to status ENUM in tenant_deletion_queue
-- =====================================================================

-- Add 'cancelled' to the status ENUM
ALTER TABLE tenant_deletion_queue
MODIFY COLUMN status ENUM(
    'queued',
    'processing',
    'completed',
    'failed',
    'pending_approval',
    'cancelled'
) DEFAULT 'queued';

-- Update any existing records with empty status to 'cancelled' if they were previously cancelled
-- This is safe because we check for completed_at timestamp
UPDATE tenant_deletion_queue
SET status = 'cancelled'
WHERE status = ''
  AND completed_at IS NOT NULL;

-- Verify the change
SELECT COLUMN_NAME, COLUMN_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'tenant_deletion_queue'
  AND COLUMN_NAME = 'status';