-- Migration: Remove redundant profile_picture_url column
-- Date: 2025-11-20
-- Author: Claude (Assixx Refactoring)
-- Description: Remove profile_picture_url column from users table
--              Backend only uses profile_picture field (stores relative path)
--              This migration cleans up redundant field causing confusion

-- WHY THIS MIGRATION:
-- 1. Upload writes to profile_picture field
-- 2. profile_picture_url was never populated
-- 3. Chat/Websocket queries fixed to read profile_picture
-- 4. Frontend cleaned up to only use profile_picture
-- 5. Single source of truth: profile_picture field

-- BACKUP REMINDER:
-- Run: bash scripts/quick-backup.sh "before_remove_profile_picture_url"

USE main;

-- Drop the redundant column
ALTER TABLE users DROP COLUMN profile_picture_url;

-- Verify column is gone
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'main'
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'profile_picture';
