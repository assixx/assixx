-- =====================================================
-- Migration: Add KVP Attachments Support
-- Date: 2025-06-21
-- Author: Simon & Claude
-- Description: Enable photo uploads for KVP suggestions
-- =====================================================

-- Create kvp_attachments table for storing photo references
CREATE TABLE IF NOT EXISTS kvp_attachments (
    id INT NOT NULL AUTO_INCREMENT,
    suggestion_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INT NOT NULL,
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_suggestion (suggestion_id),
    KEY idx_uploaded_by (uploaded_by),
    CONSTRAINT kvp_attachments_ibfk_1 FOREIGN KEY (suggestion_id) REFERENCES kvp_suggestions (id) ON DELETE CASCADE,
    CONSTRAINT kvp_attachments_ibfk_2 FOREIGN KEY (uploaded_by) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add index for faster queries
CREATE INDEX idx_suggestion_uploaded ON kvp_attachments (suggestion_id, uploaded_at);

-- Verify the table was created
SELECT 'KVP Attachments table created successfully' as Status;