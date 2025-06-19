-- Migration: Add UNIQUE constraint to email column
-- Date: 2025-06-18
-- Purpose: Since username = email, we need email to be unique

-- First drop the existing non-unique index
ALTER TABLE users DROP INDEX idx_email;

-- Add unique constraint
ALTER TABLE users ADD UNIQUE KEY unique_email (email);

-- Add index for performance (unique constraint already creates an index, but this is explicit)
-- ALTER TABLE users ADD INDEX idx_email (email); -- Not needed, UNIQUE already creates index