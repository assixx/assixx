-- =====================================================
-- documents.sql - Dokumenten-Management System
-- =====================================================
-- Verwaltung von Mitarbeiter-Dokumenten
-- Mit Kategorisierung, Archivierung und Ablaufdaten
-- =====================================================

CREATE TABLE IF NOT EXISTS documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    user_id INT NOT NULL,
    category ENUM('personal', 'work', 'training', 'general', 'salary') NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100),
    description TEXT,
    tags JSON,
    is_public BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_by INT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- Indexes
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_user_id (user_id),
    INDEX idx_category (category),
    INDEX idx_uploaded_at (uploaded_at),
    INDEX idx_is_archived (is_archived)
);