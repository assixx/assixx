-- =====================================================
-- Migration: Remove deprecated availability columns from users table
-- Date: 2026-01-24
-- Author: Claude
--
-- This migration:
-- 1. Migrates existing availability data from users to employee_availability
-- 2. Drops the deprecated columns from users table
--
-- IMPORTANT: Backup before running!
-- =====================================================

-- Step 1: Migrate existing data from users to employee_availability
-- Only migrate if the user has availability data that's not already in the table
-- Cast via TEXT to handle different ENUM types (users_availability_status → employee_availability_status)
INSERT INTO employee_availability (employee_id, tenant_id, status, start_date, end_date, notes, created_at, updated_at)
SELECT
    u.id,
    u.tenant_id,
    u.availability_status::TEXT::employee_availability_status,
    u.availability_start,
    u.availability_end,
    u.availability_notes,
    NOW(),
    NOW()
FROM users u
WHERE u.availability_status IS NOT NULL
  AND u.availability_status::TEXT != 'available'
  AND u.availability_start IS NOT NULL
  AND u.availability_end IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM employee_availability ea
    WHERE ea.employee_id = u.id
      AND ea.start_date = u.availability_start
      AND ea.end_date = u.availability_end
  );

-- Step 2: Drop the deprecated columns from users table
ALTER TABLE users DROP COLUMN IF EXISTS availability_status;
ALTER TABLE users DROP COLUMN IF EXISTS availability_start;
ALTER TABLE users DROP COLUMN IF EXISTS availability_end;
ALTER TABLE users DROP COLUMN IF EXISTS availability_notes;

-- Verify the columns are removed
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name LIKE 'availability%';
