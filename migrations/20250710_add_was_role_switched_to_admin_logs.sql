-- Migration: Add was_role_switched flag to admin_logs table
-- Date: 2025-07-10
-- Purpose: Track when actions were performed while in a switched role for compliance

ALTER TABLE admin_logs 
ADD COLUMN was_role_switched BOOLEAN DEFAULT FALSE 
AFTER user_agent;

-- Add index for faster queries on role-switched actions
CREATE INDEX idx_was_role_switched ON admin_logs(was_role_switched);

-- Comment for documentation
ALTER TABLE admin_logs 
MODIFY COLUMN was_role_switched BOOLEAN DEFAULT FALSE 
COMMENT 'Indicates if the action was performed while user had switched roles';