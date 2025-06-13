-- =====================================================
-- Migration: Create message_status table
-- Date: 2025-06-13
-- Author: Claude AI
-- =====================================================

-- Create message_status table for read receipts and archived status
CREATE TABLE IF NOT EXISTS message_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Unique constraint
    UNIQUE KEY unique_message_user (message_id, user_id),
    
    -- Indexes
    INDEX idx_message_id (message_id),
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_is_archived (is_archived),
    
    -- Foreign Keys
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Check and add columns only if they don't exist
-- Note: MySQL doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- These columns may already exist, so we'll ignore errors

-- Update existing conversations to have created_by field if missing
ALTER TABLE conversations 
MODIFY COLUMN created_by INT NULL;

-- Create index on deleted_at for performance
CREATE INDEX IF NOT EXISTS idx_deleted_at ON messages(deleted_at);