-- ============================================================================
-- Migration: Add UUIDv7 columns to P1 tables (notifications, machines)
-- Version: 005
-- Date: 2026-01-13
-- Description: P1 Migration - Add uuid and uuid_created_at to high-priority tables
-- ============================================================================

-- ============================================================================
-- 1. notifications
-- ============================================================================

-- Add uuid column (nullable initially)
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- Populate existing rows with UUIDv4 (gen_random_uuid) and created_at timestamp
UPDATE notifications
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

-- Make uuid NOT NULL after populating
ALTER TABLE notifications
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_uuid
ON notifications(uuid);

-- Index for uuid_created_at queries
CREATE INDEX IF NOT EXISTS idx_notifications_uuid_created_at
ON notifications(uuid_created_at);

-- ============================================================================
-- 2. machines
-- ============================================================================

-- Add uuid column (nullable initially)
ALTER TABLE machines
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- Populate existing rows
UPDATE machines
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

-- Make uuid NOT NULL
ALTER TABLE machines
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_uuid
ON machines(uuid);

-- Index for uuid_created_at queries
CREATE INDEX IF NOT EXISTS idx_machines_uuid_created_at
ON machines(uuid_created_at);

-- ============================================================================
-- Verification
-- ============================================================================

-- Show migration results
SELECT 'notifications' as table_name, COUNT(*) as rows_with_uuid
FROM notifications WHERE uuid IS NOT NULL
UNION ALL
SELECT 'machines', COUNT(*)
FROM machines WHERE uuid IS NOT NULL;
