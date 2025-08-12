-- Migration: Remove UNIQUE constraint from phone column
-- Date: 2025-08-11
-- Reason: Phone number should be optional and allow duplicates

-- Drop the unique index on phone column
ALTER TABLE users DROP INDEX idx_users_phone;

-- Update column comment to reflect the change
ALTER TABLE users MODIFY COLUMN phone varchar(30) DEFAULT NULL COMMENT 'Handynummer/Mobile (optional, can have duplicates)';