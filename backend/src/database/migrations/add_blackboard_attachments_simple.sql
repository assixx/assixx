-- =====================================================
-- Migration: Add Blackboard Attachments Support (Simplified)
-- Date: 2025-01-06
-- Description: Adds support for file attachments - without triggers
-- =====================================================

-- Create blackboard_attachments table
CREATE TABLE IF NOT EXISTS blackboard_attachments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    FOREIGN KEY (entry_id) REFERENCES blackboard_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_entry_id (entry_id),
    INDEX idx_uploaded_by (uploaded_by),
    INDEX idx_mime_type (mime_type)
);

-- Add comment to explain purpose
ALTER TABLE blackboard_attachments COMMENT = 'Stores file attachments for blackboard entries (PDFs, images)';

-- Check if column exists first
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'blackboard_entries' 
    AND COLUMN_NAME = 'attachment_count'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE blackboard_entries ADD COLUMN attachment_count INT DEFAULT 0 AFTER requires_confirmation',
    'SELECT "Column attachment_count already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_attachment_count ON blackboard_entries(attachment_count);

-- Migration complete message
SELECT 'Blackboard attachments migration completed successfully (without triggers)' AS status;