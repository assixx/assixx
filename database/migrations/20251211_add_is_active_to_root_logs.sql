-- Migration: Add is_active column to root_logs for soft delete
-- Date: 2025-12-11
-- Purpose: Enable soft delete for audit logs (logs should NEVER be hard deleted)
--
-- is_active values:
--   NULL = normal/active (default, shown in UI)
--   0 = inactive
--   1 = active
--   3 = archived
--   4 = deleted (soft delete, hidden from UI)

-- Add is_active column to root_logs
ALTER TABLE root_logs
ADD COLUMN IF NOT EXISTS is_active SMALLINT DEFAULT NULL;

-- Add index for filtering by is_active
CREATE INDEX IF NOT EXISTS idx_root_logs_is_active ON root_logs(is_active);

-- Verify the change
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'root_logs' AND column_name = 'is_active';
