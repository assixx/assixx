-- =====================================================
-- Migration: Add deletion_reason and ip_address to tenant_deletion_queue
-- Date: 2025-11-20
-- Author: Claude
-- Reason: Fix "Unknown column 'deletion_reason'" error
-- =====================================================

-- Add deletion_reason column
ALTER TABLE tenant_deletion_queue
ADD COLUMN deletion_reason TEXT NULL
AFTER approval_status;

-- Add ip_address column
ALTER TABLE tenant_deletion_queue
ADD COLUMN ip_address VARCHAR(45) NULL
AFTER deletion_reason;

-- Verify columns
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
AND TABLE_NAME = 'tenant_deletion_queue'
AND COLUMN_NAME IN ('deletion_reason', 'ip_address');
