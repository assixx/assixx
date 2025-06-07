-- Create table to track which documents have been read by which users
CREATE TABLE IF NOT EXISTS document_read_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    document_id INT NOT NULL,
    user_id INT NOT NULL,
    tenant_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique constraint to prevent duplicate entries
    UNIQUE KEY unique_document_user_read (document_id, user_id, tenant_id),
    
    -- Foreign keys
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Indexes for performance
    INDEX idx_user_read_status (user_id, tenant_id),
    INDEX idx_document_read_status (document_id, tenant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;