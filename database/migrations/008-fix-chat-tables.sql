-- Migration: Fix Chat Tables - Rename old messages table
-- Date: 2025-06-13
-- Description: Renames old messages table and ensures new chat tables are created correctly

-- 1. Rename old messages table if it exists
RENAME TABLE messages TO messages_old_backup;

-- 2. Recreate messages table with correct structure
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    attachment_path VARCHAR(500) DEFAULT NULL,
    attachment_name VARCHAR(255) DEFAULT NULL,
    attachment_type VARCHAR(100) DEFAULT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    
    INDEX idx_conversation (conversation_id),
    INDEX idx_sender (sender_id),
    INDEX idx_created (created_at),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;