-- Add is_archived column to users table
ALTER TABLE users
ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster queries
CREATE INDEX idx_users_is_archived ON users(is_archived);

-- Update any existing queries that should consider archive status
-- No actual data updates needed as all existing users will have is_archived=FALSE by default