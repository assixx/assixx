-- Migration: Fix tenant_deletion_queue status ENUM
-- Date: 2025-09-13
-- Issue: Backend uses 'pending_approval' but it was not in the ENUM definition

-- Add 'pending_approval' to the status ENUM
ALTER TABLE tenant_deletion_queue
MODIFY COLUMN status ENUM('queued','processing','completed','failed','pending_approval')
DEFAULT 'queued';

-- Fix any existing records with empty status
UPDATE tenant_deletion_queue
SET status = 'pending_approval'
WHERE status = '' OR status IS NULL;

-- Add comment to document the valid values
ALTER TABLE tenant_deletion_queue
COMMENT = 'Queue for tenant deletion requests. Status values: queued (ready for processing), processing (deletion in progress), completed (deletion done), failed (deletion failed), pending_approval (waiting for second root user approval)';