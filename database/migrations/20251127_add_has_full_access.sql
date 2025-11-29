-- Migration: Add has_full_access column to users table
-- Date: 2025-11-27
-- Purpose: Allow admins/employees to have full tenant access without individual assignments
-- Part of: Assignment System Refactoring (Mission 1)

-- Step 1: Add the column
ALTER TABLE users
ADD COLUMN has_full_access TINYINT(1) NOT NULL DEFAULT 0
AFTER role;

-- Step 2: Add index for efficient queries
CREATE INDEX idx_users_full_access ON users(tenant_id, has_full_access);

-- Verification queries:
-- SHOW COLUMNS FROM users LIKE 'has_full_access';
-- SHOW INDEX FROM users WHERE Key_name = 'idx_users_full_access';
