-- ============================================================================
-- Migration: Add UUIDv7 columns to shift_rotation_* tables
-- Version: 004
-- Date: 2026-01-13
-- Description: P1 Migration - Add uuid and uuid_created_at to rotation tables
-- ============================================================================

-- ============================================================================
-- 1. shift_rotation_patterns
-- ============================================================================

-- Add uuid column (nullable initially)
ALTER TABLE shift_rotation_patterns
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- Populate existing rows with UUIDv4 (gen_random_uuid) and created_at timestamp
UPDATE shift_rotation_patterns
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

-- Make uuid NOT NULL after populating
ALTER TABLE shift_rotation_patterns
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_rotation_patterns_uuid
ON shift_rotation_patterns(uuid);

-- Index for uuid_created_at queries
CREATE INDEX IF NOT EXISTS idx_shift_rotation_patterns_uuid_created_at
ON shift_rotation_patterns(uuid_created_at);

-- ============================================================================
-- 2. shift_rotation_assignments
-- ============================================================================

-- Add uuid column (nullable initially)
ALTER TABLE shift_rotation_assignments
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- Populate existing rows
UPDATE shift_rotation_assignments
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(assigned_at, NOW())
WHERE uuid IS NULL;

-- Make uuid NOT NULL
ALTER TABLE shift_rotation_assignments
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_rotation_assignments_uuid
ON shift_rotation_assignments(uuid);

-- ============================================================================
-- 3. shift_rotation_history
-- ============================================================================

-- Add uuid column (nullable initially)
ALTER TABLE shift_rotation_history
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

-- Populate existing rows
UPDATE shift_rotation_history
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(generated_at, NOW())
WHERE uuid IS NULL;

-- Make uuid NOT NULL
ALTER TABLE shift_rotation_history
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

-- Create unique index on uuid
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_rotation_history_uuid
ON shift_rotation_history(uuid);

-- ============================================================================
-- Verification
-- ============================================================================

-- Show migration results
SELECT 'shift_rotation_patterns' as table_name, COUNT(*) as rows_with_uuid
FROM shift_rotation_patterns WHERE uuid IS NOT NULL
UNION ALL
SELECT 'shift_rotation_assignments', COUNT(*)
FROM shift_rotation_assignments WHERE uuid IS NOT NULL
UNION ALL
SELECT 'shift_rotation_history', COUNT(*)
FROM shift_rotation_history WHERE uuid IS NOT NULL;
