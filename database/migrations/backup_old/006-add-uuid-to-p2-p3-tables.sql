-- ============================================================================
-- Migration: Add UUIDv7 columns to P2/P3 tables
-- Version: 006
-- Date: 2026-01-13
-- Description: P2/P3 Migration - Add uuid and uuid_created_at to remaining tables
-- ============================================================================

-- ============================================================================
-- P2: survey_responses
-- ============================================================================

ALTER TABLE survey_responses
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

UPDATE survey_responses
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(started_at, NOW())
WHERE uuid IS NULL;

ALTER TABLE survey_responses
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_responses_uuid
ON survey_responses(uuid);

-- ============================================================================
-- P2: message_attachments
-- ============================================================================

ALTER TABLE message_attachments
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

UPDATE message_attachments
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

ALTER TABLE message_attachments
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_attachments_uuid
ON message_attachments(uuid);

-- ============================================================================
-- P3: teams
-- ============================================================================

ALTER TABLE teams
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

UPDATE teams
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

ALTER TABLE teams
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_uuid
ON teams(uuid);

-- ============================================================================
-- P3: departments
-- ============================================================================

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

UPDATE departments
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

ALTER TABLE departments
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_uuid
ON departments(uuid);

-- ============================================================================
-- P3: areas
-- ============================================================================

ALTER TABLE areas
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

UPDATE areas
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

ALTER TABLE areas
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_areas_uuid
ON areas(uuid);

-- ============================================================================
-- P3: tenants
-- ============================================================================

ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS uuid CHAR(36),
ADD COLUMN IF NOT EXISTS uuid_created_at TIMESTAMPTZ;

UPDATE tenants
SET uuid = gen_random_uuid()::text,
    uuid_created_at = COALESCE(created_at, NOW())
WHERE uuid IS NULL;

ALTER TABLE tenants
ALTER COLUMN uuid SET NOT NULL,
ALTER COLUMN uuid_created_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_uuid
ON tenants(uuid);

-- ============================================================================
-- Verification
-- ============================================================================

SELECT 'survey_responses' as table_name, COUNT(*) as rows_with_uuid
FROM survey_responses WHERE uuid IS NOT NULL
UNION ALL
SELECT 'message_attachments', COUNT(*)
FROM message_attachments WHERE uuid IS NOT NULL
UNION ALL
SELECT 'teams', COUNT(*)
FROM teams WHERE uuid IS NOT NULL
UNION ALL
SELECT 'departments', COUNT(*)
FROM departments WHERE uuid IS NOT NULL
UNION ALL
SELECT 'areas', COUNT(*)
FROM areas WHERE uuid IS NOT NULL
UNION ALL
SELECT 'tenants', COUNT(*)
FROM tenants WHERE uuid IS NOT NULL;
