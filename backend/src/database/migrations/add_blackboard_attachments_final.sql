-- =====================================================
-- Migration: Add Blackboard Attachments Support (Final)
-- Date: 2025-01-06
-- Description: Creates attachments table only
-- =====================================================

-- Create blackboard_attachments table if not exists
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

-- Migration complete
SELECT 'Blackboard attachments table created successfully!' AS status;